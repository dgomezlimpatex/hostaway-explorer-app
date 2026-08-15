-- Endurecimiento operativo de supervisión.
-- Cambio aditivo salvo la sustitución de la unicidad histórica de informes:
-- una ruta puede tener un informe por fecha, no solo un informe en toda su vida.

-- Un informe diario debe poder registrarse por ruta y fecha.
ALTER TABLE public.supervision_daily_reports
  DROP CONSTRAINT IF EXISTS supervision_daily_reports_route_id_key;

ALTER TABLE public.supervision_daily_reports
  ADD CONSTRAINT supervision_daily_reports_route_date_key UNIQUE (route_id, report_date);

-- Ledger único para reclamar el envío diario antes de llamar al proveedor.
CREATE TABLE IF NOT EXISTS public.supervision_daily_report_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('sending', 'sent', 'failed')),
  claim_token UUID NOT NULL,
  email_to TEXT NOT NULL,
  route_count INTEGER NOT NULL DEFAULT 0 CHECK (route_count >= 0),
  provider_message_id TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.supervision_daily_report_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.supervision_daily_report_runs FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_supervision_daily_report(
  _report_date DATE,
  _email_to TEXT,
  _route_count INTEGER
)
RETURNS TABLE(claimed BOOLEAN, claim_token UUID, reason TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_run public.supervision_daily_report_runs;
  next_token UUID := gen_random_uuid();
BEGIN
  INSERT INTO public.supervision_daily_report_runs (
    report_date, status, claim_token, email_to, route_count, started_at, updated_at
  ) VALUES (
    _report_date, 'sending', next_token, _email_to, GREATEST(_route_count, 0), now(), now()
  )
  ON CONFLICT (report_date) DO NOTHING;

  SELECT * INTO current_run
  FROM public.supervision_daily_report_runs
  WHERE report_date = _report_date
  FOR UPDATE;

  IF current_run.status = 'sent' THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'report already sent for date';
    RETURN;
  END IF;

  IF current_run.status = 'sending'
     AND current_run.started_at > now() - INTERVAL '30 minutes' THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'report send already claimed';
    RETURN;
  END IF;

  UPDATE public.supervision_daily_report_runs
  SET status = 'sending',
      claim_token = next_token,
      email_to = _email_to,
      route_count = GREATEST(_route_count, 0),
      started_at = now(),
      updated_at = now(),
      error_message = NULL
  WHERE id = current_run.id;

  RETURN QUERY SELECT TRUE, next_token, 'claimed';
END;
$$;

REVOKE ALL ON FUNCTION public.claim_supervision_daily_report(DATE, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_supervision_daily_report(DATE, TEXT, INTEGER) TO service_role;

-- Los eventos y la autoría de las operaciones de campo deben proceder del JWT.
CREATE OR REPLACE FUNCTION public.set_supervision_actor_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF TG_TABLE_NAME = 'supervision_reviews' THEN
      NEW.reviewer_user_id := auth.uid();
    ELSIF TG_TABLE_NAME = 'supervision_review_events' THEN
      NEW.actor_user_id := auth.uid();
    ELSIF TG_TABLE_NAME = 'supervision_incidents' THEN
      NEW.created_by := auth.uid();
    ELSIF TG_TABLE_NAME = 'supervision_incident_events' THEN
      NEW.actor_user_id := auth.uid();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_supervision_reviews_actor ON public.supervision_reviews;
CREATE TRIGGER trg_supervision_reviews_actor
BEFORE INSERT ON public.supervision_reviews
FOR EACH ROW EXECUTE FUNCTION public.set_supervision_actor_from_auth();

DROP TRIGGER IF EXISTS trg_supervision_review_events_actor ON public.supervision_review_events;
CREATE TRIGGER trg_supervision_review_events_actor
BEFORE INSERT ON public.supervision_review_events
FOR EACH ROW EXECUTE FUNCTION public.set_supervision_actor_from_auth();

DROP TRIGGER IF EXISTS trg_supervision_incidents_actor ON public.supervision_incidents;
CREATE TRIGGER trg_supervision_incidents_actor
BEFORE INSERT ON public.supervision_incidents
FOR EACH ROW EXECUTE FUNCTION public.set_supervision_actor_from_auth();

DROP TRIGGER IF EXISTS trg_supervision_incident_events_actor ON public.supervision_incident_events;
CREATE TRIGGER trg_supervision_incident_events_actor
BEFORE INSERT ON public.supervision_incident_events
FOR EACH ROW EXECUTE FUNCTION public.set_supervision_actor_from_auth();

-- Restricciones de carga del bucket privado.
UPDATE storage.buckets
SET file_size_limit = 10 * 1024 * 1024,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
WHERE id = 'supervision-evidence';

CREATE OR REPLACE FUNCTION public.supervision_storage_object_matches_review(_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  object_sede UUID;
  object_review UUID;
BEGIN
  IF _name IS NULL OR _name !~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/.+$' THEN
    RETURN FALSE;
  END IF;

  object_sede := split_part(_name, '/', 1)::UUID;
  object_review := split_part(_name, '/', 2)::UUID;

  RETURN EXISTS (
    SELECT 1
    FROM public.supervision_reviews v
    JOIN public.supervision_routes r ON r.id = v.route_id
    WHERE v.id = object_review AND r.sede_id = object_sede
  );
EXCEPTION WHEN invalid_text_representation THEN
  RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.supervision_storage_object_matches_review(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supervision_storage_object_matches_review(TEXT) TO authenticated;

DROP POLICY IF EXISTS supervision_evidence_read ON storage.objects;
CREATE POLICY supervision_evidence_read ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'supervision-evidence'
  AND public.supervision_storage_object_matches_review(name)
  AND public.supervision_user_can_access_sede(((storage.foldername(name))[1])::UUID)
);

DROP POLICY IF EXISTS supervision_evidence_write ON storage.objects;
CREATE POLICY supervision_evidence_write ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'supervision-evidence'
  AND public.supervision_storage_object_matches_review(name)
  AND public.supervision_user_can_access_sede(((storage.foldername(name))[1])::UUID)
);

DROP POLICY IF EXISTS supervision_evidence_update ON storage.objects;
CREATE POLICY supervision_evidence_update ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'supervision-evidence'
  AND public.supervision_storage_object_matches_review(name)
  AND public.supervision_user_can_access_sede(((storage.foldername(name))[1])::UUID)
)
WITH CHECK (
  bucket_id = 'supervision-evidence'
  AND public.supervision_storage_object_matches_review(name)
  AND public.supervision_user_can_access_sede(((storage.foldername(name))[1])::UUID)
);
