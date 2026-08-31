-- Hardening de autorización e integridad para supervisión.
-- Cambio aditivo: no elimina datos y parte de un inventario remoto sin inconsistencias.

CREATE OR REPLACE FUNCTION public.supervision_user_can_access_sede(_sede_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_has_role('admin'::public.app_role)
    OR (
      (public.user_has_role('manager'::public.app_role) OR public.user_has_role('supervisor'::public.app_role))
      AND public.user_has_sede_access(auth.uid(), _sede_id)
    );
$$;

CREATE OR REPLACE FUNCTION public.supervision_user_can_delete_sede(_sede_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_has_role('admin'::public.app_role)
    OR (
      public.user_has_role('manager'::public.app_role)
      AND public.user_has_sede_access(auth.uid(), _sede_id)
    );
$$;

REVOKE ALL ON FUNCTION public.supervision_user_can_access_sede(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.supervision_user_can_delete_sede(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supervision_user_can_access_sede(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.supervision_user_can_delete_sede(uuid) TO authenticated;

-- Revocar grants heredados y exponer solo las operaciones que las políticas controlan.
REVOKE ALL ON TABLE
  public.supervision_routes,
  public.supervision_route_stops,
  public.supervision_reviews,
  public.supervision_review_events,
  public.supervision_reservation_snapshots,
  public.supervision_incidents,
  public.supervision_incident_events,
  public.supervision_daily_reports,
  public.supervision_review_media
FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.supervision_routes,
  public.supervision_route_stops,
  public.supervision_reviews,
  public.supervision_incidents,
  public.supervision_daily_reports
TO authenticated;

GRANT SELECT, INSERT ON TABLE
  public.supervision_review_events,
  public.supervision_incident_events
TO authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE
  public.supervision_reservation_snapshots,
  public.supervision_review_media
TO authenticated;

-- Rutas.
DROP POLICY IF EXISTS supervision_routes_scope ON public.supervision_routes;
DROP POLICY IF EXISTS supervision_routes_select ON public.supervision_routes;
DROP POLICY IF EXISTS supervision_routes_insert ON public.supervision_routes;
DROP POLICY IF EXISTS supervision_routes_update ON public.supervision_routes;
DROP POLICY IF EXISTS supervision_routes_delete ON public.supervision_routes;
CREATE POLICY supervision_routes_select ON public.supervision_routes FOR SELECT TO authenticated
USING (public.supervision_user_can_access_sede(sede_id));
CREATE POLICY supervision_routes_insert ON public.supervision_routes FOR INSERT TO authenticated
WITH CHECK (public.supervision_user_can_access_sede(sede_id));
CREATE POLICY supervision_routes_update ON public.supervision_routes FOR UPDATE TO authenticated
USING (public.supervision_user_can_access_sede(sede_id))
WITH CHECK (public.supervision_user_can_access_sede(sede_id));
CREATE POLICY supervision_routes_delete ON public.supervision_routes FOR DELETE TO authenticated
USING (public.supervision_user_can_delete_sede(sede_id));

-- Paradas.
DROP POLICY IF EXISTS supervision_stops_scope ON public.supervision_route_stops;
DROP POLICY IF EXISTS supervision_stops_select ON public.supervision_route_stops;
DROP POLICY IF EXISTS supervision_stops_insert ON public.supervision_route_stops;
DROP POLICY IF EXISTS supervision_stops_update ON public.supervision_route_stops;
DROP POLICY IF EXISTS supervision_stops_delete ON public.supervision_route_stops;
CREATE POLICY supervision_stops_select ON public.supervision_route_stops FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.supervision_routes r WHERE r.id = route_id AND public.supervision_user_can_access_sede(r.sede_id)));
CREATE POLICY supervision_stops_insert ON public.supervision_route_stops FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.supervision_routes r WHERE r.id = route_id AND public.supervision_user_can_access_sede(r.sede_id)));
CREATE POLICY supervision_stops_update ON public.supervision_route_stops FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.supervision_routes r WHERE r.id = route_id AND public.supervision_user_can_access_sede(r.sede_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.supervision_routes r WHERE r.id = route_id AND public.supervision_user_can_access_sede(r.sede_id)));
CREATE POLICY supervision_stops_delete ON public.supervision_route_stops FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.supervision_routes r WHERE r.id = route_id AND public.supervision_user_can_delete_sede(r.sede_id)));

-- Revisiones.
DROP POLICY IF EXISTS supervision_reviews_scope ON public.supervision_reviews;
DROP POLICY IF EXISTS supervision_reviews_select ON public.supervision_reviews;
DROP POLICY IF EXISTS supervision_reviews_insert ON public.supervision_reviews;
DROP POLICY IF EXISTS supervision_reviews_update ON public.supervision_reviews;
DROP POLICY IF EXISTS supervision_reviews_delete ON public.supervision_reviews;
CREATE POLICY supervision_reviews_select ON public.supervision_reviews FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.supervision_routes r WHERE r.id = route_id AND public.supervision_user_can_access_sede(r.sede_id)));
CREATE POLICY supervision_reviews_insert ON public.supervision_reviews FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.supervision_routes r WHERE r.id = route_id AND public.supervision_user_can_access_sede(r.sede_id)));
CREATE POLICY supervision_reviews_update ON public.supervision_reviews FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.supervision_routes r WHERE r.id = route_id AND public.supervision_user_can_access_sede(r.sede_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.supervision_routes r WHERE r.id = route_id AND public.supervision_user_can_access_sede(r.sede_id)));
CREATE POLICY supervision_reviews_delete ON public.supervision_reviews FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.supervision_routes r WHERE r.id = route_id AND public.supervision_user_can_delete_sede(r.sede_id)));

-- Eventos de revisión: lectura y append para roles operativos; sin borrado.
DROP POLICY IF EXISTS supervision_review_events_scope ON public.supervision_review_events;
DROP POLICY IF EXISTS supervision_review_events_select ON public.supervision_review_events;
DROP POLICY IF EXISTS supervision_review_events_insert ON public.supervision_review_events;
DROP POLICY IF EXISTS supervision_review_events_update ON public.supervision_review_events;
CREATE POLICY supervision_review_events_select ON public.supervision_review_events FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.supervision_reviews v JOIN public.supervision_routes r ON r.id = v.route_id WHERE v.id = review_id AND public.supervision_user_can_access_sede(r.sede_id)));
CREATE POLICY supervision_review_events_insert ON public.supervision_review_events FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.supervision_reviews v JOIN public.supervision_routes r ON r.id = v.route_id WHERE v.id = review_id AND public.supervision_user_can_access_sede(r.sede_id)));

-- Reservas snapshot: lectura y append/update, sin borrado.
DROP POLICY IF EXISTS supervision_reservations_scope ON public.supervision_reservation_snapshots;
DROP POLICY IF EXISTS supervision_reservations_select ON public.supervision_reservation_snapshots;
DROP POLICY IF EXISTS supervision_reservations_insert ON public.supervision_reservation_snapshots;
DROP POLICY IF EXISTS supervision_reservations_update ON public.supervision_reservation_snapshots;
CREATE POLICY supervision_reservations_select ON public.supervision_reservation_snapshots FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.supervision_route_stops s JOIN public.supervision_routes r ON r.id = s.route_id WHERE s.id = route_stop_id AND public.supervision_user_can_access_sede(r.sede_id)));
CREATE POLICY supervision_reservations_insert ON public.supervision_reservation_snapshots FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.supervision_route_stops s JOIN public.supervision_routes r ON r.id = s.route_id WHERE s.id = route_stop_id AND public.supervision_user_can_access_sede(r.sede_id)));
CREATE POLICY supervision_reservations_update ON public.supervision_reservation_snapshots FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.supervision_route_stops s JOIN public.supervision_routes r ON r.id = s.route_id WHERE s.id = route_stop_id AND public.supervision_user_can_access_sede(r.sede_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.supervision_route_stops s JOIN public.supervision_routes r ON r.id = s.route_id WHERE s.id = route_stop_id AND public.supervision_user_can_access_sede(r.sede_id)));

-- Incidencias.
DROP POLICY IF EXISTS supervision_incidents_scope ON public.supervision_incidents;
DROP POLICY IF EXISTS supervision_incidents_select ON public.supervision_incidents;
DROP POLICY IF EXISTS supervision_incidents_insert ON public.supervision_incidents;
DROP POLICY IF EXISTS supervision_incidents_update ON public.supervision_incidents;
DROP POLICY IF EXISTS supervision_incidents_delete ON public.supervision_incidents;
CREATE POLICY supervision_incidents_select ON public.supervision_incidents FOR SELECT TO authenticated
USING (public.supervision_user_can_access_sede(sede_id));
CREATE POLICY supervision_incidents_insert ON public.supervision_incidents FOR INSERT TO authenticated
WITH CHECK (public.supervision_user_can_access_sede(sede_id));
CREATE POLICY supervision_incidents_update ON public.supervision_incidents FOR UPDATE TO authenticated
USING (public.supervision_user_can_access_sede(sede_id))
WITH CHECK (public.supervision_user_can_access_sede(sede_id));
CREATE POLICY supervision_incidents_delete ON public.supervision_incidents FOR DELETE TO authenticated
USING (public.supervision_user_can_delete_sede(sede_id));

-- Eventos de incidencia: lectura y append/update, sin borrado.
DROP POLICY IF EXISTS supervision_incident_events_scope ON public.supervision_incident_events;
DROP POLICY IF EXISTS supervision_incident_events_select ON public.supervision_incident_events;
DROP POLICY IF EXISTS supervision_incident_events_insert ON public.supervision_incident_events;
DROP POLICY IF EXISTS supervision_incident_events_update ON public.supervision_incident_events;
CREATE POLICY supervision_incident_events_select ON public.supervision_incident_events FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.supervision_incidents i WHERE i.id = incident_id AND public.supervision_user_can_access_sede(i.sede_id)));
CREATE POLICY supervision_incident_events_insert ON public.supervision_incident_events FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.supervision_incidents i WHERE i.id = incident_id AND public.supervision_user_can_access_sede(i.sede_id)));

-- Informes diarios: el cron usa service_role, usuarios operativos solo gestionan su sede.
DROP POLICY IF EXISTS supervision_daily_reports_scope ON public.supervision_daily_reports;
DROP POLICY IF EXISTS supervision_daily_reports_select ON public.supervision_daily_reports;
DROP POLICY IF EXISTS supervision_daily_reports_insert ON public.supervision_daily_reports;
DROP POLICY IF EXISTS supervision_daily_reports_update ON public.supervision_daily_reports;
DROP POLICY IF EXISTS supervision_daily_reports_delete ON public.supervision_daily_reports;
CREATE POLICY supervision_daily_reports_select ON public.supervision_daily_reports FOR SELECT TO authenticated
USING (public.supervision_user_can_access_sede(sede_id));
CREATE POLICY supervision_daily_reports_insert ON public.supervision_daily_reports FOR INSERT TO authenticated
WITH CHECK (public.supervision_user_can_access_sede(sede_id));
CREATE POLICY supervision_daily_reports_update ON public.supervision_daily_reports FOR UPDATE TO authenticated
USING (public.supervision_user_can_access_sede(sede_id))
WITH CHECK (public.supervision_user_can_access_sede(sede_id));
CREATE POLICY supervision_daily_reports_delete ON public.supervision_daily_reports FOR DELETE TO authenticated
USING (public.supervision_user_can_delete_sede(sede_id));

-- Medios: retención indefinida; no se permite borrar desde el rol autenticado.
DROP POLICY IF EXISTS supervision_review_media_scope ON public.supervision_review_media;
DROP POLICY IF EXISTS supervision_review_media_select ON public.supervision_review_media;
DROP POLICY IF EXISTS supervision_review_media_insert ON public.supervision_review_media;
DROP POLICY IF EXISTS supervision_review_media_update ON public.supervision_review_media;
CREATE POLICY supervision_review_media_select ON public.supervision_review_media FOR SELECT TO authenticated
USING (public.supervision_user_can_access_sede(sede_id));
CREATE POLICY supervision_review_media_insert ON public.supervision_review_media FOR INSERT TO authenticated
WITH CHECK (public.supervision_user_can_access_sede(sede_id));
CREATE POLICY supervision_review_media_update ON public.supervision_review_media FOR UPDATE TO authenticated
USING (public.supervision_user_can_access_sede(sede_id))
WITH CHECK (public.supervision_user_can_access_sede(sede_id));

-- Integridad de relaciones: una fila hija no puede mezclar ruta o sede de otra entidad.
CREATE OR REPLACE FUNCTION public.validate_supervision_review_route()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.supervision_route_stops s
    WHERE s.id = NEW.route_stop_id AND s.route_id = NEW.route_id
  ) THEN
    RAISE EXCEPTION 'supervision review stop does not belong to route';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_supervision_incident_links()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  route_sede uuid;
BEGIN
  SELECT sede_id INTO route_sede FROM public.supervision_routes WHERE id = NEW.route_id;
  IF route_sede IS NULL OR route_sede IS DISTINCT FROM NEW.sede_id THEN
    RAISE EXCEPTION 'supervision incident sede does not belong to route';
  END IF;
  IF NEW.route_stop_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.supervision_route_stops s
    WHERE s.id = NEW.route_stop_id AND s.route_id = NEW.route_id
  ) THEN
    RAISE EXCEPTION 'supervision incident stop does not belong to route';
  END IF;
  IF NEW.review_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.supervision_reviews v
    WHERE v.id = NEW.review_id AND v.route_id = NEW.route_id
  ) THEN
    RAISE EXCEPTION 'supervision incident review does not belong to route';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_supervision_media_sede()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.supervision_reviews v
    JOIN public.supervision_routes r ON r.id = v.route_id
    WHERE v.id = NEW.review_id AND r.sede_id = NEW.sede_id
  ) THEN
    RAISE EXCEPTION 'supervision media sede does not belong to review route';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_supervision_daily_report_sede()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.supervision_routes r
    WHERE r.id = NEW.route_id AND r.sede_id = NEW.sede_id
  ) THEN
    RAISE EXCEPTION 'supervision daily report sede does not belong to route';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_supervision_review_route ON public.supervision_reviews;
CREATE TRIGGER trg_validate_supervision_review_route
BEFORE INSERT OR UPDATE OF route_id, route_stop_id ON public.supervision_reviews
FOR EACH ROW EXECUTE FUNCTION public.validate_supervision_review_route();

DROP TRIGGER IF EXISTS trg_validate_supervision_incident_links ON public.supervision_incidents;
CREATE TRIGGER trg_validate_supervision_incident_links
BEFORE INSERT OR UPDATE OF route_id, route_stop_id, review_id, sede_id ON public.supervision_incidents
FOR EACH ROW EXECUTE FUNCTION public.validate_supervision_incident_links();

DROP TRIGGER IF EXISTS trg_validate_supervision_media_sede ON public.supervision_review_media;
CREATE TRIGGER trg_validate_supervision_media_sede
BEFORE INSERT OR UPDATE OF review_id, sede_id ON public.supervision_review_media
FOR EACH ROW EXECUTE FUNCTION public.validate_supervision_media_sede();

DROP TRIGGER IF EXISTS trg_validate_supervision_daily_report_sede ON public.supervision_daily_reports;
CREATE TRIGGER trg_validate_supervision_daily_report_sede
BEFORE INSERT OR UPDATE OF route_id, sede_id ON public.supervision_daily_reports
FOR EACH ROW EXECUTE FUNCTION public.validate_supervision_daily_report_sede();

-- Evidencias privadas: el alcance por sede debe mantenerse también en Storage.
DROP POLICY IF EXISTS supervision_evidence_read ON storage.objects;
DROP POLICY IF EXISTS supervision_evidence_write ON storage.objects;
DROP POLICY IF EXISTS supervision_evidence_update ON storage.objects;
CREATE POLICY supervision_evidence_read ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'supervision-evidence' AND public.supervision_user_can_access_sede(((storage.foldername(name))[1])::uuid));
CREATE POLICY supervision_evidence_write ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'supervision-evidence' AND public.supervision_user_can_access_sede(((storage.foldername(name))[1])::uuid));
CREATE POLICY supervision_evidence_update ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'supervision-evidence' AND public.supervision_user_can_access_sede(((storage.foldername(name))[1])::uuid))
WITH CHECK (bucket_id = 'supervision-evidence' AND public.supervision_user_can_access_sede(((storage.foldername(name))[1])::uuid));
