-- MANUAL ONLY. Prepared SQL; not applied to production.
-- Verify the live prerequisite tables/functions and obtain explicit authorization.
BEGIN;
DO $$ BEGIN
  IF to_regclass('public.tasks') IS NULL OR to_regclass('public.profiles') IS NULL
    OR to_regclass('public.task_assignments') IS NULL
    OR to_regprocedure('public.user_has_sede_access(uuid,uuid)') IS NULL
    OR to_regprocedure('public.has_role(uuid,public.app_role)') IS NULL THEN
    RAISE EXCEPTION 'Operational attention prerequisites missing';
  END IF;
END $$;

CREATE TABLE public.operational_alert_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id uuid NOT NULL REFERENCES public.sedes(id),
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  task_date date NOT NULL,
  alert_key text NOT NULL CHECK (octet_length(alert_key) BETWEEN 1 AND 2048),
  kind text NOT NULL CHECK (kind IN ('unfinished','missing-report','late-start','duration')),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object' AND octet_length(snapshot::text) < 16384),
  reviewed_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by_name text NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(sede_id, alert_key)
);
CREATE INDEX operational_alert_reviews_history ON public.operational_alert_reviews(sede_id, task_date, reviewed_at DESC, id);
ALTER TABLE public.operational_alert_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.operational_alert_reviews FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.operational_alert_reviews TO authenticated;
GRANT INSERT(sede_id,task_id,task_date,alert_key,kind,snapshot) ON public.operational_alert_reviews TO authenticated;

CREATE FUNCTION public.stamp_operational_alert_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (
    (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role))
    AND public.user_has_sede_access(auth.uid(), NEW.sede_id)
  ) THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;
  IF NEW.snapshot->>'key' IS DISTINCT FROM NEW.alert_key
    OR NEW.snapshot->>'kind' IS DISTINCT FROM NEW.kind
    OR NEW.snapshot->>'sedeId' IS DISTINCT FROM NEW.sede_id::text
    OR NEW.snapshot->>'taskId' IS DISTINCT FROM NEW.task_id::text
    OR NEW.snapshot->>'taskDate' IS DISTINCT FROM NEW.task_date::text
    OR NOT EXISTS (
      SELECT 1 FROM public.tasks t WHERE t.id = NEW.task_id AND t.sede_id = NEW.sede_id AND t.date = NEW.task_date
      AND (
        EXISTS (SELECT 1 FROM public.task_assignments a WHERE a.task_id = t.id AND a.cleaner_id::text = NEW.snapshot->>'cleanerId')
        OR (t.cleaner_id::text = NEW.snapshot->>'cleanerId' AND NOT EXISTS (SELECT 1 FROM public.task_assignments a WHERE a.task_id = t.id))
      )
    ) THEN RAISE EXCEPTION 'Review does not match current task scope' USING ERRCODE = '23514'; END IF;
  NEW.reviewed_by := auth.uid();
  NEW.reviewed_at := now();
  SELECT coalesce(nullif(p.full_name,''), 'Coordinación') INTO NEW.reviewed_by_name FROM public.profiles p WHERE p.id = auth.uid();
  NEW.reviewed_by_name := coalesce(NEW.reviewed_by_name, 'Coordinación');
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.stamp_operational_alert_review() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER stamp_operational_alert_review BEFORE INSERT ON public.operational_alert_reviews
FOR EACH ROW EXECUTE FUNCTION public.stamp_operational_alert_review();
CREATE POLICY operational_alert_reviews_read ON public.operational_alert_reviews FOR SELECT TO authenticated USING (
  (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role))
  AND public.user_has_sede_access(auth.uid(), sede_id)
);
CREATE POLICY operational_alert_reviews_insert ON public.operational_alert_reviews FOR INSERT TO authenticated WITH CHECK (
  reviewed_by = auth.uid() AND task_id IS NOT NULL AND
  (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role))
  AND public.user_has_sede_access(auth.uid(), sede_id)
);
COMMIT;
