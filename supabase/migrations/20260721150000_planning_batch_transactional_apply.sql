-- Fase 3: aplicación transaccional, idempotente y auditable de Planificación Hermes.
-- Migración expansion-only: no activa ningún writer ni realiza envíos externos.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS planning_version bigint NOT NULL DEFAULT 0;
ALTER TABLE public.planning_runs
  ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS applied_batch_id uuid;

CREATE OR REPLACE FUNCTION public.bump_task_planning_version()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF (to_jsonb(NEW) - ARRAY['planning_version','updated_at','approval_status','approval_requested_at','approved_at','rejected_at','approval_response_source','approval_rejection_reason','last_approval_reminder_at','late_start_reminder_sent_at'])
     IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['planning_version','updated_at','approval_status','approval_requested_at','approved_at','rejected_at','approval_response_source','approval_rejection_reason','last_approval_reminder_at','late_start_reminder_sent_at']) THEN
    NEW.planning_version := OLD.planning_version + 1;
  ELSE
    NEW.planning_version := OLD.planning_version;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_tasks_bump_planning_version ON public.tasks;
CREATE TRIGGER trg_tasks_bump_planning_version BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.bump_task_planning_version();

CREATE TABLE public.planning_apply_batches (
  id uuid PRIMARY KEY,
  sede_id uuid NOT NULL REFERENCES public.sedes(id),
  source_run_id uuid REFERENCES public.planning_runs(id) ON DELETE SET NULL,
  source_run_version bigint,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  request_items jsonb NOT NULL,
  actor_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('applying','applied','validation_failed','technical_failed')),
  expected_task_count integer NOT NULL CHECK (expected_task_count BETWEEN 1 AND 500),
  expected_assignment_count integer NOT NULL DEFAULT 0 CHECK (expected_assignment_count >= 0),
  notification_policy text NOT NULL CHECK (notification_policy IN ('require_all_recipients','best_effort')),
  result_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  failure_code text,
  failure_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE(sede_id,idempotency_key),
  CHECK (request_hash ~ '^[0-9a-f]{64}$')
);

ALTER TABLE public.planning_runs
  ADD CONSTRAINT planning_runs_applied_batch_id_fkey
  FOREIGN KEY (applied_batch_id) REFERENCES public.planning_apply_batches(id) ON DELETE SET NULL;

CREATE TABLE public.planning_apply_batch_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.planning_apply_batches(id) ON DELETE CASCADE,
  item_ordinal integer NOT NULL,
  item_key text NOT NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  recurring_task_id uuid REFERENCES public.recurring_tasks(id) ON DELETE SET NULL,
  execution_date date,
  expected_planning_version bigint,
  request_item jsonb NOT NULL,
  before_snapshot jsonb,
  after_snapshot jsonb,
  apply_status text NOT NULL CHECK (apply_status IN ('pending','applied','conflict','technical_failed')),
  conflict_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(batch_id,item_ordinal), UNIQUE(batch_id,item_key)
);

CREATE TABLE public.planning_assignment_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.planning_apply_batches(id) ON DELETE RESTRICT,
  batch_item_id uuid NOT NULL REFERENCES public.planning_apply_batch_items(id) ON DELETE RESTRICT,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  actor_id uuid NOT NULL,
  before_snapshot jsonb NOT NULL,
  after_snapshot jsonb NOT NULL,
  net_change text NOT NULL CHECK (net_change IN ('assigned','cancelled','modified','unchanged','mixed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(batch_item_id)
);

CREATE INDEX planning_apply_batches_source_run_idx ON public.planning_apply_batches(source_run_id);
CREATE INDEX planning_apply_batches_sede_created_idx ON public.planning_apply_batches(sede_id,created_at DESC);
CREATE INDEX planning_apply_batch_items_task_idx ON public.planning_apply_batch_items(task_id);
CREATE INDEX planning_assignment_audit_task_idx ON public.planning_assignment_audit(task_id,created_at DESC);

ALTER TABLE public.notification_events
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.planning_apply_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS recipient_worker_id uuid REFERENCES public.cleaners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recipient_name_snapshot text,
  ADD COLUMN IF NOT EXISTS recipient_phone_snapshot text,
  ADD COLUMN IF NOT EXISTS recipient_sequence integer,
  ADD COLUMN IF NOT EXISTS superseded_by uuid REFERENCES public.notification_events(id) ON DELETE SET NULL,
  -- Compatibilidad productiva: todo evento anterior y todo writer legado sin
  -- batch continúa live. Los eventos Hermes se fuerzan a shadow más abajo.
  ADD COLUMN IF NOT EXISTS notification_mode text NOT NULL DEFAULT 'live'
    CHECK (notification_mode IN ('shadow','test','live'));
CREATE INDEX IF NOT EXISTS notification_events_batch_idx ON public.notification_events(batch_id,created_at);

-- Espejo PostgreSQL de normalizeSpanishPhoneE164. No acepta teléfonos
-- enmascarados: retirar '*' no puede convertir una máscara en un móvil válido.
CREATE OR REPLACE FUNCTION public.normalize_spanish_phone_e164(_raw text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE v text;
BEGIN
 IF _raw IS NULL OR btrim(_raw)='' OR _raw ~ '[*xX]' THEN RETURN NULL; END IF;
 v:=regexp_replace(btrim(_raw),'[^0-9]','','g');
 IF v LIKE '00%' THEN v:=substr(v,3); END IF;
 IF length(v)=11 AND left(v,2)='34' THEN v:=substr(v,3); END IF;
 IF v !~ '^[67][0-9]{8}$' THEN RETURN NULL; END IF;
 RETURN '+34'||v;
END $$;
REVOKE ALL ON FUNCTION public.normalize_spanish_phone_e164(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.normalize_spanish_phone_e164(text) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.notification_event_is_live_send_allowed(_mode text,_batch_id uuid)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT _mode='live' AND _batch_id IS NULL
$$;
REVOKE ALL ON FUNCTION public.notification_event_is_live_send_allowed(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.notification_event_is_live_send_allowed(text,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_notification_event_delivery_mode()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE ctx_batch uuid; ctx_mode text;
BEGIN
 IF TG_OP='INSERT' THEN
  ctx_batch:=public.current_planning_batch_id();
  ctx_mode:=NULLIF(current_setting('app.planning_notification_mode',true),'');
  IF ctx_batch IS NOT NULL THEN
   NEW.batch_id:=ctx_batch;
   NEW.notification_mode:=CASE WHEN ctx_mode='test' THEN 'test' ELSE 'shadow' END;
  ELSIF NEW.notification_mode IS NULL THEN
   NEW.notification_mode:='live';
  END IF;
 ELSIF OLD.batch_id IS NOT NULL THEN
  IF NEW.batch_id IS DISTINCT FROM OLD.batch_id THEN
   RAISE EXCEPTION 'NOTIFICATION_BATCH_IMMUTABLE' USING ERRCODE='23514';
  END IF;
  IF NEW.notification_mode NOT IN ('shadow','test') THEN
   RAISE EXCEPTION 'NOTIFICATION_BATCH_MODE_IMMUTABLE' USING ERRCODE='23514';
  END IF;
 END IF;
 IF NEW.status='processing'
    AND NOT public.notification_event_is_live_send_allowed(NEW.notification_mode,NEW.batch_id) THEN
  RAISE EXCEPTION 'NOTIFICATION_LIVE_DISABLED' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notification_events_prevent_non_live_claim ON public.notification_events;
CREATE TRIGGER trg_notification_events_prevent_non_live_claim BEFORE INSERT OR UPDATE ON public.notification_events
FOR EACH ROW EXECUTE FUNCTION public.enforce_notification_event_delivery_mode();

ALTER TABLE public.planning_apply_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_apply_batch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_assignment_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.planning_apply_batches,public.planning_apply_batch_items,public.planning_assignment_audit FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.planning_apply_batches,public.planning_apply_batch_items,public.planning_assignment_audit TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.planning_apply_batches,public.planning_apply_batch_items,public.planning_assignment_audit TO service_role;

CREATE POLICY planning_apply_batches_read_scope ON public.planning_apply_batches FOR SELECT TO authenticated
USING ((public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'manager'::public.app_role)) AND public.user_has_sede_access(auth.uid(),sede_id));
CREATE POLICY planning_apply_batch_items_read_scope ON public.planning_apply_batch_items FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.planning_apply_batches b WHERE b.id=batch_id AND (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'manager'::public.app_role)) AND public.user_has_sede_access(auth.uid(),b.sede_id)));
CREATE POLICY planning_assignment_audit_read_scope ON public.planning_assignment_audit FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.planning_apply_batches b WHERE b.id=batch_id AND (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'manager'::public.app_role)) AND public.user_has_sede_access(auth.uid(),b.sede_id)));

CREATE OR REPLACE FUNCTION public.planning_batch_request_hash(
  _sede_id uuid,_source_run_id uuid,_source_run_version bigint,_notification_policy text,_items jsonb
) RETURNS text LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 SELECT encode(digest(convert_to(jsonb_build_object(
   'sede_id',_sede_id,'source_run_id',_source_run_id,'source_run_version',_source_run_version,
   'notification_policy',_notification_policy,'items',_items)::text,'UTF8'),'sha256'),'hex')
$$;
REVOKE ALL ON FUNCTION public.planning_batch_request_hash(uuid,uuid,bigint,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.planning_batch_request_hash(uuid,uuid,bigint,text,jsonb) TO authenticated,service_role;

-- Solo reconoce el contexto si corresponde a un batch applying del mismo actor.
CREATE OR REPLACE FUNCTION public.current_planning_batch_id() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v uuid;
BEGIN
  BEGIN v:=NULLIF(current_setting('app.planning_batch_id',true),'')::uuid; EXCEPTION WHEN invalid_text_representation THEN RETURN NULL; END;
  IF v IS NULL THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM public.planning_apply_batches WHERE id=v AND status='applying' AND actor_id=auth.uid()) THEN RETURN v; END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.current_planning_batch_id() FROM PUBLIC,anon,authenticated;

-- Relación efectiva durante la transición: una tarea canónica nunca se duplica
-- con su espejo legacy. El fallback textual exige un único nombre normalizado,
-- activo y de la misma sede; 0 o N coincidencias no atribuyen la tarea.
CREATE OR REPLACE FUNCTION public.planning_effective_task_assignments()
RETURNS TABLE(task_id uuid,cleaner_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT ta.task_id,ta.cleaner_id FROM public.task_assignments ta
 UNION ALL
 SELECT t.id,t.cleaner_id FROM public.tasks t
 WHERE t.cleaner_id IS NOT NULL
   AND NOT EXISTS(SELECT 1 FROM public.task_assignments ta WHERE ta.task_id=t.id)
 UNION ALL
 SELECT t.id,matched.cleaner_id FROM public.tasks t
 JOIN LATERAL (
   SELECT (array_agg(c.id ORDER BY c.id))[1] cleaner_id
   FROM public.cleaners c
   WHERE c.sede_id=t.sede_id AND c.is_active
     AND regexp_replace(lower(btrim(c.name)),'[[:space:]]+',' ','g')
         =regexp_replace(lower(btrim(t.cleaner)),'[[:space:]]+',' ','g')
   HAVING count(*)=1
 ) matched ON true
 WHERE t.cleaner_id IS NULL AND t.cleaner IS NOT NULL
   AND NOT EXISTS(SELECT 1 FROM public.task_assignments ta WHERE ta.task_id=t.id)
$$;
REVOKE ALL ON FUNCTION public.planning_effective_task_assignments() FROM PUBLIC,anon,authenticated;

-- Protocolo global anti-TOCTOU. Tras los locks de filas propios de cada writer,
-- todos adquieren scope de trabajador y después cleaner+fecha en orden textual
-- estable. Los guards son AFTER para que FK/filas precedan siempre al advisory;
-- una excepción todavía revierte íntegramente la sentencia/transacción.
CREATE OR REPLACE FUNCTION public.planning_lock_worker_dates(_pairs jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('planning-worker-scope:'||p.cid,0))
 FROM (SELECT DISTINCT x->>'cleaner_id' cid FROM jsonb_array_elements(COALESCE(_pairs,'[]'))x
       WHERE COALESCE(x->>'cleaner_id','')~*'^[0-9a-f-]{36}$' ORDER BY 1)p;
 PERFORM pg_advisory_xact_lock(hashtextextended('planning-worker-date:'||p.cid||':'||p.d,0))
 FROM (SELECT DISTINCT x->>'cleaner_id' cid,x->>'date' d FROM jsonb_array_elements(COALESCE(_pairs,'[]'))x
       WHERE COALESCE(x->>'cleaner_id','')~*'^[0-9a-f-]{36}$' AND COALESCE(x->>'date','')~'^\d{4}-\d{2}-\d{2}$'
       ORDER BY 1,2)p;
END $$;
REVOKE ALL ON FUNCTION public.planning_lock_worker_dates(jsonb) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.planning_assert_worker_task_valid(
 _cleaner_id uuid,_task_id uuid,_date date,_start time,_end time,_status text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF COALESCE(_status,'pending') IN ('completed','cancelled') THEN RETURN; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.cleaners WHERE id=_cleaner_id AND is_active) THEN
  RAISE EXCEPTION 'PLANNING_WORKER_INACTIVE' USING ERRCODE='23514';
 END IF;
 IF EXISTS(SELECT 1 FROM public.cleaner_availability ca WHERE ca.cleaner_id=_cleaner_id
   AND ca.day_of_week=extract(dow from _date)::int
   AND (NOT ca.is_available OR _start<ca.start_time OR _end>ca.end_time)) THEN
  RAISE EXCEPTION 'PLANNING_OUTSIDE_AVAILABILITY' USING ERRCODE='23514';
 END IF;
 IF EXISTS(SELECT 1 FROM public.worker_absences wa WHERE wa.cleaner_id=_cleaner_id
   AND _date BETWEEN wa.start_date AND wa.end_date
   AND (wa.start_time IS NULL OR (_start<wa.end_time AND wa.start_time<_end))) THEN
  RAISE EXCEPTION 'PLANNING_WORKER_ABSENT' USING ERRCODE='23514';
 END IF;
 IF EXISTS(SELECT 1 FROM public.worker_fixed_days_off wd WHERE wd.cleaner_id=_cleaner_id
   AND wd.is_active AND wd.day_of_week=extract(dow from _date)::int) THEN
  RAISE EXCEPTION 'PLANNING_WORKER_FIXED_DAY_OFF' USING ERRCODE='23514';
 END IF;
 IF EXISTS(SELECT 1 FROM public.worker_maintenance_cleanings wm WHERE wm.cleaner_id=_cleaner_id
   AND wm.is_active AND extract(dow from _date)::int=ANY(wm.days_of_week)
   AND _start<wm.end_time AND wm.start_time<_end) THEN
  RAISE EXCEPTION 'PLANNING_MAINTENANCE_OVERLAP' USING ERRCODE='23514';
 END IF;
 IF EXISTS(SELECT 1 FROM public.planning_effective_task_assignments() ea JOIN public.tasks t ON t.id=ea.task_id
   WHERE ea.cleaner_id=_cleaner_id AND t.id<>_task_id AND t.date=_date
   AND t.status NOT IN ('completed','cancelled') AND t.start_time<_end AND _start<t.end_time) THEN
  RAISE EXCEPTION 'PLANNING_EXTERNAL_OVERLAP' USING ERRCODE='23514';
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.planning_assert_worker_task_valid(uuid,uuid,date,time,time,text) FROM PUBLIC,anon,authenticated;

-- Endurece sin reescribir el writer canónico previo: el wrapper bloquea y
-- relee el conjunto completo current+desired, y luego delega su semántica
-- exacta a la implementación desplegada antes de 15000.
DO $$ BEGIN
 IF to_regprocedure('public.set_task_assignments(uuid,uuid[])') IS NOT NULL
    AND to_regprocedure('public.set_task_assignments_unlocked_15000(uuid,uuid[])') IS NULL THEN
  ALTER FUNCTION public.set_task_assignments(uuid,uuid[]) RENAME TO set_task_assignments_unlocked_15000;
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.set_task_assignments(_task_id uuid,_cleaner_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE ids uuid[]; task_row public.tasks%ROWTYPE; pairs jsonb;
BEGIN
 SELECT COALESCE(array_agg(id ORDER BY ord),'{}') INTO ids FROM (
  SELECT DISTINCT ON (id) id,ord FROM unnest(COALESCE(_cleaner_ids,'{}')) WITH ORDINALITY q(id,ord)
  WHERE id IS NOT NULL ORDER BY id,ord
 )d;
 SELECT * INTO task_row FROM public.tasks WHERE id=_task_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Tarea no encontrada'; END IF;
 IF COALESCE(auth.role(),'')<>'service_role' AND NOT (
  EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role::text IN ('admin','manager','supervisor'))
  AND public.user_has_sede_access(auth.uid(),task_row.sede_id)
 ) THEN RAISE EXCEPTION 'No autorizado para gestionar asignaciones de esta sede' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.cleaners WHERE id=ANY(ids) ORDER BY id FOR KEY SHARE;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('cleaner_id',p.cid,'date',task_row.date)),'[]') INTO pairs FROM (
  SELECT unnest(ids) cid UNION SELECT cleaner_id FROM public.planning_effective_task_assignments() WHERE task_id=_task_id
 )p;
 PERFORM public.planning_lock_worker_dates(pairs);
 RETURN public.set_task_assignments_unlocked_15000(_task_id,ids);
END $$;
REVOKE ALL ON FUNCTION public.set_task_assignments_unlocked_15000(uuid,uuid[]) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.set_task_assignments(uuid,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_task_assignments(uuid,uuid[]) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.guard_task_assignment_planning_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE pairs jsonb:='[]'; t public.tasks%ROWTYPE;
BEGIN
 IF TG_OP IN ('UPDATE','DELETE') THEN
  SELECT * INTO t FROM public.tasks WHERE id=OLD.task_id;
  IF FOUND THEN pairs:=pairs||jsonb_build_array(jsonb_build_object('cleaner_id',OLD.cleaner_id,'date',t.date)); END IF;
 END IF;
 IF TG_OP IN ('INSERT','UPDATE') THEN
  SELECT * INTO t FROM public.tasks WHERE id=NEW.task_id;
  IF FOUND THEN pairs:=pairs||jsonb_build_array(jsonb_build_object('cleaner_id',NEW.cleaner_id,'date',t.date)); END IF;
 END IF;
 PERFORM public.planning_lock_worker_dates(pairs);
 IF TG_OP IN ('INSERT','UPDATE') AND public.current_planning_batch_id() IS NULL THEN
  IF t.id IS NOT NULL THEN PERFORM public.planning_assert_worker_task_valid(NEW.cleaner_id,NEW.task_id,t.date,t.start_time,t.end_time,t.status); END IF;
 END IF;
 RETURN COALESCE(NEW,OLD);
END $$;
DROP TRIGGER IF EXISTS trg_task_assignments_planning_guard ON public.task_assignments;
CREATE TRIGGER trg_task_assignments_planning_guard AFTER INSERT OR UPDATE OR DELETE ON public.task_assignments
FOR EACH ROW EXECUTE FUNCTION public.guard_task_assignment_planning_write();

CREATE OR REPLACE FUNCTION public.guard_task_schedule_planning_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE pairs jsonb; cid uuid;
BEGIN
 IF ROW(OLD.date,OLD.start_time,OLD.end_time,OLD.status) IS NOT DISTINCT FROM ROW(NEW.date,NEW.start_time,NEW.end_time,NEW.status) THEN RETURN NEW; END IF;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('cleaner_id',q.cid,'date',q.d)),'[]') INTO pairs FROM (
  SELECT ta.cleaner_id cid,OLD.date d FROM public.task_assignments ta WHERE ta.task_id=OLD.id
  UNION SELECT ta.cleaner_id,NEW.date FROM public.task_assignments ta WHERE ta.task_id=OLD.id
  UNION SELECT OLD.cleaner_id,OLD.date WHERE OLD.cleaner_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.task_assignments WHERE task_id=OLD.id)
  UNION SELECT OLD.cleaner_id,NEW.date WHERE OLD.cleaner_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.task_assignments WHERE task_id=OLD.id)
 )q;
 PERFORM public.planning_lock_worker_dates(pairs);
 IF public.current_planning_batch_id() IS NULL THEN
  FOR cid IN SELECT DISTINCT ta.cleaner_id FROM public.task_assignments ta WHERE ta.task_id=OLD.id
             UNION SELECT OLD.cleaner_id WHERE OLD.cleaner_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.task_assignments WHERE task_id=OLD.id)
  LOOP PERFORM public.planning_assert_worker_task_valid(cid,NEW.id,NEW.date,NEW.start_time,NEW.end_time,NEW.status); END LOOP;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_tasks_planning_schedule_guard ON public.tasks;
CREATE TRIGGER trg_tasks_planning_schedule_guard AFTER UPDATE OF date,start_time,end_time,status ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.guard_task_schedule_planning_write();

CREATE OR REPLACE FUNCTION public.guard_cleaner_availability_planning_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE pairs jsonb:='[]';
BEGIN
 IF TG_OP IN ('UPDATE','DELETE') THEN pairs:=pairs||jsonb_build_array(jsonb_build_object('cleaner_id',OLD.cleaner_id)); END IF;
 IF TG_OP IN ('INSERT','UPDATE') THEN pairs:=pairs||jsonb_build_array(jsonb_build_object('cleaner_id',NEW.cleaner_id)); END IF;
 PERFORM public.planning_lock_worker_dates(pairs);
 IF TG_OP IN ('INSERT','UPDATE') AND EXISTS(
  SELECT 1 FROM public.task_assignments ta JOIN public.tasks t ON t.id=ta.task_id
  WHERE ta.cleaner_id=NEW.cleaner_id AND t.status NOT IN ('completed','cancelled')
   AND extract(dow from t.date)::int=NEW.day_of_week
   AND (NOT NEW.is_available OR t.start_time<NEW.start_time OR t.end_time>NEW.end_time)
 ) THEN RAISE EXCEPTION 'PLANNING_AVAILABILITY_CONFLICT' USING ERRCODE='23514'; END IF;
 RETURN COALESCE(NEW,OLD);
END $$;
DROP TRIGGER IF EXISTS trg_cleaner_availability_planning_guard ON public.cleaner_availability;
CREATE TRIGGER trg_cleaner_availability_planning_guard AFTER INSERT OR UPDATE OR DELETE ON public.cleaner_availability
FOR EACH ROW EXECUTE FUNCTION public.guard_cleaner_availability_planning_write();

CREATE OR REPLACE FUNCTION public.guard_worker_absence_planning_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE pairs jsonb:='[]';
BEGIN
 IF TG_OP IN ('UPDATE','DELETE') THEN pairs:=pairs||jsonb_build_array(jsonb_build_object('cleaner_id',OLD.cleaner_id)); END IF;
 IF TG_OP IN ('INSERT','UPDATE') THEN pairs:=pairs||jsonb_build_array(jsonb_build_object('cleaner_id',NEW.cleaner_id)); END IF;
 PERFORM public.planning_lock_worker_dates(pairs);
 IF TG_OP IN ('INSERT','UPDATE') AND EXISTS(
  SELECT 1 FROM public.task_assignments ta JOIN public.tasks t ON t.id=ta.task_id
  WHERE ta.cleaner_id=NEW.cleaner_id AND t.status NOT IN ('completed','cancelled')
   AND t.date BETWEEN NEW.start_date AND NEW.end_date
   AND (NEW.start_time IS NULL OR (t.start_time<NEW.end_time AND NEW.start_time<t.end_time))
 ) THEN RAISE EXCEPTION 'PLANNING_ABSENCE_CONFLICT' USING ERRCODE='23514'; END IF;
 RETURN COALESCE(NEW,OLD);
END $$;
DROP TRIGGER IF EXISTS trg_worker_absences_planning_guard ON public.worker_absences;
CREATE TRIGGER trg_worker_absences_planning_guard AFTER INSERT OR UPDATE OR DELETE ON public.worker_absences
FOR EACH ROW EXECUTE FUNCTION public.guard_worker_absence_planning_write();

CREATE OR REPLACE FUNCTION public.guard_worker_maintenance_planning_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE pairs jsonb:='[]';
BEGIN
 IF TG_OP IN ('UPDATE','DELETE') THEN pairs:=pairs||jsonb_build_array(jsonb_build_object('cleaner_id',OLD.cleaner_id)); END IF;
 IF TG_OP IN ('INSERT','UPDATE') THEN pairs:=pairs||jsonb_build_array(jsonb_build_object('cleaner_id',NEW.cleaner_id)); END IF;
 PERFORM public.planning_lock_worker_dates(pairs);
 IF TG_OP IN ('INSERT','UPDATE') AND NEW.is_active AND EXISTS(
  SELECT 1 FROM public.task_assignments ta JOIN public.tasks t ON t.id=ta.task_id
  WHERE ta.cleaner_id=NEW.cleaner_id AND t.status NOT IN ('completed','cancelled')
   AND extract(dow from t.date)::int=ANY(NEW.days_of_week)
   AND t.start_time<NEW.end_time AND NEW.start_time<t.end_time
 ) THEN RAISE EXCEPTION 'PLANNING_MAINTENANCE_CONFLICT' USING ERRCODE='23514'; END IF;
 RETURN COALESCE(NEW,OLD);
END $$;
DROP TRIGGER IF EXISTS trg_worker_maintenance_planning_guard ON public.worker_maintenance_cleanings;
CREATE TRIGGER trg_worker_maintenance_planning_guard AFTER INSERT OR UPDATE OR DELETE ON public.worker_maintenance_cleanings
FOR EACH ROW EXECUTE FUNCTION public.guard_worker_maintenance_planning_write();

CREATE OR REPLACE FUNCTION public.guard_worker_fixed_day_off_planning_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE pairs jsonb:='[]';
BEGIN
 IF TG_OP IN ('UPDATE','DELETE') THEN pairs:=pairs||jsonb_build_array(jsonb_build_object('cleaner_id',OLD.cleaner_id)); END IF;
 IF TG_OP IN ('INSERT','UPDATE') THEN pairs:=pairs||jsonb_build_array(jsonb_build_object('cleaner_id',NEW.cleaner_id)); END IF;
 PERFORM public.planning_lock_worker_dates(pairs);
 IF TG_OP IN ('INSERT','UPDATE') AND NEW.is_active AND EXISTS(
  SELECT 1 FROM public.task_assignments ta JOIN public.tasks t ON t.id=ta.task_id
  WHERE ta.cleaner_id=NEW.cleaner_id AND t.status NOT IN ('completed','cancelled')
   AND extract(dow from t.date)::int=NEW.day_of_week
 ) THEN RAISE EXCEPTION 'PLANNING_FIXED_DAY_OFF_CONFLICT' USING ERRCODE='23514'; END IF;
 RETURN COALESCE(NEW,OLD);
END $$;
DROP TRIGGER IF EXISTS trg_worker_fixed_days_off_planning_guard ON public.worker_fixed_days_off;
CREATE TRIGGER trg_worker_fixed_days_off_planning_guard AFTER INSERT OR UPDATE OR DELETE ON public.worker_fixed_days_off
FOR EACH ROW EXECUTE FUNCTION public.guard_worker_fixed_day_off_planning_write();

-- Redefine la RPC canónica preservando firma, auth, sede, outbox, proyección y
-- resultado. El orden común es tasks(UUID) -> cleaner -> advisory guards. La
-- segunda consulta, ya con cleaner bloqueada, incorpora asignaciones que
-- terminaron justo antes del lock; un writer nuevo queda bloqueado en cleaner y
-- al continuar revalida is_active=false, sin inversión ni ventana TOCTOU.
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

 -- Snapshot sin lock solo para descubrir el conjunto inicial y autorizar sede.
 SELECT * INTO v_cleaner FROM public.cleaners WHERE id=_cleaner_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Trabajador no encontrado'; END IF;
 IF COALESCE(auth.role(),'')<>'service_role'
    AND NOT (v_cleaner.sede_id=ANY(public.get_user_accessible_sedes())) THEN
  RAISE EXCEPTION 'No autorizado para desactivar trabajadores de esta sede' USING ERRCODE='42501';
 END IF;

 IF _unassign_future_tasks THEN
  PERFORM t.id FROM public.tasks t
  WHERE t.date >= (now() AT TIME ZONE 'Europe/Madrid')::date
    AND COALESCE(t.status,'pending') NOT IN ('completed','cancelled')
    AND (
      EXISTS(SELECT 1 FROM public.task_assignments ta WHERE ta.task_id=t.id AND ta.cleaner_id=_cleaner_id)
      OR t.cleaner_id=_cleaner_id
      OR (t.cleaner_id IS NULL AND EXISTS(
        SELECT 1 FROM public.planning_effective_task_assignments() ea
        WHERE ea.task_id=t.id AND ea.cleaner_id=_cleaner_id
      ))
    )
  ORDER BY t.id FOR UPDATE;
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
 PERFORM set_config('app.planning_deactivation_cleaner_id',_cleaner_id::text,true);

 IF _unassign_future_tasks THEN
  -- Relectura obligatoria tras cleaner lock: incluye carreras ya confirmadas.
  PERFORM t.id FROM public.tasks t
  WHERE t.date >= (now() AT TIME ZONE 'Europe/Madrid')::date
    AND COALESCE(t.status,'pending') NOT IN ('completed','cancelled')
    AND (
      EXISTS(SELECT 1 FROM public.task_assignments ta WHERE ta.task_id=t.id AND ta.cleaner_id=_cleaner_id)
      OR t.cleaner_id=_cleaner_id
      OR (t.cleaner_id IS NULL AND EXISTS(
        SELECT 1 FROM public.planning_effective_task_assignments() ea
        WHERE ea.task_id=t.id AND ea.cleaner_id=_cleaner_id
      ))
    )
  ORDER BY t.id FOR UPDATE;

  FOR v_task IN
   SELECT t.id,t.sede_id FROM public.tasks t
   WHERE t.date >= (now() AT TIME ZONE 'Europe/Madrid')::date
     AND COALESCE(t.status,'pending') NOT IN ('completed','cancelled')
     AND (
       EXISTS(SELECT 1 FROM public.task_assignments ta WHERE ta.task_id=t.id AND ta.cleaner_id=_cleaner_id)
       OR t.cleaner_id=_cleaner_id
       OR (t.cleaner_id IS NULL AND EXISTS(
         SELECT 1 FROM public.planning_effective_task_assignments() ea
         WHERE ea.task_id=t.id AND ea.cleaner_id=_cleaner_id
       ))
     )
   ORDER BY t.id
  LOOP
   SELECT EXISTS(SELECT 1 FROM public.task_assignments ta WHERE ta.task_id=v_task.id AND ta.cleaner_id=_cleaner_id)
    INTO v_had_modern_assignment;
   IF v_had_modern_assignment THEN
    DELETE FROM public.task_assignments WHERE task_id=v_task.id AND cleaner_id=_cleaner_id;
   ELSE
    INSERT INTO public.notification_events(
     event_type,entity_type,entity_id,task_id,cleaner_id,sede_id,payload,dedupe_key,status
    ) VALUES(
     'task_cancelled','tasks',v_task.id,v_task.id,_cleaner_id,v_task.sede_id,
     jsonb_build_object('source','deactivate_cleaner_legacy_assignment'),
     concat('task_cancelled:',v_task.id::text,':',_cleaner_id::text,':legacy-deactivation:',v_cleaner.activation_cycle_id::text),
     'pending'
    ) ON CONFLICT(dedupe_key) DO NOTHING;
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
REVOKE ALL ON FUNCTION public.deactivate_cleaner_with_future_assignments(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.deactivate_cleaner_with_future_assignments(uuid,boolean) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.guard_cleaner_deactivation_planning_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF OLD.is_active AND NOT NEW.is_active THEN
  PERFORM public.planning_lock_worker_dates(jsonb_build_array(jsonb_build_object('cleaner_id',NEW.id)));
  IF NULLIF(current_setting('app.planning_deactivation_cleaner_id',true),'') IS DISTINCT FROM NEW.id::text
     AND EXISTS(SELECT 1 FROM public.task_assignments ta JOIN public.tasks t ON t.id=ta.task_id
                WHERE ta.cleaner_id=NEW.id AND t.status NOT IN ('completed','cancelled')) THEN
   RAISE EXCEPTION 'PLANNING_DEACTIVATION_REQUIRES_RPC' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_cleaners_planning_deactivation_guard ON public.cleaners;
CREATE TRIGGER trg_cleaners_planning_deactivation_guard AFTER UPDATE OF is_active ON public.cleaners
FOR EACH ROW EXECUTE FUNCTION public.guard_cleaner_deactivation_planning_write();

-- Los writers productivos de asignación/modificación/cancelación permanecen
-- intactos. El trigger BEFORE de notification_events añade contexto de batch
-- sin exigir que cada writer conozca las columnas nuevas.

CREATE OR REPLACE FUNCTION public.apply_planning_batch(
  _batch_id uuid,_idempotency_key text,_sede_id uuid,_source_run_id uuid,
  _source_run_version bigint,_request_hash text,_notification_policy text,_items jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE
 v_actor uuid:=auth.uid(); v_count integer; v_expected_assignments integer; v_hash text; v_existing public.planning_apply_batches%ROWTYPE;
 v_conflicts jsonb:='[]'::jsonb; v_work jsonb:=_items; v_item jsonb; v_task public.tasks%ROWTYPE; v_rec public.recurring_tasks%ROWTYPE;
 v_ord integer; v_key text; v_task_id uuid; v_generated uuid; v_created boolean; v_old_ids uuid[]; v_new_ids uuid[];
 v_before jsonb; v_after jsonb; v_summary jsonb; v_error text; v_error_context text; v_changed integer:=0;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=v_actor AND role::text IN ('admin','manager')) THEN
  RAISE EXCEPTION 'PLANNING_FORBIDDEN' USING ERRCODE='42501';
 END IF;
 IF NOT public.user_has_sede_access(v_actor,_sede_id) THEN RAISE EXCEPTION 'PLANNING_SEDE_FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF _batch_id IS NULL OR length(btrim(COALESCE(_idempotency_key,'')))<8 OR length(_idempotency_key)>200 THEN
  RETURN jsonb_build_object('status','validation_failed','code','INVALID_BATCH_IDEMPOTENCY','batch_id',COALESCE(_batch_id,'00000000-0000-0000-0000-000000000000'::uuid),'idempotent_replay',false,'applied_task_count',0,'applied_assignment_count',0,'notification_event_count',0,'conflicts',jsonb_build_array(jsonb_build_object('code','INVALID_BATCH_IDEMPOTENCY')));
 END IF;

 -- El payload jsonb recibido ya está canonicalizado por PostgreSQL. Su hash
 -- efectivo se calcula siempre antes de mirar un replay; _request_hash queda
 -- como dato de compatibilidad del cliente, nunca como autoridad.
 IF jsonb_typeof(_items) IS DISTINCT FROM 'array' THEN
  RETURN jsonb_build_object('status','validation_failed','code','ITEMS_MUST_BE_ARRAY','batch_id',_batch_id,'idempotent_replay',false,'applied_task_count',0,'applied_assignment_count',0,'notification_event_count',0,'conflicts',jsonb_build_array(jsonb_build_object('code','ITEMS_MUST_BE_ARRAY')));
 END IF;
 v_count:=jsonb_array_length(_items);
 IF v_count<1 OR v_count>500 THEN
  RETURN jsonb_build_object('status','validation_failed','code','ITEM_COUNT_OUT_OF_RANGE','batch_id',_batch_id,'idempotent_replay',false,'applied_task_count',0,'applied_assignment_count',0,'notification_event_count',0,'conflicts',jsonb_build_array(jsonb_build_object('code','ITEM_COUNT_OUT_OF_RANGE')));
 END IF;
 IF _notification_policy NOT IN ('require_all_recipients','best_effort') THEN
  RETURN jsonb_build_object('status','validation_failed','code','INVALID_NOTIFICATION_POLICY','batch_id',_batch_id,'idempotent_replay',false,'applied_task_count',0,'applied_assignment_count',0,'notification_event_count',0,'conflicts',jsonb_build_array(jsonb_build_object('code','INVALID_NOTIFICATION_POLICY')));
 END IF;
 v_hash:=public.planning_batch_request_hash(_sede_id,_source_run_id,_source_run_version,_notification_policy,_items);

 PERFORM pg_advisory_xact_lock(hashtextextended('planning-sede:'||_sede_id::text,0));
 SELECT * INTO v_existing FROM public.planning_apply_batches WHERE sede_id=_sede_id AND idempotency_key=_idempotency_key FOR UPDATE;
 IF FOUND THEN
  IF v_existing.request_hash<>v_hash OR v_existing.id<>_batch_id THEN
   RETURN jsonb_build_object('status','validation_failed','code','IDEMPOTENCY_CONFLICT','batch_id',v_existing.id,'idempotent_replay',false,'applied_task_count',0,'applied_assignment_count',0,'notification_event_count',0,'conflicts',jsonb_build_array(jsonb_build_object('code','IDEMPOTENCY_CONFLICT')));
  END IF;
  RETURN v_existing.result_summary||jsonb_build_object('status',v_existing.status,'batch_id',v_existing.id,'idempotent_replay',true);
 END IF;
 IF EXISTS(SELECT 1 FROM public.planning_apply_batches WHERE id=_batch_id) THEN RETURN jsonb_build_object('status','validation_failed','code','BATCH_IDEMPOTENCY_CONFLICT','batch_id',_batch_id,'idempotent_replay',false,'applied_task_count',0,'applied_assignment_count',0,'notification_event_count',0,'conflicts',jsonb_build_array(jsonb_build_object('code','BATCH_IDEMPOTENCY_CONFLICT'))); END IF;

 SELECT COALESCE(sum(CASE WHEN jsonb_typeof(x->'cleaner_ids')='array' THEN jsonb_array_length(x->'cleaner_ids') ELSE 0 END),0)::int INTO v_expected_assignments FROM jsonb_array_elements(_items) x;
 INSERT INTO public.planning_apply_batches(id,sede_id,source_run_id,source_run_version,idempotency_key,request_hash,request_items,actor_id,status,expected_task_count,expected_assignment_count,notification_policy)
 VALUES(_batch_id,_sede_id,_source_run_id,_source_run_version,_idempotency_key,v_hash,_items,v_actor,'applying',v_count,v_expected_assignments,_notification_policy);
 PERFORM set_config('app.planning_batch_id',_batch_id::text,true);
 PERFORM set_config('app.planning_notification_mode','shadow',true);

 BEGIN
  -- Forma, duplicados y source run.
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(_items) x WHERE jsonb_typeof(x)<>'object' OR ((x?'task_id')=(x?'recurring_task_id'))
    OR NOT (x?'date' AND x?'start_time' AND x?'end_time' AND x?'cleaner_ids') OR jsonb_typeof(x->'cleaner_ids')<>'array'
    OR (x?'task_id' AND (NOT (x?'expected_planning_version' AND x?'expected_status' AND x?'expected_cleaner_ids') OR COALESCE(x->>'task_id','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'))
    OR (x?'recurring_task_id' AND (NOT (x?'execution_date' AND x?'expected_recurring_revision' AND x?'schedule_snapshot') OR COALESCE(x->>'recurring_task_id','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'))
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(x->'cleaner_ids')='array' THEN x->'cleaner_ids' ELSE '[]'::jsonb END)e WHERE COALESCE(e#>>'{}','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) THEN
   v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object('code','INVALID_ITEM_SCHEMA'));
  END IF;
  IF EXISTS(SELECT 1 FROM (SELECT COALESCE(x->>'task_id',(x->>'recurring_task_id')||':'||(x->>'execution_date')) k,count(*) FROM jsonb_array_elements(_items)x GROUP BY 1 HAVING count(*)>1)d) THEN
   v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object('code','DUPLICATE_ITEM'));
  END IF;
  IF _source_run_id IS NOT NULL THEN
   IF NOT EXISTS(SELECT 1 FROM public.planning_runs WHERE id=_source_run_id AND sede_id=_sede_id AND status IN ('draft','approved') AND version=_source_run_version FOR UPDATE) THEN
    v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object('code','SOURCE_RUN_STALE'));
   END IF;
  END IF;

  -- No se intenta bloquear ni castear payloads estructuralmente inválidos.
  IF jsonb_array_length(v_conflicts)>0 THEN
   INSERT INTO public.planning_apply_batch_items(batch_id,item_ordinal,item_key,request_item,apply_status,conflict_code)
   SELECT _batch_id,o,COALESCE(x->>'task_id',x->>'recurring_task_id','invalid')||':'||o,x,'conflict','BATCH_VALIDATION_FAILED'
   FROM jsonb_array_elements(_items) WITH ORDINALITY q(x,o);
   UPDATE public.planning_apply_batches SET status='validation_failed',failure_code='VALIDATION_FAILED',failure_summary=jsonb_build_object('conflicts',v_conflicts),completed_at=now(),result_summary=jsonb_build_object('status','validation_failed','code','VALIDATION_FAILED','conflicts',v_conflicts,'applied_task_count',0,'applied_assignment_count',0,'notification_event_count',0) WHERE id=_batch_id;
   RETURN (SELECT result_summary||jsonb_build_object('batch_id',id,'idempotent_replay',false) FROM public.planning_apply_batches WHERE id=_batch_id);
  END IF;

  -- Orden global compatible con los writers 13000: tasks, cleaners,
  -- recurrencias y, al final, protocolo común scope/cleaner+fecha.
  PERFORM 1 FROM public.tasks WHERE id IN (
   SELECT (x->>'task_id')::uuid FROM jsonb_array_elements(_items)x WHERE x?'task_id'
   UNION
   SELECT rte.generated_task_id FROM public.recurring_task_executions rte
   JOIN jsonb_array_elements(_items)x ON x?'recurring_task_id'
    AND rte.recurring_task_id=(x->>'recurring_task_id')::uuid
    AND rte.execution_day=(x->>'execution_date')::date AND rte.success
  ) ORDER BY id FOR UPDATE;
  PERFORM 1 FROM public.cleaners WHERE id IN (
   SELECT (e#>>'{}')::uuid FROM jsonb_array_elements(_items)x
   CROSS JOIN LATERAL jsonb_array_elements(COALESCE(x->'cleaner_ids','[]'))e
  ) ORDER BY id FOR KEY SHARE;
  PERFORM 1 FROM public.recurring_tasks WHERE id IN (SELECT (x->>'recurring_task_id')::uuid FROM jsonb_array_elements(_items)x WHERE x?'recurring_task_id') ORDER BY id FOR UPDATE;
  PERFORM public.planning_lock_worker_dates(COALESCE((SELECT jsonb_agg(jsonb_build_object('cleaner_id',p.cid,'date',p.d)) FROM (
   SELECT DISTINCT (e#>>'{}')::uuid cid,(x->>'date')::date d
   FROM jsonb_array_elements(_items)x CROSS JOIN LATERAL jsonb_array_elements(COALESCE(x->'cleaner_ids','[]'))e
   UNION
   SELECT ea.cleaner_id,t.date FROM jsonb_array_elements(_items)x JOIN public.tasks t ON x?'task_id' AND t.id=(x->>'task_id')::uuid JOIN public.planning_effective_task_assignments() ea ON ea.task_id=t.id
   UNION
   SELECT ea.cleaner_id,(x->>'date')::date FROM jsonb_array_elements(_items)x JOIN public.tasks t ON x?'task_id' AND t.id=(x->>'task_id')::uuid JOIN public.planning_effective_task_assignments() ea ON ea.task_id=t.id
  )p),'[]'));

  FOR v_item,v_ord IN SELECT value,ordinality::int FROM jsonb_array_elements(_items) WITH ORDINALITY LOOP
   v_task_id:=NULL;
   BEGIN
    IF v_item?'task_id' THEN
     v_task_id:=(v_item->>'task_id')::uuid;
     SELECT * INTO v_task FROM public.tasks WHERE id=v_task_id;
     IF NOT FOUND THEN v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object('ordinal',v_ord,'code','TASK_NOT_FOUND')); CONTINUE; END IF;
     IF v_task.sede_id<>_sede_id THEN v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object('ordinal',v_ord,'code','TASK_SEDE_MISMATCH')); END IF;
     IF v_task.planning_version<>COALESCE((v_item->>'expected_planning_version')::bigint,-1) THEN v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object('ordinal',v_ord,'code','PLANNING_VERSION_CONFLICT')); END IF;
     IF v_task.status<>COALESCE(v_item->>'expected_status','') OR v_task.status IN ('in-progress','completed','cancelled') THEN v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object('ordinal',v_ord,'code','TASK_STATUS_CONFLICT')); END IF;
     SELECT COALESCE(array_agg(cleaner_id ORDER BY cleaner_id),'{}') INTO v_old_ids FROM public.planning_effective_task_assignments() WHERE task_id=v_task_id;
     SELECT COALESCE(array_agg((e#>>'{}')::uuid ORDER BY (e#>>'{}')::uuid),'{}') INTO v_new_ids FROM jsonb_array_elements(COALESCE(v_item->'expected_cleaner_ids','[]'))e;
     IF v_old_ids<>v_new_ids THEN v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object('ordinal',v_ord,'code','EXPECTED_ASSIGNMENTS_CONFLICT')); END IF;
     IF v_item?'expected_start_time' AND v_task.start_time<>(v_item->>'expected_start_time')::time THEN v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object('ordinal',v_ord,'code','EXPECTED_SCHEDULE_CONFLICT')); END IF;
     IF v_item?'expected_end_time' AND v_task.end_time<>(v_item->>'expected_end_time')::time THEN v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object('ordinal',v_ord,'code','EXPECTED_SCHEDULE_CONFLICT')); END IF;
     IF (v_item->>'start_time')::time<v_task.check_out OR (v_item->>'end_time')::time>v_task.check_in THEN v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object('ordinal',v_ord,'code','CHECKOUT_CHECKIN_WINDOW')); END IF;
   ELSE
     SELECT * INTO v_rec FROM public.recurring_tasks WHERE id=(v_item->>'recurring_task_id')::uuid;
     IF NOT FOUND OR v_rec.sede_id<>_sede_id OR NOT v_rec.is_active OR v_rec.next_execution<>(v_item->>'execution_date')::date OR v_rec.state_revision<>COALESCE((v_item->>'expected_recurring_revision')::bigint,-1) THEN
      v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object('ordinal',v_ord,'code','RECURRENCE_CONFLICT'));
      END IF;
      IF EXISTS(
      SELECT 1 FROM public.recurring_task_executions rte
      WHERE rte.recurring_task_id=(v_item->>'recurring_task_id')::uuid
        AND rte.execution_day=(v_item->>'execution_date')::date AND rte.success
      ) THEN
      v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object('ordinal',v_ord,'code','RECURRENCE_ALREADY_MATERIALIZED'));
      END IF;
   END IF;
   IF (v_item->>'start_time')::time >= (v_item->>'end_time')::time THEN v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object('ordinal',v_ord,'code','INVALID_SCHEDULE')); END IF;
   IF (SELECT count(*) FROM jsonb_array_elements(COALESCE(v_item->'cleaner_ids','[]')))<>(SELECT count(DISTINCT e#>>'{}') FROM jsonb_array_elements(COALESCE(v_item->'cleaner_ids','[]'))e) THEN v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object('ordinal',v_ord,'code','DUPLICATE_CLEANER')); END IF;
   EXCEPTION WHEN invalid_text_representation OR datetime_field_overflow OR null_value_not_allowed THEN
    v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object('ordinal',v_ord,'code','INVALID_ITEM_VALUE'));
   END;
  END LOOP;

  -- Trabajadores, teléfonos, disponibilidad y solapes del estado prospectivo.
  v_conflicts:=v_conflicts||COALESCE((SELECT jsonb_agg(jsonb_build_object('code','CLEANER_INVALID','cleaner_id',d.cid)) FROM (
   SELECT DISTINCT (e#>>'{}')::uuid cid FROM jsonb_array_elements(_items)x CROSS JOIN LATERAL jsonb_array_elements(COALESCE(x->'cleaner_ids','[]'))e
   EXCEPT SELECT id FROM public.cleaners WHERE is_active AND sede_id=_sede_id AND COALESCE(planning_operational_restrictions,'')!~*'no apta'
  )d),'[]');
  IF _notification_policy='require_all_recipients' THEN
   v_conflicts:=v_conflicts||COALESCE((SELECT jsonb_agg(jsonb_build_object('code','RECIPIENT_PHONE_REQUIRED','cleaner_id',d.cid)) FROM (
    SELECT DISTINCT (e#>>'{}')::uuid cid FROM jsonb_array_elements(_items)x CROSS JOIN LATERAL jsonb_array_elements(COALESCE(x->'cleaner_ids','[]'))e
    EXCEPT SELECT id FROM public.cleaners WHERE COALESCE(public.normalize_spanish_phone_e164(telefono),public.normalize_spanish_phone_e164(whatsapp_phone_e164)) IS NOT NULL
   )d),'[]');
  END IF;
  v_conflicts:=v_conflicts||COALESCE((SELECT jsonb_agg(jsonb_build_object('code','INTERNAL_OVERLAP','cleaner_id',a.cid,'date',a.d)) FROM (
   SELECT (e#>>'{}')::uuid cid,(x->>'date')::date d,(x->>'start_time')::time s,(x->>'end_time')::time f,row_number()over() rn
   FROM jsonb_array_elements(_items)x CROSS JOIN LATERAL jsonb_array_elements(COALESCE(x->'cleaner_ids','[]'))e
  )a JOIN (SELECT (e#>>'{}')::uuid cid,(x->>'date')::date d,(x->>'start_time')::time s,(x->>'end_time')::time f,row_number()over() rn FROM jsonb_array_elements(_items)x CROSS JOIN LATERAL jsonb_array_elements(COALESCE(x->'cleaner_ids','[]'))e)b ON a.cid=b.cid AND a.d=b.d AND a.rn<b.rn AND a.s<b.f AND b.s<a.f),'[]');
  v_conflicts:=v_conflicts||COALESCE((SELECT jsonb_agg(jsonb_build_object('code','EXTERNAL_OVERLAP','cleaner_id',p.cid,'task_id',t.id)) FROM (
   SELECT DISTINCT (e#>>'{}')::uuid cid,(x->>'date')::date d,(x->>'start_time')::time s,(x->>'end_time')::time f FROM jsonb_array_elements(_items)x CROSS JOIN LATERAL jsonb_array_elements(COALESCE(x->'cleaner_ids','[]'))e
  )p JOIN public.planning_effective_task_assignments() ea ON ea.cleaner_id=p.cid JOIN public.tasks t ON t.id=ea.task_id AND t.date=p.d AND t.start_time<p.f AND p.s<t.end_time AND t.status NOT IN ('completed','cancelled') WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(_items)i WHERE i->>'task_id'=t.id::text)),'[]');
  v_conflicts:=v_conflicts||COALESCE((SELECT jsonb_agg(jsonb_build_object('code','OUTSIDE_AVAILABILITY','cleaner_id',p.cid,'date',p.d)) FROM (
   SELECT DISTINCT (e#>>'{}')::uuid cid,(x->>'date')::date d,(x->>'start_time')::time s,(x->>'end_time')::time f FROM jsonb_array_elements(_items)x CROSS JOIN LATERAL jsonb_array_elements(COALESCE(x->'cleaner_ids','[]'))e
  )p JOIN public.cleaner_availability ca ON ca.cleaner_id=p.cid AND ca.day_of_week=extract(dow from p.d)::int WHERE NOT ca.is_available OR p.s<ca.start_time OR p.f>ca.end_time),'[]');
  v_conflicts:=v_conflicts||COALESCE((SELECT jsonb_agg(jsonb_build_object('code','WORKER_ABSENT','cleaner_id',p.cid,'date',p.d)) FROM (
   SELECT DISTINCT (e#>>'{}')::uuid cid,(x->>'date')::date d,(x->>'start_time')::time s,(x->>'end_time')::time f FROM jsonb_array_elements(_items)x CROSS JOIN LATERAL jsonb_array_elements(COALESCE(x->'cleaner_ids','[]'))e
  )p JOIN public.worker_absences wa ON wa.cleaner_id=p.cid AND p.d BETWEEN wa.start_date AND wa.end_date AND (wa.start_time IS NULL OR (p.s<wa.end_time AND wa.start_time<p.f))),'[]');
  v_conflicts:=v_conflicts||COALESCE((SELECT jsonb_agg(jsonb_build_object('code','WORKER_FIXED_DAY_OFF','cleaner_id',p.cid,'date',p.d)) FROM (
   SELECT DISTINCT (e#>>'{}')::uuid cid,(x->>'date')::date d FROM jsonb_array_elements(_items)x CROSS JOIN LATERAL jsonb_array_elements(COALESCE(x->'cleaner_ids','[]'))e
  )p JOIN public.worker_fixed_days_off wd ON wd.cleaner_id=p.cid AND wd.is_active AND wd.day_of_week=extract(dow from p.d)::int),'[]');
  v_conflicts:=v_conflicts||COALESCE((SELECT jsonb_agg(jsonb_build_object('code','MAINTENANCE_OVERLAP','cleaner_id',p.cid,'date',p.d)) FROM (
   SELECT DISTINCT (e#>>'{}')::uuid cid,(x->>'date')::date d,(x->>'start_time')::time s,(x->>'end_time')::time f FROM jsonb_array_elements(_items)x CROSS JOIN LATERAL jsonb_array_elements(COALESCE(x->'cleaner_ids','[]'))e
  )p JOIN public.worker_maintenance_cleanings wm ON wm.cleaner_id=p.cid AND wm.is_active AND extract(dow from p.d)::int=ANY(wm.days_of_week) AND p.s<wm.end_time AND wm.start_time<p.f),'[]');
  v_conflicts:=v_conflicts||COALESCE((SELECT jsonb_agg(jsonb_build_object('code','DAILY_CAPACITY_EXCEEDED','cleaner_id',w.cid,'date',w.d,'minutes',w.minutes)) FROM (
   SELECT z.cid,z.d,sum(z.minutes)::int minutes FROM (
    SELECT (e#>>'{}')::uuid cid,(x->>'date')::date d,
      COALESCE(NULLIF(x->>'duration_minutes','')::int,extract(epoch from ((x->>'end_time')::time-(x->>'start_time')::time))/60)::int minutes
    FROM jsonb_array_elements(_items)x CROSS JOIN LATERAL jsonb_array_elements(COALESCE(x->'cleaner_ids','[]'))e
    UNION ALL
    SELECT ea.cleaner_id,t.date,
      COALESCE(t.duracion,extract(epoch from (t.end_time-t.start_time))/60)::int
    FROM public.planning_effective_task_assignments() ea JOIN public.tasks t ON t.id=ea.task_id
    WHERE t.status NOT IN ('completed','cancelled')
      AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(_items)i WHERE i->>'task_id'=t.id::text)
   )z GROUP BY z.cid,z.d
  )w JOIN public.cleaners c ON c.id=w.cid WHERE w.minutes>c.planning_max_daily_minutes),'[]');

  IF jsonb_array_length(v_conflicts)>0 THEN
   INSERT INTO public.planning_apply_batch_items(batch_id,item_ordinal,item_key,task_id,recurring_task_id,execution_date,expected_planning_version,request_item,apply_status,conflict_code)
   SELECT _batch_id,o,COALESCE(x->>'task_id',(x->>'recurring_task_id')||':'||(x->>'execution_date'))||':'||o,NULLIF(x->>'task_id','')::uuid,NULLIF(x->>'recurring_task_id','')::uuid,NULLIF(x->>'execution_date','')::date,NULLIF(x->>'expected_planning_version','')::bigint,x,'conflict','BATCH_VALIDATION_FAILED'
   FROM jsonb_array_elements(_items) WITH ORDINALITY q(x,o);
   UPDATE public.planning_apply_batches SET status='validation_failed',failure_code='VALIDATION_FAILED',failure_summary=jsonb_build_object('conflicts',v_conflicts),completed_at=now(),result_summary=jsonb_build_object('status','validation_failed','code','VALIDATION_FAILED','conflicts',v_conflicts,'applied_task_count',0,'applied_assignment_count',0,'notification_event_count',0) WHERE id=_batch_id;
   RETURN (SELECT result_summary||jsonb_build_object('batch_id',id,'idempotent_replay',false) FROM public.planning_apply_batches WHERE id=_batch_id);
  END IF;

  -- Materialización recurrente dentro de la misma subtransacción.
  FOR v_item,v_ord IN SELECT value,ordinality::int FROM jsonb_array_elements(v_work) WITH ORDINALITY LOOP
   IF v_item?'recurring_task_id' THEN
    SELECT generated_task_id,was_created INTO v_generated,v_created FROM public.materialize_recurring_task((v_item->>'recurring_task_id')::uuid,(v_item->>'execution_date')::date,NULLIF(v_item->>'next_execution','')::date,COALESCE(v_item->'schedule_snapshot','{}'));
    v_work:=jsonb_set(v_work,ARRAY[(v_ord-1)::text],v_item||jsonb_build_object('task_id',v_generated));
   END IF;
  END LOOP;

  -- Snapshot previo + ledger de items.
  INSERT INTO public.planning_apply_batch_items(batch_id,item_ordinal,item_key,task_id,recurring_task_id,execution_date,expected_planning_version,request_item,before_snapshot,apply_status)
  SELECT _batch_id,o,CASE WHEN x?'recurring_task_id' THEN (x->>'recurring_task_id')||':'||(x->>'execution_date') ELSE x->>'task_id' END,(x->>'task_id')::uuid,NULLIF(x->>'recurring_task_id','')::uuid,NULLIF(x->>'execution_date','')::date,NULLIF(x->>'expected_planning_version','')::bigint,x,
   to_jsonb(t)||jsonb_build_object('cleaner_ids',COALESCE((SELECT jsonb_agg(ea.cleaner_id ORDER BY ea.cleaner_id) FROM public.planning_effective_task_assignments() ea WHERE ea.task_id=t.id),'[]'::jsonb)),'pending'
  FROM jsonb_array_elements(v_work) WITH ORDINALITY q(x,o) JOIN public.tasks t ON t.id=(x->>'task_id')::uuid;

  -- Horarios set-based; el trigger incrementa planning_version.
  UPDATE public.tasks t SET date=d.d,start_time=d.s,end_time=d.f,duracion=COALESCE(d.minutes,t.duracion),updated_at=now()
  FROM (SELECT (x->>'task_id')::uuid id,(x->>'date')::date d,(x->>'start_time')::time s,(x->>'end_time')::time f,NULLIF(x->>'duration_minutes','')::int minutes FROM jsonb_array_elements(v_work)x)d WHERE t.id=d.id;

  -- task_assignments canónico; orden final persistido por assigned_at.
  DELETE FROM public.task_assignments ta USING (SELECT (x->>'task_id')::uuid tid,(e#>>'{}')::uuid cid FROM jsonb_array_elements(v_work)x CROSS JOIN LATERAL jsonb_array_elements(COALESCE(x->'cleaner_ids','[]'))e) desired
  WHERE ta.task_id IN (SELECT (x->>'task_id')::uuid FROM jsonb_array_elements(v_work)x) AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_work)i CROSS JOIN LATERAL jsonb_array_elements(COALESCE(i->'cleaner_ids','[]'))c WHERE (i->>'task_id')::uuid=ta.task_id AND (c#>>'{}')::uuid=ta.cleaner_id);
  INSERT INTO public.task_assignments(task_id,cleaner_id,cleaner_name,assigned_at,assigned_by)
  SELECT (x->>'task_id')::uuid,(e#>>'{}')::uuid,c.name,clock_timestamp()+((o*1000+eo)::text||' microseconds')::interval,v_actor
  FROM jsonb_array_elements(v_work) WITH ORDINALITY q(x,o) CROSS JOIN LATERAL jsonb_array_elements(COALESCE(x->'cleaner_ids','[]')) WITH ORDINALITY a(e,eo) JOIN public.cleaners c ON c.id=(e#>>'{}')::uuid
  ON CONFLICT(task_id,cleaner_id) DO UPDATE SET assigned_at=EXCLUDED.assigned_at,assigned_by=EXCLUDED.assigned_by,cleaner_name=EXCLUDED.cleaner_name;
  UPDATE public.tasks t SET cleaner_id=p.cid,cleaner=p.name FROM (
   SELECT DISTINCT ON ((x->>'task_id')::uuid) (x->>'task_id')::uuid tid,c.id cid,c.name FROM jsonb_array_elements(v_work)x CROSS JOIN LATERAL jsonb_array_elements(COALESCE(x->'cleaner_ids','[]')) WITH ORDINALITY a(e,o) JOIN public.cleaners c ON c.id=(e#>>'{}')::uuid ORDER BY (x->>'task_id')::uuid,o
  )p WHERE t.id=p.tid;
  UPDATE public.tasks t SET cleaner_id=NULL,cleaner=NULL WHERE t.id IN (SELECT (x->>'task_id')::uuid FROM jsonb_array_elements(v_work)x WHERE jsonb_array_length(COALESCE(x->'cleaner_ids','[]'))=0);

  UPDATE public.planning_apply_batch_items bi SET after_snapshot=to_jsonb(t)||jsonb_build_object('cleaner_ids',COALESCE((SELECT jsonb_agg(ta.cleaner_id ORDER BY ta.assigned_at,ta.id) FROM public.task_assignments ta WHERE ta.task_id=t.id),'[]'::jsonb)),apply_status='applied'
  FROM public.tasks t WHERE bi.batch_id=_batch_id AND bi.task_id=t.id;
  INSERT INTO public.planning_assignment_audit(batch_id,batch_item_id,task_id,actor_id,before_snapshot,after_snapshot,net_change)
  SELECT _batch_id,id,task_id,v_actor,before_snapshot,after_snapshot,
   CASE WHEN before_snapshot->'cleaner_ids'=after_snapshot->'cleaner_ids' AND (before_snapshot-ARRAY['updated_at','planning_version','cleaner','cleaner_id','cleaner_ids'])=(after_snapshot-ARRAY['updated_at','planning_version','cleaner','cleaner_id','cleaner_ids']) THEN 'unchanged'
        WHEN jsonb_array_length(before_snapshot->'cleaner_ids')=0 THEN 'assigned' WHEN jsonb_array_length(after_snapshot->'cleaner_ids')=0 THEN 'cancelled'
        WHEN before_snapshot->'cleaner_ids'=after_snapshot->'cleaner_ids' THEN 'modified' ELSE 'mixed' END
  FROM public.planning_apply_batch_items WHERE batch_id=_batch_id;

  -- Suprime eventos trigger intermedios y publica exclusivamente el diff final.
  DELETE FROM public.notification_events WHERE batch_id=_batch_id;
  INSERT INTO public.notification_events(event_type,entity_type,entity_id,task_id,cleaner_id,recipient_worker_id,recipient_name_snapshot,recipient_phone_snapshot,sede_id,batch_id,payload,snapshot,dedupe_key,status,recipient_sequence,notification_mode)
  SELECT kind,'tasks',a.task_id,a.task_id,cid,cid,
   (SELECT c.name FROM public.cleaners c WHERE c.id=cid),
   (SELECT COALESCE(public.normalize_spanish_phone_e164(c.telefono),public.normalize_spanish_phone_e164(c.whatsapp_phone_e164)) FROM public.cleaners c WHERE c.id=cid),
   _sede_id,_batch_id,jsonb_build_object('source','apply_planning_batch','net_change',kind),
   CASE WHEN kind='task_cancelled' THEN a.before_snapshot ELSE a.after_snapshot END,
   kind||':'||_batch_id||':'||a.task_id||':'||cid,'pending',row_number()over(partition by cid order by a.task_id,kind),'shadow'
  FROM public.planning_assignment_audit a CROSS JOIN LATERAL (
   SELECT 'task_cancelled' kind,(v#>>'{}')::uuid cid FROM jsonb_array_elements(a.before_snapshot->'cleaner_ids')v WHERE NOT (a.after_snapshot->'cleaner_ids')? (v#>>'{}')
   UNION ALL SELECT 'task_assigned',(v#>>'{}')::uuid FROM jsonb_array_elements(a.after_snapshot->'cleaner_ids')v WHERE NOT (a.before_snapshot->'cleaner_ids')? (v#>>'{}')
   UNION ALL SELECT 'task_modified',(v#>>'{}')::uuid FROM jsonb_array_elements(a.after_snapshot->'cleaner_ids')v WHERE (a.before_snapshot->'cleaner_ids')? (v#>>'{}') AND (a.before_snapshot-ARRAY['updated_at','planning_version','cleaner','cleaner_id','cleaner_ids'])<>(a.after_snapshot-ARRAY['updated_at','planning_version','cleaner','cleaner_id','cleaner_ids'])
  )diff WHERE a.batch_id=_batch_id;

  IF _source_run_id IS NOT NULL THEN
   UPDATE public.planning_runs SET status='approved',approved_by=v_actor,approved_at=COALESCE(approved_at,now()),
     applied_batch_id=_batch_id,version=version+1,updated_at=now()
   WHERE id=_source_run_id;
   UPDATE public.planning_run_items SET status='applied',applied_at=now(),updated_at=now()
   WHERE run_id=_source_run_id AND task_id IN(
    SELECT task_id FROM public.planning_apply_batch_items WHERE batch_id=_batch_id
   );
  END IF;
  SELECT count(*) INTO v_changed FROM public.planning_assignment_audit WHERE batch_id=_batch_id AND net_change<>'unchanged';
  v_summary:=jsonb_build_object('status','applied','applied_task_count',v_count,'changed_task_count',v_changed,'applied_assignment_count',(SELECT count(*) FROM public.task_assignments WHERE task_id IN(SELECT task_id FROM public.planning_apply_batch_items WHERE batch_id=_batch_id)),'assignment_count',(SELECT count(*) FROM public.task_assignments WHERE task_id IN(SELECT task_id FROM public.planning_apply_batch_items WHERE batch_id=_batch_id)),'notification_event_count',(SELECT count(*) FROM public.notification_events WHERE batch_id=_batch_id),'conflicts','[]'::jsonb);
  UPDATE public.planning_apply_batches SET status='applied',result_summary=v_summary,completed_at=now() WHERE id=_batch_id;
  RETURN v_summary||jsonb_build_object('batch_id',_batch_id,'idempotent_replay',false);
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS v_error=MESSAGE_TEXT,v_error_context=PG_EXCEPTION_CONTEXT;
  UPDATE public.planning_apply_batches SET status='technical_failed',failure_code='TECHNICAL_FAILURE',failure_summary=jsonb_build_object('sqlstate',SQLSTATE,'message',left(v_error,160),'context',left(v_error_context,500)),completed_at=now(),result_summary=jsonb_build_object('status','technical_failed','code','TECHNICAL_FAILURE','applied_task_count',0,'applied_assignment_count',0,'notification_event_count',0,'conflicts','[]'::jsonb) WHERE id=_batch_id;
  RETURN (SELECT result_summary||jsonb_build_object('batch_id',id,'idempotent_replay',false) FROM public.planning_apply_batches WHERE id=_batch_id);
 END;
END $$;

REVOKE ALL ON FUNCTION public.apply_planning_batch(uuid,text,uuid,uuid,bigint,text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apply_planning_batch(uuid,text,uuid,uuid,bigint,text,text,jsonb) TO authenticated;
COMMENT ON FUNCTION public.apply_planning_batch(uuid,text,uuid,uuid,bigint,text,text,jsonb) IS 'Aplica 1..500 items de planificación en una única transacción lógica; objetivo/SLO certificado por integración: 150.';
