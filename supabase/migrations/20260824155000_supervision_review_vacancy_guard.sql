-- Supervisión: una revisión de apartamento solo se puede guardar durante una ventana vacía.
-- La comprobación usa las reservas activas del portal del cliente y los horarios
-- configurados del edificio/propiedad. No bloquea inventarios de trasteros.

CREATE OR REPLACE FUNCTION public.validate_supervision_review_property_vacancy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  review_at TIMESTAMP WITHOUT TIME ZONE;
  building_check_in TIME;
  building_check_out TIME;
  property_check_out TIME;
BEGIN
  IF NEW.property_id IS NULL THEN
    RETURN NEW;
  END IF;

  review_at := timezone('Europe/Madrid', COALESCE(NEW.completed_at, NEW.started_at, NEW.created_at, now()));

  SELECT
    COALESCE(pg.check_in_time, '17:00'::time),
    COALESCE(pg.check_out_time, '11:00'::time),
    p.check_out_predeterminado
  INTO building_check_in, building_check_out, property_check_out
  FROM public.property_groups pg
  LEFT JOIN public.properties p ON p.id = NEW.property_id
  WHERE pg.id = NEW.property_group_id;

  IF building_check_in IS NULL OR building_check_out IS NULL THEN
    SELECT
      COALESCE(pg.check_in_time, '17:00'::time),
      COALESCE(pg.check_out_time, '11:00'::time),
      p.check_out_predeterminado
    INTO building_check_in, building_check_out, property_check_out
    FROM public.property_group_assignments pga
    JOIN public.property_groups pg ON pg.id = pga.property_group_id
    JOIN public.properties p ON p.id = pga.property_id
    WHERE pga.property_id = NEW.property_id
    LIMIT 1;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.client_reservations r
    WHERE r.property_id = NEW.property_id
      AND r.status <> 'cancelled'
      AND (r.check_in_date + COALESCE(building_check_in, '17:00'::time)) <= review_at
      AND (r.check_out_date + COALESCE(property_check_out, building_check_out, '11:00'::time)) > review_at
  ) THEN
    RAISE EXCEPTION 'supervision review blocked: apartment is occupied according to client portal reservation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_supervision_review_property_vacancy
  ON public.supervision_reviews;
CREATE TRIGGER trg_validate_supervision_review_property_vacancy
BEFORE INSERT OR UPDATE OF property_id, property_group_id, started_at, completed_at, created_at
ON public.supervision_reviews
FOR EACH ROW EXECUTE FUNCTION public.validate_supervision_review_property_vacancy();

REVOKE ALL ON FUNCTION public.validate_supervision_review_property_vacancy() FROM PUBLIC, anon, authenticated;
