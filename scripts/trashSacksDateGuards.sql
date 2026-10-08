-- Date guards for the new product only; existing permissions and function signatures preserved.
BEGIN;
CREATE OR REPLACE FUNCTION public.get_public_laundry_stock_consumptions(token_param text)
 RETURNS TABLE(task_id uuid, property_id uuid, product_id uuid, product_name text, unit_of_measure text, category_name text, category_kind stock_item_kind, quantity numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH valid_link AS (
    SELECT
      l.id,
      l.snapshot_task_ids
    FROM public.laundry_share_links l
    WHERE l.token = token_param
      AND l.is_active = true
      AND (l.expires_at IS NULL OR l.expires_at > now())
    LIMIT 1
  )
  SELECT
    t.id AS task_id,
    p.id AS property_id,
    sp.id AS product_id,
    sp.name::TEXT AS product_name,
    sp.unit_of_measure::TEXT AS unit_of_measure,
    sc.name::TEXT AS category_name,
    sc.kind AS category_kind,
    r.quantity_per_cleaning AS quantity
  FROM valid_link l
  JOIN public.tasks t ON t.id = ANY(l.snapshot_task_ids)
  JOIN public.properties p ON p.id = t.propiedad_id
  JOIN public.stock_property_consumption_rules r ON r.property_id = p.id
  JOIN public.stock_products sp ON sp.id = r.product_id
  LEFT JOIN public.stock_categories sc ON sc.id = sp.category_id
  WHERE r.is_active = true
    AND r.quantity_per_cleaning > 0
    AND sp.is_active = true
    AND sp.is_consumable = true
    AND (sp.sku IS DISTINCT FROM 'SACOS-BASURA-100L' OR t.date >= DATE '2026-10-09')
    AND sp.sede_id = p.sede_id
    AND COALESCE(sc.kind, 'other'::public.stock_item_kind) <> 'laundry'::public.stock_item_kind
  ORDER BY
    t.date,
    p.codigo,
    CASE
      WHEN lower(coalesce(sc.name, '')) LIKE '%consumible%' THEN 10
      WHEN sc.kind = 'amenity'::public.stock_item_kind THEN 20
      ELSE 30
    END,
    sp.sort_order,
    sp.name;
$function$
;
CREATE OR REPLACE FUNCTION public.process_stock_consumption_for_task(task_id_param uuid, property_id_param uuid, user_id_param uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  property_data RECORD;
  sede_settings RECORD;
  consumption_record RECORD;
  stock_record RECORD;
  warehouse_id_resolved UUID;
  movement_reason TEXT;
  quantity_to_consume NUMERIC(12, 2);
  consumed_count INTEGER := 0;
  skipped_count INTEGER := 0;
  alert_count INTEGER := 0;
BEGIN
  IF task_id_param IS NULL OR property_id_param IS NULL OR user_id_param IS NULL THEN
    RAISE EXCEPTION 'task_id, property_id and user_id are required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = user_id_param
      AND role IN ('admin', 'manager', 'supervisor', 'cleaner')
  ) THEN
    RAISE EXCEPTION 'User not allowed to process stock consumption';
  END IF;

  SELECT * INTO property_data
  FROM public.properties
  WHERE id = property_id_param;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Property not found';
  END IF;

  SELECT * INTO sede_settings
  FROM public.stock_sede_settings
  WHERE sede_id = property_data.sede_id;

  IF COALESCE(sede_settings.auto_consumption_enabled, false) = false
    OR COALESCE(sede_settings.preparation_mode, true) = true
  THEN
    RETURN jsonb_build_object(
      'disabled', true,
      'reason', 'stock_auto_consumption_disabled',
      'consumed', 0,
      'skipped', 0,
      'alerts', 0
    );
  END IF;

  movement_reason := 'Consumo automatico por tarea completada en ' || COALESCE(property_data.nombre, property_data.codigo, property_id_param::TEXT);

  FOR consumption_record IN
    SELECT
      r.product_id,
      r.warehouse_id,
      r.quantity_per_cleaning AS quantity
    FROM public.stock_property_consumption_rules r
    JOIN public.stock_products p ON p.id = r.product_id
    WHERE r.property_id = property_id_param
      AND r.is_active = true
      AND p.sede_id = property_data.sede_id
      AND p.is_active = true
      AND p.is_consumable = true
      AND (p.sku IS DISTINCT FROM 'SACOS-BASURA-100L' OR EXISTS (SELECT 1 FROM public.tasks sack_task WHERE sack_task.id = task_id_param AND sack_task.date >= DATE '2026-10-09'))

    UNION ALL

    SELECT
      m.product_id,
      m.warehouse_id,
      (
        CASE m.property_field
          WHEN 'numero_sabanas' THEN COALESCE(property_data.numero_sabanas, 0)
          WHEN 'numero_sabanas_pequenas' THEN COALESCE(property_data.numero_sabanas_pequenas, 0)
          WHEN 'numero_sabanas_suite' THEN COALESCE(property_data.numero_sabanas_suite, 0)
          WHEN 'numero_toallas_grandes' THEN COALESCE(property_data.numero_toallas_grandes, 0)
          WHEN 'numero_toallas_pequenas' THEN COALESCE(property_data.numero_toallas_pequenas, 0)
          WHEN 'numero_alfombrines' THEN COALESCE(property_data.numero_alfombrines, 0)
          WHEN 'numero_fundas_almohada' THEN COALESCE(property_data.numero_fundas_almohada, 0)
          WHEN 'amenities_bano' THEN COALESCE(property_data.amenities_bano, 0)
          WHEN 'amenities_cocina' THEN COALESCE(property_data.amenities_cocina, 0)
          WHEN 'cantidad_rollos_papel_higienico' THEN COALESCE(property_data.cantidad_rollos_papel_higienico, 0)
          WHEN 'cantidad_rollos_papel_cocina' THEN COALESCE(property_data.cantidad_rollos_papel_cocina, 0)
          WHEN 'kit_alimentario' THEN COALESCE(property_data.kit_alimentario, 0)
          WHEN 'bayetas_cocina' THEN COALESCE(property_data.bayetas_cocina, 0)
          WHEN 'bolsas_basura' THEN COALESCE(property_data.bolsas_basura, 0)
          ELSE 0
        END
      )::NUMERIC(12, 2) * m.multiplier AS quantity
    FROM public.stock_property_field_mappings m
    JOIN public.stock_products p ON p.id = m.product_id
    WHERE m.sede_id = property_data.sede_id
      AND m.is_active = true
      AND p.is_active = true
      AND p.is_consumable = true
      AND NOT EXISTS (
        SELECT 1
        FROM public.stock_property_consumption_rules r
        WHERE r.property_id = property_id_param
          AND r.product_id = m.product_id
          AND r.is_active = true
      )
  LOOP
    quantity_to_consume := COALESCE(consumption_record.quantity, 0);

    IF quantity_to_consume <= 0 THEN
      skipped_count := skipped_count + 1;
      CONTINUE;
    END IF;

    SELECT COALESCE(
      consumption_record.warehouse_id,
      property_data.default_stock_warehouse_id,
      (
        SELECT w.id
        FROM public.stock_warehouses w
        WHERE w.sede_id = property_data.sede_id
          AND w.is_default = true
          AND w.is_active = true
        LIMIT 1
      )
    )
    INTO warehouse_id_resolved;

    IF warehouse_id_resolved IS NULL THEN
      RAISE EXCEPTION 'No default stock warehouse found for property %', property_id_param;
    END IF;

    INSERT INTO public.stock_levels (product_id, warehouse_id, current_quantity, minimum_quantity, target_quantity, updated_by)
    VALUES (consumption_record.product_id, warehouse_id_resolved, 0, 0, 0, user_id_param)
    ON CONFLICT (product_id, warehouse_id) DO NOTHING;

    SELECT * INTO stock_record
    FROM public.stock_levels
    WHERE product_id = consumption_record.product_id
      AND warehouse_id = warehouse_id_resolved
    FOR UPDATE;

    IF EXISTS (
      SELECT 1
      FROM public.stock_movements sm
      WHERE sm.task_id = task_id_param
        AND sm.product_id = consumption_record.product_id
        AND sm.warehouse_id = warehouse_id_resolved
        AND sm.movement_type = 'consumo_automatico'
    ) THEN
      skipped_count := skipped_count + 1;
      CONTINUE;
    END IF;

    IF stock_record.current_quantity < quantity_to_consume THEN
      PERFORM public.create_stock_alert_if_needed(
        stock_record.id,
        consumption_record.product_id,
        warehouse_id_resolved,
        'stock_critico'
      );
      alert_count := alert_count + 1;
      skipped_count := skipped_count + 1;
      CONTINUE;
    END IF;

    UPDATE public.stock_levels
    SET
      current_quantity = current_quantity - quantity_to_consume,
      updated_by = user_id_param
    WHERE id = stock_record.id;

    INSERT INTO public.stock_movements (
      product_id,
      warehouse_id,
      movement_type,
      quantity,
      previous_quantity,
      new_quantity,
      reason,
      task_id,
      property_id,
      created_by
    )
    VALUES (
      consumption_record.product_id,
      warehouse_id_resolved,
      'consumo_automatico',
      quantity_to_consume,
      stock_record.current_quantity,
      stock_record.current_quantity - quantity_to_consume,
      movement_reason,
      task_id_param,
      property_id_param,
      user_id_param
    );

    consumed_count := consumed_count + 1;

    IF stock_record.current_quantity - quantity_to_consume <= stock_record.minimum_quantity THEN
      PERFORM public.create_stock_alert_if_needed(
        stock_record.id,
        consumption_record.product_id,
        warehouse_id_resolved,
        CASE
          WHEN stock_record.current_quantity - quantity_to_consume = 0 THEN 'stock_critico'::public.stock_alert_type
          ELSE 'stock_bajo'::public.stock_alert_type
        END
      );
      alert_count := alert_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'disabled', false,
    'consumed', consumed_count,
    'skipped', skipped_count,
    'alerts', alert_count
  );
END;
$function$
;
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
$function$
;
COMMIT;
