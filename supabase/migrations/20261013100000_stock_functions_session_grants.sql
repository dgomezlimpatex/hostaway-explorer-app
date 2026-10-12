-- Restore EXECUTE for authenticated users on the stock functions the app calls directly.
-- A bulk hardening left these SECURITY DEFINER functions executable only by postgres and
-- service_role, so Transfer, editing minimum/target/cost and creating/choosing the main
-- warehouse fail with "permission denied" in the app.
--
-- create_stock_warehouse and set_default_stock_warehouse already use auth.uid() and check
-- admin/manager: only their EXECUTE grant is restored (bodies unchanged).
-- transfer_stock_between_warehouses and update_stock_level_settings trusted the user_id sent by
-- the browser: they are redefined with the same body plus one guard that requires it to match
-- the authenticated session (service_role calls, which have no session, keep working).
-- anon and PUBLIC stay without access. process_stock_consumption_for_task is intentionally NOT
-- re-granted: automatic consumption now runs server-side (cron estimated-amenities-consumption).

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

CREATE OR REPLACE FUNCTION public.update_stock_level_settings(stock_level_id_param uuid, minimum_quantity_param numeric, target_quantity_param numeric, cost_per_unit_param numeric, user_id_param uuid)
 RETURNS stock_levels
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  updated_level public.stock_levels;
BEGIN
  IF stock_level_id_param IS NULL OR user_id_param IS NULL THEN
    RAISE EXCEPTION 'stock_level_id and user_id are required';
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() <> user_id_param THEN
    RAISE EXCEPTION 'User does not match the authenticated session';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = user_id_param
      AND role IN ('admin', 'manager')
  ) THEN
    RAISE EXCEPTION 'User not allowed to update stock settings';
  END IF;

  IF COALESCE(minimum_quantity_param, 0) < 0
    OR COALESCE(target_quantity_param, 0) < 0
    OR (cost_per_unit_param IS NOT NULL AND cost_per_unit_param < 0)
  THEN
    RAISE EXCEPTION 'Quantities and cost must be non-negative';
  END IF;

  IF COALESCE(target_quantity_param, 0) < COALESCE(minimum_quantity_param, 0) THEN
    RAISE EXCEPTION 'Target quantity must be greater than or equal to minimum quantity';
  END IF;

  UPDATE public.stock_levels
  SET
    minimum_quantity = COALESCE(minimum_quantity_param, 0),
    target_quantity = COALESCE(target_quantity_param, 0),
    cost_per_unit = cost_per_unit_param,
    updated_by = user_id_param
  WHERE id = stock_level_id_param
  RETURNING * INTO updated_level;

  IF updated_level.id IS NULL THEN
    RAISE EXCEPTION 'Stock level not found';
  END IF;

  RETURN updated_level;
END;
$function$;

REVOKE ALL ON FUNCTION public.transfer_stock_between_warehouses(UUID, UUID, UUID, NUMERIC, TEXT, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_stock_level_settings(UUID, NUMERIC, NUMERIC, NUMERIC, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_stock_warehouse(UUID, TEXT, TEXT, BOOLEAN, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_default_stock_warehouse(UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.transfer_stock_between_warehouses(UUID, UUID, UUID, NUMERIC, TEXT, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_stock_level_settings(UUID, NUMERIC, NUMERIC, NUMERIC, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_stock_warehouse(UUID, TEXT, TEXT, BOOLEAN, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_default_stock_warehouse(UUID) TO authenticated, service_role;
