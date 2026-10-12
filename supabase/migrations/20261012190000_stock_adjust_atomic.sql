-- Atomic manual stock adjustment (entrada / salida / ajuste).
-- Replaces the client-side read-modify-write in stockStorage.adjustStock, which could
-- overwrite concurrent consumption and could change stock without leaving a movement.
-- Only adds one function: no table, policy, trigger or data is changed.

CREATE OR REPLACE FUNCTION public.adjust_stock_level(
  stock_level_id_param UUID,
  movement_type_param TEXT,
  quantity_param NUMERIC,
  reason_param TEXT,
  cost_per_unit_param NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  acting_user UUID := auth.uid();
  level_record RECORD;
  new_quantity NUMERIC(12, 2);
  movement_quantity NUMERIC(12, 2);
  movement_id UUID;
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

  IF new_quantity <= level_record.minimum_quantity THEN
    PERFORM public.create_stock_alert_if_needed(
      level_record.id,
      level_record.product_id,
      level_record.warehouse_id,
      CASE
        WHEN new_quantity = 0 THEN 'stock_critico'::public.stock_alert_type
        ELSE 'stock_bajo'::public.stock_alert_type
      END
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

REVOKE ALL ON FUNCTION public.adjust_stock_level(UUID, TEXT, NUMERIC, TEXT, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adjust_stock_level(UUID, TEXT, NUMERIC, TEXT, NUMERIC) TO authenticated, service_role;
