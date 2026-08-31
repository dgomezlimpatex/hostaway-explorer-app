-- Endurece el cierre de rutas de supervisión.
-- Las rutas completadas quedan de solo lectura para operaciones de campo.

CREATE OR REPLACE FUNCTION public.validate_supervision_route_is_open()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  route_id_to_check uuid;
  old_route_id uuid;
BEGIN
  route_id_to_check := CASE WHEN TG_OP = 'DELETE' THEN OLD.route_id ELSE NEW.route_id END;
  IF TG_OP = 'UPDATE' THEN old_route_id := OLD.route_id; END IF;

  IF EXISTS (
    SELECT 1 FROM public.supervision_routes
    WHERE id IN (route_id_to_check, old_route_id)
      AND status = 'completed'
  ) THEN
    RAISE EXCEPTION 'supervision route is completed and read-only';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_supervision_stop_route_is_open()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  route_id_to_check uuid;
BEGIN
  route_id_to_check := CASE WHEN TG_OP = 'DELETE' THEN OLD.route_id ELSE NEW.route_id END;
  IF EXISTS (SELECT 1 FROM public.supervision_routes WHERE id = route_id_to_check AND status = 'completed') THEN
    RAISE EXCEPTION 'supervision route is completed and read-only';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_supervision_review_route_is_open()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.supervision_routes WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.route_id ELSE NEW.route_id END AND status = 'completed') THEN
    RAISE EXCEPTION 'supervision route is completed and read-only';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_supervision_incident_route_is_open()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.supervision_routes WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.route_id ELSE NEW.route_id END AND status = 'completed') THEN
    RAISE EXCEPTION 'supervision route is completed and read-only';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_supervision_reservation_route_is_open()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.supervision_route_stops s
    JOIN public.supervision_routes r ON r.id = s.route_id
    WHERE s.id = CASE WHEN TG_OP = 'DELETE' THEN OLD.route_stop_id ELSE NEW.route_stop_id END
      AND r.status = 'completed'
  ) THEN
    RAISE EXCEPTION 'supervision route is completed and read-only';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_supervision_media_route_is_open()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.supervision_reviews v
    JOIN public.supervision_routes r ON r.id = v.route_id
    WHERE v.id = CASE WHEN TG_OP = 'DELETE' THEN OLD.review_id ELSE NEW.review_id END
      AND r.status = 'completed'
  ) THEN
    RAISE EXCEPTION 'supervision route is completed and read-only';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_supervision_stops_open_route ON public.supervision_route_stops;
CREATE TRIGGER trg_supervision_stops_open_route
BEFORE INSERT OR UPDATE OR DELETE ON public.supervision_route_stops
FOR EACH ROW EXECUTE FUNCTION public.validate_supervision_stop_route_is_open();

DROP TRIGGER IF EXISTS trg_supervision_reviews_open_route ON public.supervision_reviews;
CREATE TRIGGER trg_supervision_reviews_open_route
BEFORE INSERT OR UPDATE OR DELETE ON public.supervision_reviews
FOR EACH ROW EXECUTE FUNCTION public.validate_supervision_review_route_is_open();

DROP TRIGGER IF EXISTS trg_supervision_incidents_open_route ON public.supervision_incidents;
CREATE TRIGGER trg_supervision_incidents_open_route
BEFORE INSERT OR UPDATE OR DELETE ON public.supervision_incidents
FOR EACH ROW EXECUTE FUNCTION public.validate_supervision_incident_route_is_open();

DROP TRIGGER IF EXISTS trg_supervision_reservations_open_route ON public.supervision_reservation_snapshots;
CREATE TRIGGER trg_supervision_reservations_open_route
BEFORE INSERT OR UPDATE OR DELETE ON public.supervision_reservation_snapshots
FOR EACH ROW EXECUTE FUNCTION public.validate_supervision_reservation_route_is_open();

DROP TRIGGER IF EXISTS trg_supervision_media_open_route ON public.supervision_review_media;
CREATE TRIGGER trg_supervision_media_open_route
BEFORE INSERT OR UPDATE OR DELETE ON public.supervision_review_media
FOR EACH ROW EXECUTE FUNCTION public.validate_supervision_media_route_is_open();
