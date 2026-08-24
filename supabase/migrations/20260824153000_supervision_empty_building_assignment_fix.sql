-- Fix: permitir configurar la supervisora antes de vincular propiedades al edificio.
-- Cuando el edificio ya tiene propiedades, se mantiene la comprobación por sede.
-- Al vincular una propiedad posteriormente, se valida que todas las supervisoras
-- activas del edificio tengan acceso a la sede de esa propiedad.

CREATE OR REPLACE FUNCTION public.supervision_building_has_sede_access(
  _property_group_id UUID,
  _user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.property_group_assignments pga
    JOIN public.properties p ON p.id = pga.property_id
    WHERE pga.property_group_id = _property_group_id
      AND NOT public.user_has_sede_access(_user_id, p.sede_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.validate_supervision_building_property_sede()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  property_sede UUID;
BEGIN
  SELECT p.sede_id INTO property_sede
  FROM public.properties p
  WHERE p.id = NEW.property_id;

  IF property_sede IS NULL THEN
    RAISE EXCEPTION 'supervision property must have a sede';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.supervision_building_supervisors a
    WHERE a.property_group_id = NEW.property_group_id
      AND a.is_active
      AND NOT public.user_has_sede_access(a.supervisor_user_id, property_sede)
  ) THEN
    RAISE EXCEPTION 'property sede is not accessible to an assigned supervision user';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_supervision_building_property_sede
  ON public.property_group_assignments;
CREATE TRIGGER trg_validate_supervision_building_property_sede
BEFORE INSERT OR UPDATE OF property_group_id, property_id
ON public.property_group_assignments
FOR EACH ROW EXECUTE FUNCTION public.validate_supervision_building_property_sede();

REVOKE ALL ON FUNCTION public.validate_supervision_building_property_sede() FROM PUBLIC, anon, authenticated;
