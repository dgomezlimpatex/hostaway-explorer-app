-- Current deployed definitions with narrow mode-transition fences and partial-receipt handling.
-- No history is replayed, removed or sent. Existing grants remain unchanged.
BEGIN;
CREATE OR REPLACE FUNCTION public.process_due_estimated_amenities(_batch_size integer DEFAULT 100)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  cleaning record;
  line record;
  level_row public.stock_levels;
  warehouse_key uuid;
  new_movement_id uuid;
  skipped integer;
  lines_seen integer;
  attempts integer := 0;
  applied integer := 0;
  pending integer := 0;
  due_at timestamptz;
BEGIN
  IF _batch_size IS NULL OR _batch_size < 1 OR _batch_size > 500 THEN
    RAISE EXCEPTION 'Batch size must be between 1 and 500';
  END IF;
  FOR cleaning IN
    SELECT t.id, t.propiedad_id, t.sede_id, t.date, t.end_time
    FROM public.tasks t
    JOIN public.properties active_property ON active_property.id = t.propiedad_id
      AND active_property.sede_id = t.sede_id
    JOIN public.clients active_client ON active_client.id = active_property.cliente_id
      AND active_client.sede_id = t.sede_id
      AND active_client.is_active IS TRUE
      AND COALESCE(active_property.is_active, active_client.is_active, false)
    JOIN public.stock_sede_settings s ON s.sede_id = t.sede_id
    WHERE s.estimated_amenities_enabled
      AND s.estimated_amenities_started_at IS NOT NULL
      AND t.type = 'limpieza-turistica' AND t.status IS DISTINCT FROM 'cancelled'
      AND t.propiedad_id IS NOT NULL AND t.date IS NOT NULL AND t.end_time IS NOT NULL
      AND (t.date + t.end_time) AT TIME ZONE 'Europe/Madrid' <= now()
      AND (t.date + t.end_time) AT TIME ZONE 'Europe/Madrid' >= s.estimated_amenities_started_at
      AND NOT EXISTS (SELECT 1 FROM public.stock_estimated_amenity_runs r
        WHERE r.task_key = t.id AND (r.complete OR r.next_retry_at > now()))
    ORDER BY t.date, t.end_time, t.id
    LIMIT _batch_size
  LOOP
    -- Fence the stock mode before taking task/stock row locks.
    PERFORM 1 FROM public.stock_sede_settings WHERE sede_id=cleaning.sede_id AND estimated_amenities_enabled FOR SHARE;
    IF NOT FOUND THEN CONTINUE; END IF;
    -- Serialize against cancellation/deletion and re-read an edited schedule.
    SELECT t.id, t.propiedad_id, t.sede_id, t.date, t.end_time, t.status, t.type
      INTO cleaning FROM public.tasks t WHERE t.id = cleaning.id FOR UPDATE;
    IF NOT FOUND OR cleaning.status = 'cancelled'
      OR cleaning.type <> 'limpieza-turistica' OR cleaning.propiedad_id IS NULL
      THEN CONTINUE; END IF;
    PERFORM 1 FROM public.properties p
      JOIN public.clients c ON c.id = p.cliente_id AND c.sede_id = p.sede_id
      WHERE p.id = cleaning.propiedad_id AND p.sede_id = cleaning.sede_id
        AND c.is_active IS TRUE
        AND COALESCE(p.is_active, c.is_active, false)
      FOR SHARE OF p, c;
    IF NOT FOUND THEN CONTINUE; END IF;
    IF cleaning.date IS NULL OR cleaning.end_time IS NULL
      OR (cleaning.date + cleaning.end_time) AT TIME ZONE 'Europe/Madrid' > now()
      OR NOT EXISTS (SELECT 1 FROM public.stock_sede_settings s
        WHERE s.sede_id = cleaning.sede_id AND s.estimated_amenities_enabled

          AND (cleaning.date + cleaning.end_time) AT TIME ZONE 'Europe/Madrid'
            >= s.estimated_amenities_started_at) THEN CONTINUE; END IF;
    attempts := attempts + 1;
    skipped := 0;
    lines_seen := 0;
    due_at := (cleaning.date + cleaning.end_time) AT TIME ZONE 'Europe/Madrid';
    FOR line IN
      SELECT r.product_id, r.quantity_per_cleaning AS quantity,
        r.warehouse_id AS assigned_warehouse, p.default_stock_warehouse_id,
        p.sede_id AS property_sede
      FROM public.stock_property_consumption_rules r
      JOIN public.properties p ON p.id = r.property_id
      JOIN public.stock_products sp ON sp.id = r.product_id
      JOIN public.stock_categories c ON c.id = sp.category_id
      WHERE r.property_id = cleaning.propiedad_id AND r.is_active
        AND r.quantity_per_cleaning > 0
        AND r.quantity_per_cleaning::text NOT IN ('NaN','Infinity','-Infinity')
        AND sp.is_active AND sp.is_consumable
        AND sp.sede_id = cleaning.sede_id AND p.sede_id = cleaning.sede_id
        AND c.kind = 'amenity'
        AND (sp.sku IS DISTINCT FROM 'SACOS-BASURA-100L' OR cleaning.date >= DATE '2026-10-09')
      ORDER BY r.product_id
    LOOP
      lines_seen := lines_seen + 1;
      IF EXISTS (SELECT 1 FROM public.stock_estimated_amenity_entries e
                 WHERE e.task_key = cleaning.id AND e.product_id = line.product_id
                   AND e.state = 'applied') THEN
        CONTINUE;
      END IF;
      IF EXISTS (SELECT 1 FROM public.stock_estimated_amenity_entries e
                 WHERE e.task_key = cleaning.id AND e.product_id = line.product_id
                   AND e.state = 'reversed') THEN
        INSERT INTO public.stock_estimated_amenity_issues(task_key, product_id, sede_id, issue_code)
        VALUES (cleaning.id, line.product_id, cleaning.sede_id, 'reactivated_requires_review')
        ON CONFLICT (task_key, product_id) DO UPDATE SET
          issue_code = EXCLUDED.issue_code, last_seen_at = now(), resolved_at = NULL;
        skipped := skipped + 1;
        CONTINUE;
      END IF;
      -- Do not debit a product already touched by the previous completion-driven
      -- system. Manual reconciliation is safer than silently double counting.
      IF EXISTS (SELECT 1 FROM public.stock_movements m
        WHERE m.task_id = cleaning.id AND m.product_id = line.product_id
          AND m.movement_type = 'consumo_automatico') THEN
        INSERT INTO public.stock_estimated_amenity_issues(task_key, product_id, sede_id, issue_code)
        VALUES (cleaning.id, line.product_id, cleaning.sede_id, 'legacy_consumption_requires_review')
        ON CONFLICT (task_key, product_id) DO UPDATE SET
          issue_code = EXCLUDED.issue_code, last_seen_at = now(), resolved_at = NULL;
        skipped := skipped + 1;
        CONTINUE;
      END IF;
      SELECT w.id INTO warehouse_key FROM public.stock_warehouses w
        WHERE w.id = COALESCE(line.assigned_warehouse, line.default_stock_warehouse_id)
          AND w.sede_id = cleaning.sede_id AND w.is_active;
      IF warehouse_key IS NULL AND line.assigned_warehouse IS NULL
        AND line.default_stock_warehouse_id IS NULL THEN
        SELECT w.id INTO warehouse_key FROM public.stock_warehouses w
          WHERE w.sede_id = cleaning.sede_id AND w.is_default AND w.is_active;
      END IF;
      level_row := NULL;
      IF warehouse_key IS NOT NULL THEN
        SELECT * INTO level_row FROM public.stock_levels l
          WHERE l.product_id = line.product_id AND l.warehouse_id = warehouse_key FOR UPDATE;
      END IF;
      IF warehouse_key IS NULL OR level_row.id IS NULL OR level_row.current_quantity < line.quantity THEN
        INSERT INTO public.stock_estimated_amenity_issues(task_key, product_id, sede_id, issue_code)
        VALUES (cleaning.id, line.product_id, cleaning.sede_id,
          CASE WHEN warehouse_key IS NULL THEN 'missing_warehouse'
               WHEN level_row.id IS NULL THEN 'missing_level' ELSE 'insufficient_stock' END)
        ON CONFLICT (task_key, product_id) DO UPDATE SET
          issue_code = EXCLUDED.issue_code, last_seen_at = now(), resolved_at = NULL;
        skipped := skipped + 1;
        CONTINUE;
      END IF;
      UPDATE public.stock_levels SET current_quantity = current_quantity - line.quantity
        WHERE id = level_row.id;
      INSERT INTO public.stock_movements (
        product_id, warehouse_id, movement_type, quantity, previous_quantity,
        new_quantity, reason, task_id, property_id, unit_cost_at_movement
      ) VALUES (
        line.product_id, warehouse_key, 'consumo_automatico', line.quantity,
        level_row.current_quantity, level_row.current_quantity - line.quantity,
        'Consumo estimado tras fin previsto de limpieza', cleaning.id,
        cleaning.propiedad_id, level_row.cost_per_unit
      ) RETURNING id INTO new_movement_id;
      INSERT INTO public.stock_estimated_amenity_entries (
        task_key, sede_id, property_id, product_id, warehouse_id, quantity,
        unit_cost_at_consumption, scheduled_end_at, movement_id
      ) VALUES (
        cleaning.id, cleaning.sede_id, cleaning.propiedad_id, line.product_id,
        warehouse_key, line.quantity, level_row.cost_per_unit, due_at, new_movement_id
      );
      UPDATE public.stock_estimated_amenity_issues SET resolved_at = now()
        WHERE task_key = cleaning.id AND product_id = line.product_id AND resolved_at IS NULL;
      applied := applied + 1;
    END LOOP;
    IF lines_seen = 0 THEN skipped := skipped + 1; END IF;
    INSERT INTO public.stock_estimated_amenity_runs (
      task_key, sede_id, last_attempt_at, next_retry_at, issue_code, complete
    ) VALUES (cleaning.id, cleaning.sede_id, now(),
      CASE WHEN skipped > 0 THEN now() + interval '1 hour' ELSE NULL END,
      CASE WHEN lines_seen = 0 THEN 'no_amenity_rules'
           WHEN skipped > 0 THEN 'pending_lines' ELSE NULL END,
      skipped = 0)
    ON CONFLICT (task_key) DO UPDATE SET last_attempt_at = now(),
      next_retry_at = EXCLUDED.next_retry_at,
      issue_code = EXCLUDED.issue_code, complete = EXCLUDED.complete;
    pending := pending + skipped;
  END LOOP;
  RETURN jsonb_build_object('tasks_checked', attempts, 'lines_applied', applied,
    'lines_pending', pending);
END;
$function$;

CREATE OR REPLACE FUNCTION public.reverse_estimated_amenities_on_cancellation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  entry record;
  current_level public.stock_levels;
  undo_movement_id uuid;
  cancellation_event boolean := false;
BEGIN
  PERFORM public.lock_stock_bag_sede(CASE WHEN TG_OP='DELETE' THEN OLD.sede_id ELSE NEW.sede_id END);
  -- The historical estimate was reconciled at cutover. Cancellation is not a physical return.
  IF EXISTS(SELECT 1 FROM public.stock_bag_accounting_config WHERE sede_id=CASE WHEN TG_OP='DELETE' THEN OLD.sede_id ELSE NEW.sede_id END) THEN
    IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    cancellation_event := true;
  ELSIF TG_OP = 'UPDATE' THEN
    cancellation_event := NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled';
  END IF;
  IF cancellation_event THEN
    UPDATE public.stock_estimated_amenity_issues SET resolved_at = now()
      WHERE task_key = OLD.id AND resolved_at IS NULL;
    FOR entry IN
      SELECT * FROM public.stock_estimated_amenity_entries
      WHERE task_key = OLD.id AND state = 'applied' ORDER BY product_id FOR UPDATE
    LOOP
      IF EXISTS (SELECT 1 FROM public.stock_warehouses
        WHERE id = entry.warehouse_id AND NOT is_active)
        OR EXISTS (SELECT 1 FROM public.stock_products
          WHERE id = entry.product_id AND NOT is_active) THEN
        -- A replacement may already hold the unique active building slot.
        -- Keep both movements in the historical location; never invent a
        -- physical relocation or let reactivation abort a PMS cancellation.
        INSERT INTO public.stock_estimated_amenity_issues(task_key, product_id, sede_id, issue_code)
        VALUES (OLD.id, entry.product_id, entry.sede_id, 'inactive_location_requires_reconciliation')
        ON CONFLICT (task_key, product_id) DO UPDATE SET
          issue_code = EXCLUDED.issue_code, last_seen_at = now(), resolved_at = NULL;
      END IF;
      SELECT * INTO current_level FROM public.stock_levels
        WHERE product_id = entry.product_id AND warehouse_id = entry.warehouse_id FOR UPDATE;
      IF current_level.id IS NULL THEN
        INSERT INTO public.stock_levels(product_id, warehouse_id, current_quantity, cost_per_unit)
          VALUES (entry.product_id, entry.warehouse_id, 0, entry.unit_cost_at_consumption)
          ON CONFLICT (product_id, warehouse_id) DO NOTHING;
        SELECT * INTO current_level FROM public.stock_levels
          WHERE product_id = entry.product_id AND warehouse_id = entry.warehouse_id FOR UPDATE;
        INSERT INTO public.stock_estimated_amenity_issues(task_key, product_id, sede_id, issue_code)
          VALUES (OLD.id, entry.product_id, entry.sede_id,
            CASE WHEN EXISTS (SELECT 1 FROM public.stock_warehouses w
                WHERE w.id = entry.warehouse_id AND NOT w.is_active)
              OR EXISTS (SELECT 1 FROM public.stock_products p
                WHERE p.id = entry.product_id AND NOT p.is_active)
              THEN 'inactive_location_requires_reconciliation'
              ELSE 'missing_level_restored_on_cancellation' END)
          ON CONFLICT (task_key, product_id) DO UPDATE SET
            issue_code = EXCLUDED.issue_code, last_seen_at = now(), resolved_at = NULL;
      END IF;
      UPDATE public.stock_levels SET current_quantity = current_quantity + entry.quantity
        WHERE id = current_level.id;
      INSERT INTO public.stock_movements (
        product_id, warehouse_id, movement_type, quantity, previous_quantity,
        new_quantity, reason, task_id, property_id, unit_cost_at_movement
      ) VALUES (
        entry.product_id, entry.warehouse_id, 'entrada', entry.quantity,
        current_level.current_quantity, current_level.current_quantity + entry.quantity,
        'Reversión de consumo estimado por limpieza cancelada', OLD.id,
        entry.property_id, entry.unit_cost_at_consumption
      ) RETURNING id INTO undo_movement_id;
      UPDATE public.stock_estimated_amenity_entries SET state = 'reversed',
        reversed_at = now(), reversal_movement_id = undo_movement_id WHERE id = entry.id;
    END LOOP;
    UPDATE public.stock_estimated_amenity_runs SET complete = true,
      next_retry_at = NULL, issue_code = NULL WHERE task_key = OLD.id;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'cancelled'
    AND NEW.status IS DISTINCT FROM 'cancelled' THEN
    UPDATE public.stock_estimated_amenity_runs SET complete = false,
      next_retry_at = NULL, issue_code = 'reactivated_requires_review'
      WHERE task_key = OLD.id;
  ELSIF TG_OP = 'UPDATE' AND OLD.propiedad_id IS DISTINCT FROM NEW.propiedad_id THEN
    -- Time-only rescheduling keeps the estimate by explicit product decision.
    -- A different property's rule may differ: flag it instead of silently
    -- reallocating a physical warehouse without an agreed business rule.
    INSERT INTO public.stock_estimated_amenity_issues(task_key, product_id, sede_id, issue_code)
      SELECT OLD.id, e.product_id, e.sede_id, 'property_changed_after_estimate'
      FROM public.stock_estimated_amenity_entries e
      WHERE e.task_key = OLD.id AND e.state = 'applied'
      ON CONFLICT (task_key, product_id) DO UPDATE SET
        issue_code = EXCLUDED.issue_code, last_seen_at = now(), resolved_at = NULL;
  END IF;
  IF TG_OP = 'UPDATE' THEN RETURN NEW; END IF;
  RETURN OLD;
END;
$function$;

CREATE OR REPLACE FUNCTION public.adjust_stock_level(stock_level_id_param uuid, movement_type_param text, quantity_param numeric, reason_param text, cost_per_unit_param numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  acting_user UUID := auth.uid();
  level_record RECORD;
  new_quantity NUMERIC(12, 2);
  movement_quantity NUMERIC(12, 2);
  movement_id UUID;
  desired_alert TEXT;
BEGIN
  IF acting_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = acting_user
      AND role IN ('admin', 'manager')
  ) THEN
    RAISE EXCEPTION 'User not allowed to adjust stock';
  END IF;

  IF stock_level_id_param IS NULL OR quantity_param IS NULL THEN
    RAISE EXCEPTION 'stock_level_id and quantity are required';
  END IF;

  IF movement_type_param NOT IN ('entrada', 'salida', 'ajuste') THEN
    RAISE EXCEPTION 'Invalid movement type';
  END IF;

  IF quantity_param < 0 THEN
    RAISE EXCEPTION 'Quantity must be non-negative';
  END IF;

  IF length(trim(COALESCE(reason_param, ''))) = 0 THEN
    RAISE EXCEPTION 'Adjustment reason is required';
  END IF;

  IF cost_per_unit_param IS NOT NULL AND cost_per_unit_param < 0 THEN
    RAISE EXCEPTION 'Cost must be non-negative';
  END IF;

  PERFORM public.lock_stock_bag_sede((SELECT w.sede_id FROM public.stock_levels l JOIN public.stock_warehouses w ON w.id=l.warehouse_id WHERE l.id=stock_level_id_param));
  IF EXISTS(SELECT 1 FROM public.stock_levels l JOIN public.stock_bag_accounting_config c ON c.central_id=l.warehouse_id AND c.active
    JOIN public.stock_bag_accounting_sources s ON s.sede_id=c.sede_id AND s.product_id=l.product_id WHERE l.id=stock_level_id_param) THEN
    RAISE EXCEPTION 'Recarga Inventario para usar los ajustes comprobados del descuento por bolsas';
  END IF;
  SELECT l.* INTO level_record
  FROM public.stock_levels l
  JOIN public.stock_products p ON p.id = l.product_id AND p.is_active = true
  JOIN public.stock_warehouses w ON w.id = l.warehouse_id AND w.is_active = true
  WHERE l.id = stock_level_id_param
  FOR UPDATE OF l;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active stock level not found';
  END IF;

  IF movement_type_param = 'entrada' THEN
    new_quantity := level_record.current_quantity + quantity_param;
  ELSIF movement_type_param = 'salida' THEN
    new_quantity := level_record.current_quantity - quantity_param;
    IF new_quantity < 0 THEN
      RAISE EXCEPTION 'Insufficient stock for this exit';
    END IF;
  ELSE
    new_quantity := quantity_param;
  END IF;

  movement_quantity := CASE
    WHEN movement_type_param = 'ajuste' THEN abs(new_quantity - level_record.current_quantity)
    ELSE quantity_param
  END;

  IF movement_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must change the stock';
  END IF;

  UPDATE public.stock_levels
  SET
    current_quantity = new_quantity,
    cost_per_unit = COALESCE(cost_per_unit_param, cost_per_unit),
    updated_by = acting_user
  WHERE id = level_record.id;

  INSERT INTO public.stock_movements (
    product_id,
    warehouse_id,
    movement_type,
    quantity,
    previous_quantity,
    new_quantity,
    reason,
    created_by
  )
  VALUES (
    level_record.product_id,
    level_record.warehouse_id,
    movement_type_param::public.stock_movement_type,
    movement_quantity,
    level_record.current_quantity,
    new_quantity,
    trim(reason_param),
    acting_user
  )
  RETURNING id INTO movement_id;

  -- Alert that matches the new quantity: critical at 0, low up to the minimum, none above it.
  -- Any other active alert of this level is closed (restocked or moved to the other state).
  desired_alert := CASE
    WHEN new_quantity = 0 THEN 'stock_critico'
    WHEN new_quantity <= level_record.minimum_quantity THEN 'stock_bajo'
    ELSE NULL
  END;

  UPDATE public.stock_alerts
  SET is_active = false, resolved_at = now()
  WHERE stock_level_id = level_record.id
    AND is_active = true
    AND alert_type::TEXT IS DISTINCT FROM desired_alert;

  IF desired_alert IS NOT NULL THEN
    PERFORM public.create_stock_alert_if_needed(
      level_record.id,
      level_record.product_id,
      level_record.warehouse_id,
      desired_alert::public.stock_alert_type
    );
  END IF;

  RETURN jsonb_build_object(
    'movement_id', movement_id,
    'previous_quantity', level_record.current_quantity,
    'new_quantity', new_quantity,
    'quantity', movement_quantity
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.transfer_stock_between_warehouses(product_id_param uuid, from_warehouse_id_param uuid, to_warehouse_id_param uuid, quantity_param numeric, reason_param text, user_id_param uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  product_record RECORD;
  from_warehouse RECORD;
  to_warehouse RECORD;
  from_stock RECORD;
  to_stock RECORD;
BEGIN
  IF product_id_param IS NULL
    OR from_warehouse_id_param IS NULL
    OR to_warehouse_id_param IS NULL
    OR user_id_param IS NULL
    OR quantity_param IS NULL
  THEN
    RAISE EXCEPTION 'product, warehouses, quantity and user are required';
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() <> user_id_param THEN
    RAISE EXCEPTION 'User does not match the authenticated session';
  END IF;

  IF quantity_param <= 0 THEN
    RAISE EXCEPTION 'Transfer quantity must be positive';
  END IF;

  IF from_warehouse_id_param = to_warehouse_id_param THEN
    RAISE EXCEPTION 'Source and destination warehouses must be different';
  END IF;

  IF length(trim(COALESCE(reason_param, ''))) = 0 THEN
    RAISE EXCEPTION 'Transfer reason is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = user_id_param
      AND role IN ('admin', 'manager')
  ) THEN
    RAISE EXCEPTION 'User not allowed to transfer stock';
  END IF;

  SELECT * INTO product_record
  FROM public.stock_products
  WHERE id = product_id_param
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active stock product not found';
  END IF;

  SELECT * INTO from_warehouse
  FROM public.stock_warehouses
  WHERE id = from_warehouse_id_param
    AND is_active = true;

  SELECT * INTO to_warehouse
  FROM public.stock_warehouses
  WHERE id = to_warehouse_id_param
    AND is_active = true;

  IF from_warehouse.id IS NULL OR to_warehouse.id IS NULL THEN
    RAISE EXCEPTION 'Both warehouses must be active';
  END IF;

  IF from_warehouse.sede_id <> to_warehouse.sede_id THEN
    RAISE EXCEPTION 'Transfers between sedes are not allowed in this phase';
  END IF;

  IF product_record.sede_id <> from_warehouse.sede_id THEN
    RAISE EXCEPTION 'Product and warehouses must belong to the same sede';
  END IF;

  INSERT INTO public.stock_levels (product_id, warehouse_id, current_quantity, minimum_quantity, target_quantity, updated_by)
  VALUES (product_id_param, to_warehouse_id_param, 0, 0, 0, user_id_param)
  ON CONFLICT (product_id, warehouse_id) DO NOTHING;

  PERFORM public.lock_stock_bag_sede(from_warehouse.sede_id);
  IF EXISTS(SELECT 1 FROM public.stock_bag_accounting_config c JOIN public.stock_bag_accounting_sources s USING(sede_id)
    WHERE c.active AND s.product_id=product_id_param AND c.central_id IN (from_warehouse_id_param,to_warehouse_id_param)) THEN
    RAISE EXCEPTION 'Los traslados se habilitan al cerrar el arranque provisional y abrir el circuito físico';
  END IF;
  SELECT * INTO from_stock
  FROM public.stock_levels
  WHERE product_id = product_id_param
    AND warehouse_id = from_warehouse_id_param
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source stock level not found';
  END IF;

  IF from_stock.current_quantity < quantity_param THEN
    RAISE EXCEPTION 'Insufficient stock in source warehouse';
  END IF;

  SELECT * INTO to_stock
  FROM public.stock_levels
  WHERE product_id = product_id_param
    AND warehouse_id = to_warehouse_id_param
  FOR UPDATE;

  UPDATE public.stock_levels
  SET
    current_quantity = current_quantity - quantity_param,
    updated_by = user_id_param
  WHERE id = from_stock.id;

  UPDATE public.stock_levels
  SET
    current_quantity = current_quantity + quantity_param,
    updated_by = user_id_param
  WHERE id = to_stock.id;

  INSERT INTO public.stock_movements (
    product_id,
    warehouse_id,
    to_warehouse_id,
    movement_type,
    quantity,
    previous_quantity,
    new_quantity,
    to_previous_quantity,
    to_new_quantity,
    reason,
    created_by
  )
  VALUES (
    product_id_param,
    from_warehouse_id_param,
    to_warehouse_id_param,
    'transferencia',
    quantity_param,
    from_stock.current_quantity,
    from_stock.current_quantity - quantity_param,
    to_stock.current_quantity,
    to_stock.current_quantity + quantity_param,
    trim(reason_param),
    user_id_param
  );

  IF from_stock.current_quantity - quantity_param <= from_stock.minimum_quantity THEN
    PERFORM public.create_stock_alert_if_needed(
      from_stock.id,
      product_id_param,
      from_warehouse_id_param,
      CASE
        WHEN from_stock.current_quantity - quantity_param = 0 THEN 'stock_critico'::public.stock_alert_type
        ELSE 'stock_bajo'::public.stock_alert_type
      END
    );
  END IF;

  RETURN jsonb_build_object(
    'product_id', product_id_param,
    'from_warehouse_id', from_warehouse_id_param,
    'to_warehouse_id', to_warehouse_id_param,
    'quantity', quantity_param,
    'from_quantity', from_stock.current_quantity - quantity_param,
    'to_quantity', to_stock.current_quantity + quantity_param
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.apply_laundry_receipt_operation(_link uuid, _worker uuid, _admin uuid, _actor_name text, _date date, _op_id uuid, _payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE result jsonb; c public.laundry_cycle_config; r public.laundry_receipts; l public.laundry_receipt_links;
 old public.laundry_cycle_receipt_postings; item record; current_pool numeric; delta numeric; matched numeric; new_pooled numeric; key text; previous_counts jsonb; reject_delta numeric; new_rejected numeric; new_quarantined numeric; quarantine_balance numeric; returned numeric;
BEGIN
 -- Same lock order as mutate_laundry_receipt: receipt link, configuration,
 -- then stock. Taking configuration only after the legacy stock write would
 -- deadlock with route delivery or cleaner completion.
 SELECT * INTO STRICT l FROM public.laundry_receipt_links WHERE id=_link FOR UPDATE;
 PERFORM public.lock_stock_bag_sede((SELECT sede_id FROM public.stock_warehouses WHERE id=l.warehouse_id));
 SELECT * INTO c FROM public.laundry_cycle_config WHERE central_id=l.warehouse_id AND active FOR UPDATE;
 SELECT * INTO r FROM public.laundry_receipts WHERE link_id=_link AND receipt_date=_date FOR UPDATE;
 -- Pre-opening confirmed quantities are already included in the absolute count.
 -- Editing them now would apply an old delta a second time. Metadata corrections
 -- remain allowed, but physical changes require a fresh explicit stock count.
 IF c.sede_id IS NOT NULL AND r.latest_version>0 AND NOT EXISTS(SELECT 1 FROM public.laundry_cycle_receipt_postings WHERE receipt_id=r.id) THEN
  SELECT snapshot->'counts' INTO previous_counts FROM public.laundry_receipt_versions WHERE receipt_id=r.id AND version=r.latest_version;
  IF _payload->>'action'='confirm' AND r.counts IS DISTINCT FROM previous_counts THEN RAISE EXCEPTION 'Esta recepción es anterior al recuento inicial: corrige las existencias mediante un recuento físico'; END IF;
  result:=public.apply_laundry_receipt_operation_before_cycle(_link,_worker,_admin,_actor_name,_date,_op_id,_payload);
  RETURN result;
 END IF;
 result:=public.apply_laundry_receipt_operation_before_cycle(_link,_worker,_admin,_actor_name,_date,_op_id,_payload);
 IF _payload->>'action'<>'confirm' OR coalesce((result->>'unchanged')::boolean,false) THEN RETURN result; END IF;
 SELECT * INTO l FROM public.laundry_receipt_links WHERE id=_link;
 SELECT * INTO c FROM public.laundry_cycle_config WHERE central_id=l.warehouse_id AND active FOR UPDATE;
 IF c.sede_id IS NULL THEN RETURN result; END IF;
 key:='receipt:'||(result->>'versionId');
 IF EXISTS(SELECT 1 FROM public.laundry_cycle_events WHERE operation_key=key) THEN RETURN result; END IF;
 SELECT * INTO STRICT r FROM public.laundry_receipts WHERE link_id=_link AND receipt_date=_date FOR UPDATE;
 FOR item IN SELECT j.key material,j.value::uuid product FROM jsonb_each_text(r.product_map) j WHERE EXISTS(SELECT 1 FROM public.laundry_cycle_products p WHERE p.sede_id=c.sede_id AND p.product_id=j.value::uuid) ORDER BY j.value LOOP
  SELECT * INTO old FROM public.laundry_cycle_receipt_postings WHERE receipt_id=r.id AND product_id=item.product FOR UPDATE;
  INSERT INTO public.laundry_cycle_pool(sede_id,product_id,quantity) VALUES(c.sede_id,item.product,0) ON CONFLICT DO NOTHING;
  SELECT quantity INTO current_pool FROM public.laundry_cycle_pool WHERE sede_id=c.sede_id AND product_id=item.product FOR UPDATE;
  delta:=coalesce((r.counts->>item.material)::numeric,0)-coalesce(old.accepted,0);
  IF delta>=0 THEN
   matched:=least(delta,current_pool); new_pooled:=coalesce(old.pooled,0)+matched;
   IF matched<delta AND c.strict_receipts THEN RAISE EXCEPTION 'La ropa recibida supera lo registrado en lavandería; revisa el recuento pendiente'; END IF;
   IF matched<delta THEN
    INSERT INTO public.laundry_cycle_issues(sede_id,task_key,code,detail)
    VALUES(c.sede_id,NULL,'unmatched_receipt','Recepción real por encima del lavado registrado; conciliar cantidades sin atribuirla a una propiedad')
    ON CONFLICT(sede_id,task_key,code) DO UPDATE SET detail=EXCLUDED.detail,resolved_at=NULL;
   END IF;
   current_pool:=current_pool-matched;
  ELSE
   new_pooled:=least(coalesce(old.pooled,0),coalesce((r.counts->>item.material)::numeric,0));
   current_pool:=current_pool+coalesce(old.pooled,0)-new_pooled;
  END IF;
  new_rejected:=coalesce((r.discarded_counts->>item.material)::numeric,0);
  reject_delta:=new_rejected-coalesce(old.rejected,0); new_quarantined:=coalesce(old.quarantined,0);
  IF c.rejection_mode='central' AND reject_delta<>0 THEN
   INSERT INTO public.laundry_rejected_stock(product_id,warehouse_id,current_quantity) VALUES(item.product,c.central_id,0) ON CONFLICT DO NOTHING;
   SELECT current_quantity INTO quarantine_balance FROM public.laundry_rejected_stock WHERE product_id=item.product AND warehouse_id=c.central_id FOR UPDATE;
   IF reject_delta>0 THEN
    matched:=least(reject_delta,current_pool);
    IF matched<reject_delta AND c.strict_receipts THEN RAISE EXCEPTION 'Las prendas rechazadas superan lo pendiente registrado'; END IF;
    IF matched<reject_delta THEN INSERT INTO public.laundry_cycle_issues(sede_id,task_key,code,detail) VALUES(c.sede_id,NULL,'unmatched_receipt','Ropa recibida o rechazada por encima del lavado registrado; conciliar el recuento conjunto') ON CONFLICT(sede_id,task_key,code) DO UPDATE SET detail=EXCLUDED.detail,resolved_at=NULL; END IF;
    current_pool:=current_pool-matched; quarantine_balance:=quarantine_balance+reject_delta;new_quarantined:=new_quarantined+reject_delta;
   ELSE
    returned:=least(-reject_delta,new_quarantined); IF returned>quarantine_balance THEN RAISE EXCEPTION 'La rechazada disponible cambió: revisa sus envíos'; END IF;
    quarantine_balance:=quarantine_balance-returned;current_pool:=current_pool+returned;new_quarantined:=new_quarantined-returned;
   END IF;
   UPDATE public.laundry_rejected_stock SET current_quantity=quarantine_balance WHERE product_id=item.product AND warehouse_id=c.central_id;
  END IF;
  UPDATE public.laundry_cycle_pool SET quantity=current_pool WHERE sede_id=c.sede_id AND product_id=item.product;
  INSERT INTO public.laundry_cycle_receipt_postings(receipt_id,product_id,sede_id,accepted,pooled,rejected,quarantined)
  VALUES(r.id,item.product,c.sede_id,coalesce((r.counts->>item.material)::numeric,0),new_pooled,new_rejected,new_quarantined)
  ON CONFLICT(receipt_id,product_id) DO UPDATE SET accepted=EXCLUDED.accepted,pooled=EXCLUDED.pooled,rejected=EXCLUDED.rejected,quarantined=EXCLUDED.quarantined;
 END LOOP;
 -- Rejected linen remains owned: held apart centrally until dispatch, or
 -- pending at the supplier according to the configured physical operation.
 -- Existing discarded_counts records each attempt; it never creates clean
 -- stock, destroys units, or claims that this mixed return belongs to a bag.
 INSERT INTO public.laundry_cycle_events(operation_key,sede_id,kind,payload)
 VALUES(key,c.sede_id,'pooled_receipt',jsonb_build_object('receiptId',r.id,'accepted',r.counts,'reportedDiscards',r.discarded_counts));
 RETURN result;
END $function$;

CREATE OR REPLACE FUNCTION public.apply_laundry_receipt_operation_before_cycle(_link uuid, _worker uuid, _admin uuid, _actor_name text, _date date, _op_id uuid, _payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE l public.laundry_receipt_links; r public.laundry_receipts; prior public.laundry_receipt_operations; before_counts jsonb; before_discards jsonb; k text; qty bigint; action text; expected integer; undo public.laundry_receipt_operations; v public.laundry_receipt_versions; old_counts jsonb; p uuid; delta numeric; balance numeric; mid uuid; mids uuid[]:='{}'; stock_exclusions jsonb:='[]'; result jsonb; version_id uuid;
BEGIN
  SELECT * INTO STRICT l FROM public.laundry_receipt_links WHERE id=_link FOR UPDATE;
  IF (_worker IS NULL)=(_admin IS NULL) THEN RAISE EXCEPTION 'Actor inválido' USING ERRCODE='28000'; END IF;
  SELECT * INTO prior FROM public.laundry_receipt_operations WHERE id=_op_id;
  IF prior.id IS NOT NULL THEN
    IF prior.worker_id IS DISTINCT FROM _worker OR prior.admin_user_id IS DISTINCT FROM _admin OR prior.payload<>_payload OR NOT EXISTS(SELECT 1 FROM public.laundry_receipts WHERE id=prior.receipt_id AND link_id=l.id AND receipt_date=_date) THEN RAISE EXCEPTION 'Identificador de operación ya utilizado'; END IF;
    RETURN prior.result;
  END IF;
  action:=_payload->>'action';
  IF _date>(now() AT TIME ZONE 'Europe/Madrid')::date OR _date IS NULL OR _date<'0001-01-01'::date THEN RAISE EXCEPTION 'Fecha inválida'; END IF;
  IF action='start' THEN
    INSERT INTO public.laundry_receipts(link_id,receipt_date,product_map) VALUES(l.id,_date,l.product_map) ON CONFLICT(link_id,receipt_date) DO NOTHING;
  END IF;
  SELECT * INTO STRICT r FROM public.laundry_receipts WHERE link_id=l.id AND receipt_date=_date FOR UPDATE;
  before_counts:=r.counts; before_discards:=r.discarded_counts;
  -- Extend in-memory only: immutable historical snapshots/undo payloads stay untouched.
  r.counts:='{"suite_sheets":0}'::jsonb || r.counts;
  r.discarded_counts:='{"suite_sheets":0}'::jsonb || r.discarded_counts;
  IF NOT r.product_map ? 'suite_sheets' AND l.product_map ? 'suite_sheets' THEN
    r.product_map:=r.product_map || jsonb_build_object('suite_sheets',l.product_map->'suite_sheets');
  END IF;
  expected:=(_payload->>'expectedRevision')::integer;
  IF action IN ('set','set_discard','notes','undo','confirm') AND (expected IS NULL OR expected<>r.revision) THEN RAISE EXCEPTION 'El recuento ha cambiado. Revisa el total actualizado.' USING ERRCODE='40001'; END IF;
  IF action IN ('add','set','add_discard','set_discard') THEN
    k:=_payload->>'material';
    IF NOT k=ANY(public.laundry_receipt_keys()) OR k IS NULL OR coalesce(_payload->>'quantity','') !~ '^[0-9]{1,9}$' THEN RAISE EXCEPTION 'Cantidad o material inválido'; END IF;
    IF k='suite_sheets' AND NOT r.product_map ? k THEN RAISE EXCEPTION 'Sábanas de suite pendientes de configurar. Contacta con administración.'; END IF;
    qty:=(_payload->>'quantity')::bigint;
    IF action='add' THEN qty:=qty+(r.counts->>k)::bigint; ELSIF action='add_discard' THEN qty:=qty+(r.discarded_counts->>k)::bigint; END IF;
    IF qty>999999999 THEN RAISE EXCEPTION 'Cantidad demasiado grande'; END IF;
    IF action IN ('add_discard','set_discard') THEN r.discarded_counts:=jsonb_set(r.discarded_counts,ARRAY[k],to_jsonb(qty)); ELSE r.counts:=jsonb_set(r.counts,ARRAY[k],to_jsonb(qty)); END IF;
  ELSIF action='notes' THEN
    IF length(coalesce(_payload->>'notes',''))>2000 THEN RAISE EXCEPTION 'Observación demasiado larga'; END IF;
    r.notes:=coalesce(_payload->>'notes','');
  ELSIF action='undo' THEN
    SELECT * INTO STRICT undo FROM public.laundry_receipt_operations WHERE id=(_payload->>'targetId')::uuid AND receipt_id=r.id AND payload->>'action' IN ('add','set','add_discard','set_discard');
    IF (undo.result->>'revision')::integer<>r.revision THEN RAISE EXCEPTION 'Solo se puede deshacer la última suma o corrección. Revisa el total.'; END IF;
    IF undo.payload->>'action' IN ('add_discard','set_discard') THEN r.discarded_counts:=undo.previous_discarded_counts; ELSE r.counts:=undo.previous_counts; END IF;
  ELSIF action='confirm' THEN
    SELECT * INTO v FROM public.laundry_receipt_versions WHERE receipt_id=r.id AND version=r.latest_version;
    old_counts:='{"suite_sheets":0}'::jsonb || coalesce(v.snapshot->'counts',before_counts);
    IF r.latest_version=0 THEN old_counts:=(SELECT jsonb_object_agg(key,0) FROM jsonb_each(r.counts)); END IF;
    IF r.latest_version>0 AND r.counts=old_counts AND r.notes=v.snapshot->>'notes' AND r.discarded_counts=('{"suite_sheets":0}'::jsonb || coalesce(v.snapshot->'discarded_counts','{"double_sheets":0,"single_sheets":0,"pillowcases":0,"bath_towels":0,"hand_towels":0,"bath_mats":0,"duvets":0,"mattress_protectors":0,"pillows":0}'::jsonb)) THEN
      result:=jsonb_build_object('versionId',v.id,'revision',r.revision,'unchanged',true);
    ELSE
      IF NOT EXISTS(SELECT 1 FROM jsonb_each_text(r.counts) WHERE value::bigint>0) AND NOT EXISTS(SELECT 1 FROM jsonb_each_text(r.discarded_counts) WHERE value::bigint>0) AND r.latest_version=0 THEN RAISE EXCEPTION 'Añade ropa aceptada o descartes antes de confirmar'; END IF;
      -- Lock levels in product-id order, including no-delta products: deterministic lock order.
      FOR k,p IN SELECT key,value::uuid FROM jsonb_each_text(r.product_map) ORDER BY value LOOP
        IF NOT EXISTS(SELECT 1 FROM public.stock_products sp JOIN public.stock_categories sc ON sc.id=sp.category_id WHERE sp.id=p AND sp.is_active AND sc.kind='laundry') THEN RAISE EXCEPTION 'Producto desactivado. Contacta con administración.'; END IF;
        delta:=coalesce((r.counts->>k)::numeric,0)-coalesce((old_counts->>k)::numeric,0);
        IF delta=0 THEN CONTINUE; END IF;
        IF EXISTS(SELECT 1 FROM public.stock_bag_accounting_config bc WHERE bc.central_id=l.warehouse_id AND bc.active AND (
          r.receipt_date<bc.start_date OR EXISTS(SELECT 1 FROM public.stock_levels sl WHERE sl.warehouse_id=l.warehouse_id AND sl.product_id=p AND sl.quantity_basis='counted'
            AND (r.receipt_date<(sl.counted_at AT TIME ZONE 'Europe/Madrid')::date OR EXISTS(SELECT 1 FROM public.laundry_receipt_versions oldv WHERE oldv.receipt_id=r.id AND oldv.version=r.latest_version AND oldv.created_at<=sl.counted_at))))) THEN
          stock_exclusions:=stock_exclusions||jsonb_build_array(jsonb_build_object('productId',p,'delta',delta,'reason','Entrada anterior a la apertura o incluida en un recuento físico'));
          CONTINUE;
        END IF;
        INSERT INTO public.stock_levels(product_id,warehouse_id,current_quantity,minimum_quantity,target_quantity) VALUES(p,l.warehouse_id,0,0,0) ON CONFLICT(product_id,warehouse_id) DO NOTHING;
        SELECT current_quantity INTO STRICT balance FROM public.stock_levels WHERE product_id=p AND warehouse_id=l.warehouse_id FOR UPDATE;
        IF balance+delta<0 AND NOT EXISTS(SELECT 1 FROM public.stock_levels WHERE product_id=p AND warehouse_id=l.warehouse_id AND quantity_basis='partial') THEN RAISE EXCEPTION 'La corrección dejaría stock negativo. Administración debe revisar los movimientos posteriores.'; END IF;
        IF delta<>0 THEN
          UPDATE public.stock_levels SET current_quantity=balance+delta,last_updated=now(),updated_by=NULL WHERE product_id=p AND warehouse_id=l.warehouse_id;
          INSERT INTO public.stock_movements(product_id,warehouse_id,movement_type,quantity,previous_quantity,new_quantity,reason)
          VALUES(p,l.warehouse_id,CASE WHEN delta>0 THEN 'entrada'::public.stock_movement_type ELSE 'salida'::public.stock_movement_type END,abs(delta),balance,balance+delta,format('Recepción %s v%s · %s · empleado %s',r.receipt_date,r.latest_version+1,r.id,coalesce(_worker,_admin))) RETURNING id INTO mid;
          mids:=array_append(mids,mid);
        END IF;
      END LOOP;
      INSERT INTO public.laundry_receipt_versions(receipt_id,version,revision,worker_id,admin_user_id,movement_ids,snapshot)
      VALUES(r.id,r.latest_version+1,r.revision,_worker,_admin,mids,jsonb_build_object('receipt_date',r.receipt_date,'warehouse_name',(SELECT name FROM public.stock_warehouses WHERE id=l.warehouse_id),'version',r.latest_version+1,'worker_name',_actor_name,'admin_user_id',_admin,'confirmed_at',now(),'counts',r.counts,'discarded_counts',r.discarded_counts,'notes',r.notes,'stock_posting_exclusions',stock_exclusions)) RETURNING id INTO version_id;
      INSERT INTO public.laundry_receipt_emails(version_id) VALUES(version_id);
      r.latest_version:=r.latest_version+1;
      result:=jsonb_build_object('versionId',version_id,'revision',r.revision,'unchanged',false);
    END IF;
  ELSIF action<>'start' OR action IS NULL THEN RAISE EXCEPTION 'Acción inválida'; END IF;
  IF action IN ('add','set','add_discard','set_discard','notes','undo') THEN r.revision:=r.revision+1; END IF;
  UPDATE public.laundry_receipts SET product_map=r.product_map,counts=r.counts,discarded_counts=r.discarded_counts,notes=r.notes,revision=r.revision,latest_version=r.latest_version,updated_at=now() WHERE id=r.id;
  result:=coalesce(result,jsonb_build_object('revision',r.revision));
  INSERT INTO public.laundry_receipt_operations(id,receipt_id,worker_id,admin_user_id,payload,previous_counts,previous_discarded_counts,result) VALUES(_op_id,r.id,_worker,_admin,_payload,before_counts,before_discards,result);
  RETURN result;
END $function$;
COMMIT;
