-- Atomic warehouse operations for the new stock module.

CREATE OR REPLACE FUNCTION public.create_stock_warehouse(
  sede_id_param UUID,
  name_param TEXT,
  address_param TEXT DEFAULT NULL,
  is_default_param BOOLEAN DEFAULT false,
  sort_order_param INTEGER DEFAULT 0
)
RETURNS public.stock_warehouses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  new_warehouse public.stock_warehouses;
BEGIN
  IF sede_id_param IS NULL THEN
    RAISE EXCEPTION 'La sede es obligatoria';
  END IF;

  IF length(trim(COALESCE(name_param, ''))) = 0 THEN
    RAISE EXCEPTION 'El nombre del almacen es obligatorio';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'No tienes permisos para crear almacenes';
  END IF;

  IF is_default_param THEN
    UPDATE public.stock_warehouses
    SET is_default = false
    WHERE sede_id = sede_id_param
      AND is_default = true;
  END IF;

  INSERT INTO public.stock_warehouses (
    sede_id,
    name,
    address,
    is_default,
    sort_order
  )
  VALUES (
    sede_id_param,
    trim(name_param),
    NULLIF(trim(COALESCE(address_param, '')), ''),
    COALESCE(is_default_param, false),
    COALESCE(sort_order_param, 0)
  )
  RETURNING * INTO new_warehouse;

  INSERT INTO public.stock_levels (
    product_id,
    warehouse_id,
    current_quantity,
    minimum_quantity,
    target_quantity
  )
  SELECT
    p.id,
    new_warehouse.id,
    0,
    0,
    0
  FROM public.stock_products p
  WHERE p.sede_id = sede_id_param
    AND p.is_active = true
  ON CONFLICT (product_id, warehouse_id) DO NOTHING;

  RETURN new_warehouse;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_default_stock_warehouse(
  warehouse_id_param UUID
)
RETURNS public.stock_warehouses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  target_warehouse public.stock_warehouses;
BEGIN
  IF warehouse_id_param IS NULL THEN
    RAISE EXCEPTION 'El almacen es obligatorio';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'No tienes permisos para cambiar el almacen principal';
  END IF;

  SELECT * INTO target_warehouse
  FROM public.stock_warehouses
  WHERE id = warehouse_id_param
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Almacen no encontrado';
  END IF;

  UPDATE public.stock_warehouses
  SET is_default = false
  WHERE sede_id = target_warehouse.sede_id
    AND is_default = true;

  UPDATE public.stock_warehouses
  SET is_default = true
  WHERE id = warehouse_id_param
  RETURNING * INTO target_warehouse;

  RETURN target_warehouse;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_stock_warehouse(UUID, TEXT, TEXT, BOOLEAN, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_default_stock_warehouse(UUID) TO authenticated, service_role;
