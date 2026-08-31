-- Supervisión 2.0 · Ola 2: reglas de asignación de rutas automáticas.
CREATE OR REPLACE FUNCTION public.validate_supervision_route_building_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.property_group_id IS NOT NULL
     AND auth.uid() IS NOT NULL
     AND NOT public.user_is_admin_or_manager()
     AND NOT public.supervision_user_has_building_assignment(NEW.property_group_id, auth.uid(), NEW.route_date) THEN
    RAISE EXCEPTION 'supervision building assignment required for route';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_supervision_route_building_assignment
  ON public.supervision_routes;
CREATE TRIGGER trg_validate_supervision_route_building_assignment
BEFORE INSERT OR UPDATE OF property_group_id, route_date
ON public.supervision_routes
FOR EACH ROW EXECUTE FUNCTION public.validate_supervision_route_building_assignment();

REVOKE ALL ON FUNCTION public.validate_supervision_route_building_assignment() FROM PUBLIC, anon, authenticated;
