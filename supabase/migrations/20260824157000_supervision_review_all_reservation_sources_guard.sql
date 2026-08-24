-- Supervisión: la protección de revisiones debe usar las mismas fuentes
-- que la agenda (portal manual + integraciones PMS/channel manager).

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
  FROM public.property_group_assignments pga
  JOIN public.property_groups pg ON pg.id = pga.property_group_id
  JOIN public.properties p ON p.id = pga.property_id
  WHERE pga.property_id = NEW.property_id
  LIMIT 1;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT r.property_id, r.check_in_date, r.check_out_date, r.status::TEXT AS status
      FROM public.client_reservations r
      UNION ALL
      SELECT r.property_id, r.arrival_date, r.departure_date, r.status::TEXT
      FROM public.avantio_reservations r
      UNION ALL
      SELECT r.property_id, r.arrival_date, r.departure_date, r.status::TEXT
      FROM public.hostaway_reservations r
      UNION ALL
      SELECT r.property_id, r.check_in, r.check_out, r.status::TEXT
      FROM public.smoobu_reservations r
    ) reservations
    WHERE reservations.property_id = NEW.property_id
      AND lower(reservations.status) NOT IN ('cancelled', 'canceled')
      AND (reservations.check_in_date + COALESCE(building_check_in, '17:00'::time)) <= review_at
      AND (reservations.check_out_date + COALESCE(property_check_out, building_check_out, '11:00'::time)) > review_at
  ) THEN
    RAISE EXCEPTION 'supervision review blocked: apartment is occupied according to reservation sources';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_supervision_review_property_vacancy() FROM PUBLIC, anon, authenticated;
