-- Ola 3: impedir que el almacén principal o una ubicación de otra sede se convierta en trastero de edificio.
CREATE OR REPLACE FUNCTION public.validate_supervision_stock_warehouse_location()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  building_sede UUID;
BEGIN
  IF NEW.property_group_id IS NULL THEN
    IF NEW.location_type = 'building_storage' THEN
      RAISE EXCEPTION 'building storage requires a property group';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.location_type <> 'building_storage' THEN
    RAISE EXCEPTION 'building property group requires building_storage location type';
  END IF;
  IF NEW.is_default THEN
    RAISE EXCEPTION 'default central warehouse cannot be assigned to a building';
  END IF;

  SELECT p.sede_id INTO building_sede
  FROM public.property_group_assignments pga
  JOIN public.properties p ON p.id = pga.property_id
  WHERE pga.property_group_id = NEW.property_group_id
  LIMIT 1;
  IF building_sede IS NULL OR NEW.sede_id IS DISTINCT FROM building_sede THEN
    RAISE EXCEPTION 'stock warehouse and building must belong to the same sede';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_supervision_stock_warehouse_location ON public.stock_warehouses;
CREATE TRIGGER trg_validate_supervision_stock_warehouse_location
BEFORE INSERT OR UPDATE OF property_group_id, location_type, is_default, sede_id
ON public.stock_warehouses
FOR EACH ROW EXECUTE FUNCTION public.validate_supervision_stock_warehouse_location();

REVOKE ALL ON FUNCTION public.validate_supervision_stock_warehouse_location() FROM PUBLIC, anon, authenticated;
