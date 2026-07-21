\set ON_ERROR_STOP on
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS auth;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), 'authenticated')
$$;
CREATE TYPE public.app_role AS ENUM ('admin','manager','supervisor','cleaner','client','logistics');
CREATE TABLE public.user_roles(user_id uuid NOT NULL, role public.app_role NOT NULL, UNIQUE(user_id, role));
CREATE TABLE public.sedes(id uuid PRIMARY KEY, is_active boolean NOT NULL DEFAULT true);
CREATE TABLE public.user_sede_access(user_id uuid NOT NULL, sede_id uuid NOT NULL REFERENCES public.sedes, can_access boolean NOT NULL DEFAULT true, UNIQUE(user_id,sede_id));
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid,_role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role)
$$;
CREATE OR REPLACE FUNCTION public.user_has_sede_access(_user_id uuid,_sede_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role='admin')
 OR EXISTS(SELECT 1 FROM public.user_sede_access WHERE user_id=_user_id AND sede_id=_sede_id AND can_access)
$$;
CREATE TABLE public.cleaners(
  id uuid PRIMARY KEY, name text NOT NULL, email text, telefono text, whatsapp_phone_e164 text,
  is_active boolean NOT NULL DEFAULT true, sede_id uuid NOT NULL REFERENCES public.sedes,
  planning_operational_restrictions text, planning_max_daily_minutes integer NOT NULL DEFAULT 480,
  activation_cycle_id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.tasks(
  id uuid PRIMARY KEY, property text NOT NULL DEFAULT 'P', address text NOT NULL DEFAULT '',
  date date NOT NULL, start_time time NOT NULL, end_time time NOT NULL,
  type text NOT NULL DEFAULT 'cleaning', status text NOT NULL DEFAULT 'pending',
  check_out time NOT NULL DEFAULT '10:00', check_in time NOT NULL DEFAULT '15:00',
  cleaner text, cleaner_id uuid REFERENCES public.cleaners,
  cliente_id uuid, propiedad_id uuid, duracion integer, coste numeric, metodo_pago text,
  supervisor text, sede_id uuid NOT NULL REFERENCES public.sedes, background_color text,
  notes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.task_assignments(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_id uuid NOT NULL REFERENCES public.tasks ON DELETE CASCADE,
  cleaner_id uuid NOT NULL REFERENCES public.cleaners, cleaner_name text NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(), assigned_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(task_id, cleaner_id)
);
CREATE TABLE public.cleaner_availability(
  cleaner_id uuid NOT NULL REFERENCES public.cleaners, day_of_week integer NOT NULL,
  is_available boolean NOT NULL, start_time time, end_time time, UNIQUE(cleaner_id,day_of_week)
);
CREATE TABLE public.worker_absences(cleaner_id uuid NOT NULL REFERENCES public.cleaners,start_date date NOT NULL,end_date date NOT NULL,start_time time,end_time time);
CREATE TABLE public.worker_fixed_days_off(cleaner_id uuid NOT NULL REFERENCES public.cleaners,day_of_week integer NOT NULL,is_active boolean NOT NULL DEFAULT true);
CREATE TABLE public.worker_maintenance_cleanings(cleaner_id uuid NOT NULL REFERENCES public.cleaners,days_of_week integer[] NOT NULL,start_time time NOT NULL,end_time time NOT NULL,is_active boolean NOT NULL DEFAULT true);
CREATE TABLE public.recurring_tasks(
  id uuid PRIMARY KEY, name text NOT NULL, cliente_id uuid, propiedad_id uuid, type text NOT NULL,
  start_time time NOT NULL, end_time time NOT NULL, check_out time NOT NULL, check_in time NOT NULL,
  duracion integer, coste numeric, metodo_pago text, supervisor text, cleaner text,
  cleaner_id uuid REFERENCES public.cleaners, frequency text NOT NULL, interval_days integer NOT NULL DEFAULT 1,
  days_of_week integer[], day_of_month integer, start_date date NOT NULL, end_date date,
  is_active boolean NOT NULL DEFAULT true, next_execution date NOT NULL, last_execution date,
  sede_id uuid NOT NULL REFERENCES public.sedes, state_revision bigint NOT NULL DEFAULT 0
);
CREATE TABLE public.recurring_task_executions(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), recurring_task_id uuid NOT NULL REFERENCES public.recurring_tasks,
  generated_task_id uuid REFERENCES public.tasks, execution_date timestamptz NOT NULL DEFAULT now(),
  execution_day date, success boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX recurring_task_executions_success_once ON public.recurring_task_executions(recurring_task_id,execution_day) WHERE success AND execution_day IS NOT NULL;
CREATE TABLE public.planning_runs(
  id uuid PRIMARY KEY, sede_id uuid REFERENCES public.sedes, status text NOT NULL DEFAULT 'draft',
  generated_by uuid, approved_by uuid, approved_at timestamptz,
  summary jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.planning_run_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), run_id uuid NOT NULL REFERENCES public.planning_runs, task_id uuid NOT NULL REFERENCES public.tasks, status text NOT NULL DEFAULT 'draft', applied_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.notification_events(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_type text NOT NULL, entity_type text NOT NULL DEFAULT 'tasks',
  entity_id uuid NOT NULL, task_id uuid REFERENCES public.tasks ON DELETE SET NULL,
  cleaner_id uuid REFERENCES public.cleaners ON DELETE SET NULL, sede_id uuid REFERENCES public.sedes ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}', dedupe_key text NOT NULL UNIQUE, status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz, error_message text
);
-- Evento preexistente a 15000: la migración debe conservarlo como live.
INSERT INTO public.notification_events(event_type,entity_id,payload,dedupe_key,status)
VALUES ('legacy_probe','90000000-0000-0000-0000-000000000001','{}','legacy-pre-15000','pending');
-- Writers ya desplegados: 15000 no puede redefinir su semántica.
CREATE OR REPLACE FUNCTION public.enqueue_task_modified_notifications()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF OLD.notes IS DISTINCT FROM NEW.notes AND NEW.cleaner_id IS NOT NULL THEN
  INSERT INTO public.notification_events(event_type,entity_id,task_id,cleaner_id,sede_id,payload,dedupe_key,status)
  VALUES('task_modified',NEW.id,NEW.id,NEW.cleaner_id,NEW.sede_id,jsonb_build_object('writer_contract','legacy-cancellations-real'),'baseline-modified:'||NEW.id||':'||gen_random_uuid(),'pending');
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_tasks_enqueue_modified_notifications AFTER UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.enqueue_task_modified_notifications();
CREATE OR REPLACE FUNCTION public.enqueue_task_assignment_notification()
RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE a public.task_assignments%ROWTYPE; BEGIN
 a:=CASE WHEN TG_OP='INSERT' THEN NEW ELSE OLD END;
 INSERT INTO public.notification_events(event_type,entity_id,task_id,cleaner_id,payload,dedupe_key,status)
 VALUES(CASE WHEN TG_OP='INSERT' THEN 'task_assigned' ELSE 'task_cancelled' END,a.task_id,a.task_id,a.cleaner_id,
   jsonb_build_object('writer_contract','legacy-cancellations-real'),'baseline-assignment:'||TG_OP||':'||a.id,'pending')
 ON CONFLICT(dedupe_key) DO NOTHING;
 RETURN COALESCE(NEW,OLD);
END $$;
CREATE TRIGGER trg_task_assignments_enqueue_notification AFTER INSERT OR DELETE ON public.task_assignments
FOR EACH ROW EXECUTE FUNCTION public.enqueue_task_assignment_notification();
CREATE OR REPLACE FUNCTION public.set_task_assignments(_task_id uuid,_cleaner_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  DELETE FROM public.task_assignments WHERE task_id=_task_id AND NOT (cleaner_id=ANY(COALESCE(_cleaner_ids,'{}')));
  INSERT INTO public.task_assignments(task_id,cleaner_id,cleaner_name)
  SELECT _task_id,c.id,c.name FROM public.cleaners c WHERE c.id=ANY(COALESCE(_cleaner_ids,'{}'))
  ON CONFLICT(task_id,cleaner_id) DO NOTHING;
  RETURN jsonb_build_object('success',true);
END $$;
CREATE OR REPLACE FUNCTION public.user_is_admin_or_manager() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')
$$;
CREATE OR REPLACE FUNCTION public.get_user_accessible_sedes() RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT COALESCE(array_agg(sede_id),'{}'::uuid[]) FROM public.user_sede_access
 WHERE user_id=auth.uid() AND can_access
$$;
-- Baseline fiel del writer AI: orden global tasks -> cleaners y persistencia
-- canónica + espejo legacy. Permite carreras reales A/B contra el batch.
CREATE OR REPLACE FUNCTION public.apply_ai_actions_transactional(_task_id uuid,_cleaner_id uuid,_start time,_end time)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE t public.tasks%ROWTYPE; cname text;
BEGIN
 SELECT * INTO t FROM public.tasks WHERE id=_task_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Tarea no encontrada'; END IF;
 SELECT name INTO cname FROM public.cleaners WHERE id=_cleaner_id FOR KEY SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Trabajador no encontrado'; END IF;
 UPDATE public.tasks SET start_time=_start,end_time=_end,cleaner_id=_cleaner_id,cleaner=cname WHERE id=_task_id;
 INSERT INTO public.task_assignments(task_id,cleaner_id,cleaner_name)
 VALUES(_task_id,_cleaner_id,cname) ON CONFLICT(task_id,cleaner_id) DO NOTHING;
 RETURN jsonb_build_object('success',true);
END $$;
-- Copia fiel de la RPC productiva inmediatamente anterior a 15000. Mantiene
-- auth, sede, legacy, outbox, proyección y resultado.
CREATE OR REPLACE FUNCTION public.deactivate_cleaner_with_future_assignments(
  _cleaner_id uuid,_unassign_future_tasks boolean DEFAULT true
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_cleaner public.cleaners%ROWTYPE; v_task record; v_remaining_names text;
  v_remaining_primary uuid; v_unassigned_count integer:=0;
  v_had_modern_assignment boolean;
BEGIN
  IF COALESCE(auth.role(),'')<>'service_role' AND NOT public.user_is_admin_or_manager() THEN
    RAISE EXCEPTION 'No autorizado para desactivar trabajadores' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_cleaner FROM public.cleaners WHERE id=_cleaner_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trabajador no encontrado'; END IF;
  IF COALESCE(auth.role(),'')<>'service_role'
     AND NOT (v_cleaner.sede_id=ANY(public.get_user_accessible_sedes())) THEN
    RAISE EXCEPTION 'No autorizado para desactivar trabajadores de esta sede' USING ERRCODE='42501';
  END IF;
  IF v_cleaner.is_active=false THEN
    RETURN jsonb_build_object('unassignedCount',0,'alreadyInactive',true);
  END IF;
  IF _unassign_future_tasks THEN
    FOR v_task IN
      SELECT t.id,t.sede_id FROM public.tasks t
      WHERE t.date >= (now() AT TIME ZONE 'Europe/Madrid')::date
        AND COALESCE(t.status,'pending') NOT IN ('completed','cancelled')
        AND (EXISTS(SELECT 1 FROM public.task_assignments ta WHERE ta.task_id=t.id AND ta.cleaner_id=_cleaner_id)
          OR t.cleaner_id=_cleaner_id OR (t.cleaner_id IS NULL AND t.cleaner=v_cleaner.name))
      ORDER BY t.id FOR UPDATE OF t
    LOOP
      SELECT EXISTS(SELECT 1 FROM public.task_assignments ta WHERE ta.task_id=v_task.id AND ta.cleaner_id=_cleaner_id)
        INTO v_had_modern_assignment;
      IF v_had_modern_assignment THEN
        DELETE FROM public.task_assignments WHERE task_id=v_task.id AND cleaner_id=_cleaner_id;
      ELSE
        INSERT INTO public.notification_events(event_type,entity_type,entity_id,task_id,cleaner_id,sede_id,payload,dedupe_key,status)
        VALUES('task_cancelled','tasks',v_task.id,v_task.id,_cleaner_id,v_task.sede_id,
          jsonb_build_object('source','deactivate_cleaner_legacy_assignment'),
          concat('task_cancelled:',v_task.id::text,':',_cleaner_id::text,':legacy-deactivation:',v_cleaner.activation_cycle_id::text),'pending')
        ON CONFLICT(dedupe_key) DO NOTHING;
      END IF;
      SELECT string_agg(c.name,', ' ORDER BY ta.assigned_at,ta.id),
             (array_agg(c.id ORDER BY ta.assigned_at,ta.id))[1]
        INTO v_remaining_names,v_remaining_primary
      FROM public.task_assignments ta JOIN public.cleaners c ON c.id=ta.cleaner_id
      WHERE ta.task_id=v_task.id;
      UPDATE public.tasks SET cleaner=v_remaining_names,cleaner_id=v_remaining_primary,updated_at=now()
      WHERE id=v_task.id;
      v_unassigned_count:=v_unassigned_count+1;
    END LOOP;
  END IF;
  UPDATE public.cleaners SET is_active=false,updated_at=now() WHERE id=_cleaner_id;
  RETURN jsonb_build_object('unassignedCount',v_unassigned_count,'alreadyInactive',false);
END $$;
CREATE OR REPLACE FUNCTION public.materialize_recurring_task(p_recurring_task_id uuid,p_execution_date date,p_next_execution date,p_schedule_snapshot jsonb)
RETURNS TABLE(generated_task_id uuid, was_created boolean) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.recurring_tasks%ROWTYPE; t uuid; created_now boolean := false;
BEGIN
 SELECT * INTO r FROM public.recurring_tasks WHERE id=p_recurring_task_id FOR UPDATE;
 IF NOT FOUND OR NOT r.is_active OR r.next_execution<>p_execution_date THEN RAISE EXCEPTION 'stale recurrence'; END IF;
 SELECT e.generated_task_id INTO t FROM public.recurring_task_executions e WHERE e.recurring_task_id=r.id AND e.execution_day=p_execution_date AND e.success LIMIT 1;
 IF t IS NULL THEN
   created_now := true;
   t:=gen_random_uuid(); INSERT INTO public.tasks(id,property,date,start_time,end_time,type,status,check_out,check_in,cleaner,cleaner_id,sede_id,duracion) VALUES(t,r.name,p_execution_date,r.start_time,r.end_time,r.type,'pending',r.check_out,r.check_in,r.cleaner,r.cleaner_id,r.sede_id,r.duracion);
   INSERT INTO public.recurring_task_executions(recurring_task_id,generated_task_id,execution_day,success) VALUES(r.id,t,p_execution_date,true);
 END IF;
 UPDATE public.recurring_tasks SET last_execution=p_execution_date,next_execution=COALESCE(p_next_execution,DATE '2099-12-31'),is_active=p_next_execution IS NOT NULL WHERE id=r.id;
 RETURN QUERY SELECT t, created_now;
END $$;
