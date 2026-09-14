-- Append-only history. Trigger functions are private and cannot be invoked via the API.
CREATE SCHEMA IF NOT EXISTS workers_internal;
REVOKE ALL ON SCHEMA workers_internal FROM PUBLIC, anon, authenticated;

CREATE TABLE public.worker_contract_hours_history (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 cleaner_id uuid REFERENCES public.cleaners(id) ON DELETE SET NULL,
 hours_per_week numeric NOT NULL,
 effective_date date NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Madrid')::date,
 is_baseline boolean NOT NULL DEFAULT false,
 changed_by uuid, changed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.worker_schedule_history (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 cleaner_id uuid REFERENCES public.cleaners(id) ON DELETE SET NULL,
 source_type text NOT NULL CHECK (source_type IN ('maintenance','recurring')),
 source_id uuid NOT NULL,
 effective_date date NOT NULL,
 payload jsonb NOT NULL,
 is_baseline boolean NOT NULL DEFAULT false,
 changed_by uuid, changed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.worker_hours_adjustment_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 cleaner_id uuid REFERENCES public.cleaners(id) ON DELETE SET NULL,
 adjustment_id uuid NOT NULL,
 action text NOT NULL,
 old_data jsonb, new_data jsonb,
 changed_by uuid, changed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX ON public.worker_contract_hours_history(cleaner_id,effective_date,id);
CREATE INDEX ON public.worker_schedule_history(cleaner_id,source_type,source_id,effective_date,id);
CREATE INDEX ON public.worker_hours_adjustment_audit(cleaner_id,changed_at,id);

ALTER TABLE public.worker_contract_hours_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_schedule_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_hours_adjustment_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.worker_contract_hours_history,public.worker_schedule_history,public.worker_hours_adjustment_audit FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.worker_contract_hours_history,public.worker_schedule_history,public.worker_hours_adjustment_audit TO authenticated;
GRANT ALL ON public.worker_contract_hours_history,public.worker_schedule_history,public.worker_hours_adjustment_audit TO service_role;
CREATE POLICY personnel_history_read ON public.worker_contract_hours_history FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=(SELECT auth.uid()) AND role IN ('admin','manager'))
 AND cleaner_id IN (SELECT id FROM public.cleaners WHERE sede_id=ANY(public.get_user_accessible_sedes()))
);
CREATE POLICY personnel_schedule_read ON public.worker_schedule_history FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=(SELECT auth.uid()) AND role IN ('admin','manager'))
 AND cleaner_id IN (SELECT id FROM public.cleaners WHERE sede_id=ANY(public.get_user_accessible_sedes()))
);
CREATE POLICY personnel_adjustment_audit_read ON public.worker_hours_adjustment_audit FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=(SELECT auth.uid()) AND role IN ('admin','manager'))
 AND cleaner_id IN (SELECT id FROM public.cleaners WHERE sede_id=ANY(public.get_user_accessible_sedes()))
);
-- Narrow the existing permissive adjustment policies to the caller's permitted sites.
CREATE POLICY personnel_adjustment_sede ON public.worker_hour_adjustments AS RESTRICTIVE FOR ALL TO authenticated
 USING (cleaner_id IN (SELECT id FROM public.cleaners WHERE sede_id=ANY(public.get_user_accessible_sedes())))
 WITH CHECK (cleaner_id IN (SELECT id FROM public.cleaners WHERE sede_id=ANY(public.get_user_accessible_sedes())));

INSERT INTO public.worker_contract_hours_history(cleaner_id,hours_per_week,is_baseline)
 SELECT id,COALESCE(contract_hours_per_week,0),true FROM public.cleaners;
-- Only reconstruct states for which the existing audit supplies dated evidence.
INSERT INTO public.worker_schedule_history(cleaner_id,source_type,source_id,effective_date,payload,changed_by,changed_at)
 SELECT a.cleaner_id,'maintenance',a.reference_id,(a.changed_at AT TIME ZONE 'Europe/Madrid')::date,
 CASE WHEN a.new_data IS NULL THEN a.old_data || '{"is_active":false}'::jsonb
 WHEN w.schedule_type='unavailability' THEN a.new_data || '{"schedule_type":"unavailability"}'::jsonb
 ELSE a.new_data END,a.changed_by,a.changed_at
 FROM public.worker_absence_audit_log a JOIN public.cleaners c ON c.id=a.cleaner_id
 LEFT JOIN public.worker_maintenance_cleanings w ON w.id=a.reference_id
 WHERE a.reference_type='maintenance_cleaning' AND COALESCE(a.new_data,a.old_data) IS NOT NULL
 ORDER BY a.changed_at,a.id;
INSERT INTO public.worker_schedule_history(cleaner_id,source_type,source_id,effective_date,payload,is_baseline)
 SELECT cleaner_id,'maintenance',id,(CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Madrid')::date,to_jsonb(w),true
 FROM public.worker_maintenance_cleanings w WHERE cleaner_id IS NOT NULL;
INSERT INTO public.worker_schedule_history(cleaner_id,source_type,source_id,effective_date,payload,is_baseline)
 SELECT cleaner_id,'recurring',id,(CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Madrid')::date,to_jsonb(r),true
 FROM public.recurring_tasks r WHERE cleaner_id IS NOT NULL;

CREATE FUNCTION workers_internal.capture_contract_hours() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='INSERT' OR NEW.contract_hours_per_week IS DISTINCT FROM OLD.contract_hours_per_week THEN
  INSERT INTO public.worker_contract_hours_history(cleaner_id,hours_per_week,changed_by)
   VALUES(NEW.id,COALESCE(NEW.contract_hours_per_week,0),auth.uid());
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER capture_worker_contract_hours AFTER INSERT OR UPDATE OF contract_hours_per_week ON public.cleaners
 FOR EACH ROW EXECUTE FUNCTION workers_internal.capture_contract_hours();

CREATE FUNCTION workers_internal.capture_schedule() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE kind text:=CASE WHEN TG_TABLE_NAME='recurring_tasks' THEN 'recurring' ELSE 'maintenance' END;
 day_key date:=(CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Madrid')::date;
BEGIN
 IF TG_OP='UPDATE' AND (to_jsonb(NEW)-'updated_at') IS NOT DISTINCT FROM (to_jsonb(OLD)-'updated_at') THEN RETURN NEW; END IF;
 IF TG_OP='DELETE' OR (TG_OP='UPDATE' AND OLD.cleaner_id IS DISTINCT FROM NEW.cleaner_id) THEN
  IF OLD.cleaner_id IS NOT NULL THEN
   INSERT INTO public.worker_schedule_history(cleaner_id,source_type,source_id,effective_date,payload,changed_by)
    VALUES(OLD.cleaner_id,kind,OLD.id,day_key,to_jsonb(OLD)||'{"is_active":false}'::jsonb,auth.uid());
  END IF;
 END IF;
 IF TG_OP<>'DELETE' AND NEW.cleaner_id IS NOT NULL THEN
  INSERT INTO public.worker_schedule_history(cleaner_id,source_type,source_id,effective_date,payload,changed_by)
   VALUES(NEW.cleaner_id,kind,NEW.id,day_key,to_jsonb(NEW),auth.uid());
 END IF;
 RETURN COALESCE(NEW,OLD);
END $$;
CREATE TRIGGER capture_maintenance_hours AFTER INSERT OR UPDATE OR DELETE ON public.worker_maintenance_cleanings
 FOR EACH ROW EXECUTE FUNCTION workers_internal.capture_schedule();
CREATE TRIGGER capture_recurring_hours AFTER INSERT OR UPDATE OR DELETE ON public.recurring_tasks
 FOR EACH ROW EXECUTE FUNCTION workers_internal.capture_schedule();

CREATE FUNCTION workers_internal.capture_adjustment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP<>'DELETE' AND (NEW.hours=0 OR abs(NEW.hours)>24 OR NEW.hours*4<>trunc(NEW.hours*4) OR length(trim(NEW.reason))<3) THEN
  RAISE EXCEPTION 'INVALID_HOUR_ADJUSTMENT' USING ERRCODE='23514';
 END IF;
 INSERT INTO public.worker_hours_adjustment_audit(cleaner_id,adjustment_id,action,old_data,new_data,changed_by)
 VALUES(COALESCE(NEW.cleaner_id,OLD.cleaner_id),COALESCE(NEW.id,OLD.id),TG_OP,
 CASE WHEN TG_OP<>'INSERT' THEN to_jsonb(OLD) END,CASE WHEN TG_OP<>'DELETE' THEN to_jsonb(NEW) END,auth.uid());
 RETURN COALESCE(NEW,OLD);
END $$;
CREATE TRIGGER capture_hour_adjustments AFTER INSERT OR UPDATE OR DELETE ON public.worker_hour_adjustments
 FOR EACH ROW EXECUTE FUNCTION workers_internal.capture_adjustment();
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA workers_internal FROM PUBLIC,anon,authenticated;
