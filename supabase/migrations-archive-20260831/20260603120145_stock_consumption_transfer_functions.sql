-- Atomic stock functions for the new stock_* inventory module.
-- Legacy inventory_* functions are intentionally left untouched.

CREATE UNIQUE INDEX IF NOT EXISTS stock_movements_auto_consumption_once
ON public.stock_movements(task_id, product_id, warehouse_id)
WHERE movement_type = 'consumo_automatico';

CREATE OR REPLACE FUNCTION public.create_stock_alert_if_needed(
  stock_level_id_param UUID,
  product_id_param UUID,
  warehouse_id_param UUID,
  alert_type_param public.stock_alert_type
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  INSERT INTO public.stock_alerts (
    stock_level_id,
    product_id,
    warehouse_id,
    alert_type
  )
  SELECT
    stock_level_id_param,
    product_id_param,
    warehouse_id_param,
    alert_type_param
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.stock_alerts a
    WHERE a.stock_level_id = stock_level_id_param
      AND a.alert_type = alert_type_param
      AND a.is_active = true
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.process_stock_consumption_for_task(
  task_id_param UUID,
  property_id_param UUID,
  user_id_param UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  property_data RECORD;
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
    'consumed', consumed_count,
    'skipped', skipped_count,
    'alerts', alert_count
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.transfer_stock_between_warehouses(
  product_id_param UUID,
  from_warehouse_id_param UUID,
  to_warehouse_id_param UUID,
  quantity_param NUMERIC,
  reason_param TEXT,
  user_id_param UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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

GRANT EXECUTE ON FUNCTION public.create_stock_alert_if_needed(UUID, UUID, UUID, public.stock_alert_type) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.process_stock_consumption_for_task(UUID, UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.transfer_stock_between_warehouses(UUID, UUID, UUID, NUMERIC, TEXT, UUID) TO authenticated, service_role;
