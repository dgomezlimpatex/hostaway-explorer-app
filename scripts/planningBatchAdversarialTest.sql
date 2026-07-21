\set ON_ERROR_STOP on
BEGIN;

-- Compatibilidad: el backfill no puede silenciar el outbox productivo legado.
DO $$ DECLARE blocked boolean:=false; BEGIN
 IF (SELECT notification_mode FROM public.notification_events WHERE dedupe_key='legacy-pre-15000')<>'live' THEN
   RAISE EXCEPTION 'evento legacy silenciado por DEFAULT shadow';
 END IF;
 BEGIN
   UPDATE public.notification_events SET status='processing' WHERE dedupe_key='legacy-pre-15000';
 EXCEPTION WHEN check_violation THEN blocked:=true;
 END;
 IF blocked THEN RAISE EXCEPTION 'evento legacy live no reclamable'; END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.normalize_spanish_phone_e164(text)') IS NULL THEN
    RAISE EXCEPTION 'RED: normalizador PostgreSQL ausente';
  END IF;
  IF public.normalize_spanish_phone_e164('600 111 222') <> '+34600111222'
     OR public.normalize_spanish_phone_e164('+34 711 222 333') <> '+34711222333'
     OR public.normalize_spanish_phone_e164('0034600111222') <> '+34600111222'
     OR public.normalize_spanish_phone_e164('+346****1222') IS NOT NULL
     OR public.normalize_spanish_phone_e164('900111222') IS NOT NULL
     OR public.normalize_spanish_phone_e164('123') IS NOT NULL
     OR public.normalize_spanish_phone_e164('+33600111222') IS NOT NULL THEN
    RAISE EXCEPTION 'normalizador PostgreSQL no equivale al sender';
  END IF;
END $$;

INSERT INTO public.sedes(id) VALUES ('11000000-0000-0000-0000-000000000001');
INSERT INTO public.user_roles(user_id,role) VALUES ('21000000-0000-0000-0000-000000000001','manager');
INSERT INTO public.user_sede_access(user_id,sede_id) VALUES ('21000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000001');
INSERT INTO public.cleaners(id,name,telefono,sede_id,planning_max_daily_minutes) VALUES
 ('31000000-0000-0000-0000-000000000001','Válida','600 111 222','11000000-0000-0000-0000-000000000001',120),
 ('31000000-0000-0000-0000-000000000002','Enmascarada','+346****1222','11000000-0000-0000-0000-000000000001',480);
INSERT INTO public.tasks(id,date,start_time,end_time,sede_id,cleaner_id,cleaner) VALUES
 ('41000000-0000-0000-0000-000000000001','2026-10-05','10:00','11:00','11000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000001','Válida'),
 ('41000000-0000-0000-0000-000000000002','2026-10-05','12:00','13:00','11000000-0000-0000-0000-000000000001',NULL,NULL),
 ('41000000-0000-0000-0000-000000000003','2026-10-05','08:00','09:30','11000000-0000-0000-0000-000000000001',NULL,NULL);
INSERT INTO public.task_assignments(task_id,cleaner_id,cleaner_name)
VALUES ('41000000-0000-0000-0000-000000000003','31000000-0000-0000-0000-000000000001','Válida');

-- El fallback legacy sigue notificando mientras existan writers de tasks.cleaner_id
-- y 15000 conserva la función productiva previa sin overrides.
UPDATE public.tasks SET notes='cambio legacy' WHERE id='41000000-0000-0000-0000-000000000001';
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.notification_events WHERE task_id='41000000-0000-0000-0000-000000000001' AND cleaner_id='31000000-0000-0000-0000-000000000001' AND event_type='task_modified' AND payload->>'writer_contract'='legacy-cancellations-real') THEN
   RAISE EXCEPTION 'writer legacy task_modified redefinido/perdido';
 END IF;
 IF (SELECT planning_version FROM public.tasks WHERE id='41000000-0000-0000-0000-000000000001') <> 1 THEN
   RAISE EXCEPTION 'planning_version no cubre writer legacy';
 END IF;
END $$;
DELETE FROM public.notification_events;

-- Un evento generado por trigger fuera del batch queda live y es reclamable.
INSERT INTO public.task_assignments(task_id,cleaner_id,cleaner_name)
VALUES('41000000-0000-0000-0000-000000000002','31000000-0000-0000-0000-000000000001','Válida');
DO $$ DECLARE eid uuid; BEGIN
 SELECT id INTO eid FROM public.notification_events WHERE task_id='41000000-0000-0000-0000-000000000002' AND payload->>'writer_contract'='legacy-cancellations-real';
 IF eid IS NULL OR (SELECT notification_mode FROM public.notification_events WHERE id=eid)<>'live' THEN RAISE EXCEPTION 'evento trigger legacy no-live'; END IF;
 UPDATE public.notification_events SET status='processing' WHERE id=eid;
END $$;
DELETE FROM public.task_assignments WHERE task_id='41000000-0000-0000-0000-000000000002';
DELETE FROM public.notification_events;

-- Teléfono enmascarado debe fallar antes de escribir negocio.
DO $$ DECLARE i jsonb; h text; r jsonb; BEGIN
 i:=jsonb_build_array(jsonb_build_object('task_id','41000000-0000-0000-0000-000000000002','expected_planning_version',0,'expected_status','pending','expected_cleaner_ids','[]'::jsonb,'date','2026-10-05','start_time','12:00','end_time','13:00','cleaner_ids',jsonb_build_array('31000000-0000-0000-0000-000000000002')));
 h:=public.planning_batch_request_hash('11000000-0000-0000-0000-000000000001',NULL,NULL,'require_all_recipients',i);
 PERFORM set_config('request.jwt.claim.sub','21000000-0000-0000-0000-000000000001',true); SET LOCAL ROLE authenticated;
 r:=public.apply_planning_batch('51000000-0000-0000-0000-000000000001','masked-phone','11000000-0000-0000-0000-000000000001',NULL,NULL,h,'require_all_recipients',i); RESET ROLE;
 IF r->>'status'<>'validation_failed' OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r->'conflicts') c WHERE c->>'code'='RECIPIENT_PHONE_REQUIRED') THEN RAISE EXCEPTION 'E164 inválido aceptado: %',r; END IF;
END $$;

-- Capacidad prospectiva suma 90 minutos externos + 60 solicitados (máximo 120).
DO $$ DECLARE i jsonb; h text; r jsonb; BEGIN
 i:=jsonb_build_array(jsonb_build_object('task_id','41000000-0000-0000-0000-000000000002','expected_planning_version',0,'expected_status','pending','expected_cleaner_ids','[]'::jsonb,'date','2026-10-05','start_time','12:00','end_time','13:00','cleaner_ids',jsonb_build_array('31000000-0000-0000-0000-000000000001')));
 h:=public.planning_batch_request_hash('11000000-0000-0000-0000-000000000001',NULL,NULL,'best_effort',i);
 PERFORM set_config('request.jwt.claim.sub','21000000-0000-0000-0000-000000000001',true); SET LOCAL ROLE authenticated;
 r:=public.apply_planning_batch('51000000-0000-0000-0000-000000000002','external-capacity','11000000-0000-0000-0000-000000000001',NULL,NULL,h,'best_effort',i); RESET ROLE;
 IF r->>'status'<>'validation_failed' OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r->'conflicts') c WHERE c->>'code'='DAILY_CAPACITY_EXCEEDED') THEN RAISE EXCEPTION 'capacidad externa omitida: %',r; END IF;
END $$;

-- Repros legacy: la tarea 003 deja de ser canónica pero sigue contando una sola
-- vez por su espejo tasks.cleaner_id/cleaner.
DELETE FROM public.task_assignments WHERE task_id='41000000-0000-0000-0000-000000000003';
UPDATE public.tasks SET cleaner_id='31000000-0000-0000-0000-000000000001',cleaner='Válida' WHERE id='41000000-0000-0000-0000-000000000003';
DO $$ DECLARE i jsonb; h text; r jsonb; BEGIN
 i:=jsonb_build_array(jsonb_build_object('task_id','41000000-0000-0000-0000-000000000002','expected_planning_version',0,'expected_status','pending','expected_cleaner_ids','[]'::jsonb,'date','2026-10-05','start_time','12:00','end_time','13:00','cleaner_ids',jsonb_build_array('31000000-0000-0000-0000-000000000001')));
 h:=public.planning_batch_request_hash('11000000-0000-0000-0000-000000000001',NULL,NULL,'best_effort',i);
 PERFORM set_config('request.jwt.claim.sub','21000000-0000-0000-0000-000000000001',true); SET LOCAL ROLE authenticated;
 r:=public.apply_planning_batch('51000000-0000-0000-0000-000000000012','legacy-capacity','11000000-0000-0000-0000-000000000001',NULL,NULL,h,'best_effort',i); RESET ROLE;
 IF r->>'status'<>'validation_failed' OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r->'conflicts') c WHERE c->>'code'='DAILY_CAPACITY_EXCEEDED') THEN RAISE EXCEPTION 'capacidad legacy omitida: %',r; END IF;
END $$;
DO $$ DECLARE i jsonb; h text; r jsonb; BEGIN
 i:=jsonb_build_array(jsonb_build_object('task_id','41000000-0000-0000-0000-000000000002','expected_planning_version',0,'expected_status','pending','expected_cleaner_ids','[]'::jsonb,'date','2026-10-05','start_time','08:30','end_time','09:00','cleaner_ids',jsonb_build_array('31000000-0000-0000-0000-000000000001')));
 h:=public.planning_batch_request_hash('11000000-0000-0000-0000-000000000001',NULL,NULL,'best_effort',i);
 PERFORM set_config('request.jwt.claim.sub','21000000-0000-0000-0000-000000000001',true); SET LOCAL ROLE authenticated;
 r:=public.apply_planning_batch('51000000-0000-0000-0000-000000000013','legacy-overlap','11000000-0000-0000-0000-000000000001',NULL,NULL,h,'best_effort',i); RESET ROLE;
 IF r->>'status'<>'validation_failed' OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r->'conflicts') c WHERE c->>'code'='EXTERNAL_OVERLAP') THEN RAISE EXCEPTION 'solape legacy omitido: %',r; END IF;
END $$;

-- El fallback por nombre solo atribuye una tarea si el nombre normalizado
-- identifica exactamente a una cleaner activa de la misma sede. El cleaner_id
-- directo sigue siendo una única proyección y lo canónico nunca se duplica.
INSERT INTO public.cleaners(id,name,telefono,sede_id) VALUES
 ('31000000-0000-0000-0000-000000000010','  válida  ','600 111 230','11000000-0000-0000-0000-000000000001');
INSERT INTO public.tasks(id,date,start_time,end_time,sede_id,cleaner) VALUES
 ('41000000-0000-0000-0000-000000000010','2026-10-08','10:00','11:00','11000000-0000-0000-0000-000000000001','Válida'),
 ('41000000-0000-0000-0000-000000000011','2026-10-08','10:30','11:30','11000000-0000-0000-0000-000000000001',NULL);
DO $$ DECLARE i jsonb; r jsonb; BEGIN
 IF EXISTS(SELECT 1 FROM public.planning_effective_task_assignments() WHERE task_id='41000000-0000-0000-0000-000000000010') THEN
  RAISE EXCEPTION 'nombre legacy ambiguo atribuido a una cleaner';
 END IF;
 IF (SELECT count(*) FROM public.planning_effective_task_assignments() WHERE task_id='41000000-0000-0000-0000-000000000001')<>1 THEN
  RAISE EXCEPTION 'cleaner_id legacy directo duplicado por fallback de nombre';
 END IF;
 i:=jsonb_build_array(jsonb_build_object(
   'task_id','41000000-0000-0000-0000-000000000011','expected_planning_version',0,
   'expected_status','pending','expected_cleaner_ids','[]'::jsonb,
   'date','2026-10-08','start_time','10:30','end_time','11:30',
   'cleaner_ids',jsonb_build_array('31000000-0000-0000-0000-000000000001')));
 UPDATE public.cleaners SET planning_max_daily_minutes=480 WHERE id='31000000-0000-0000-0000-000000000001';
 PERFORM set_config('request.jwt.claim.sub','21000000-0000-0000-0000-000000000001',true); SET LOCAL ROLE authenticated;
 r:=public.apply_planning_batch('51000000-0000-0000-0000-000000000014','ambiguous-name-no-overlap','11000000-0000-0000-0000-000000000001',NULL,NULL,'ignorado','best_effort',i); RESET ROLE;
 IF r->>'status'<>'applied' THEN RAISE EXCEPTION 'nombre ambiguo creó falso solape: %',r; END IF;
 IF (SELECT count(*) FROM public.planning_effective_task_assignments() WHERE task_id='41000000-0000-0000-0000-000000000011')<>1 THEN
  RAISE EXCEPTION 'asignación canónica duplicada por proyección legacy';
 END IF;
 UPDATE public.cleaners SET is_active=false WHERE id='31000000-0000-0000-0000-000000000010';
 IF (SELECT array_agg(cleaner_id) FROM public.planning_effective_task_assignments() WHERE task_id='41000000-0000-0000-0000-000000000010')
    IS DISTINCT FROM ARRAY['31000000-0000-0000-0000-000000000001'::uuid] THEN
  RAISE EXCEPTION 'nombre legacy unívoco no resolvió exactamente una cleaner';
 END IF;
END $$;

-- La baja legacy por nombre no puede adivinar entre homónimas activas de la
-- misma sede. Debe preservar la tarea textual y no atribuir cancelación alguna.
INSERT INTO public.cleaners(id,name,telefono,sede_id) VALUES
 ('31000000-0000-0000-0000-000000000020','Nombre Ambiguo','600 111 240','11000000-0000-0000-0000-000000000001'),
 ('31000000-0000-0000-0000-000000000021','Nombre Ambiguo','600 111 241','11000000-0000-0000-0000-000000000001');
INSERT INTO public.tasks(id,date,start_time,end_time,sede_id,cleaner_id,cleaner) VALUES
 ('41000000-0000-0000-0000-000000000020','2026-10-09','09:00','10:00','11000000-0000-0000-0000-000000000001',NULL,'Nombre Ambiguo');
DO $$ DECLARE r jsonb; BEGIN
 PERFORM set_config('request.jwt.claim.sub','21000000-0000-0000-0000-000000000001',true); SET LOCAL ROLE authenticated;
 r:=public.deactivate_cleaner_with_future_assignments('31000000-0000-0000-0000-000000000020',true); RESET ROLE;
 IF r->>'unassignedCount'<>'0' THEN RAISE EXCEPTION 'baja ambigua atribuyó tarea: %',r; END IF;
 IF (SELECT ROW(cleaner_id,cleaner) FROM public.tasks WHERE id='41000000-0000-0000-0000-000000000020')
    IS DISTINCT FROM ROW(NULL::uuid,'Nombre Ambiguo'::text) THEN
  RAISE EXCEPTION 'baja ambigua mutó proyección legacy';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.cleaners WHERE id='31000000-0000-0000-0000-000000000020' AND NOT is_active)
    OR NOT EXISTS(SELECT 1 FROM public.cleaners WHERE id='31000000-0000-0000-0000-000000000021' AND is_active) THEN
  RAISE EXCEPTION 'baja ambigua desactivó la cleaner incorrecta';
 END IF;
 IF EXISTS(SELECT 1 FROM public.notification_events
           WHERE task_id='41000000-0000-0000-0000-000000000020'
             AND cleaner_id='31000000-0000-0000-0000-000000000020'
             AND event_type='task_cancelled') THEN
  RAISE EXCEPTION 'baja ambigua emitió cancelación atribuida';
 END IF;
END $$;

-- Caso positivo: un único nombre activo normalizado en la sede sí conserva el
-- fallback legacy, limpia la tarea y publica exactamente su cancelación.
INSERT INTO public.cleaners(id,name,telefono,sede_id) VALUES
 ('31000000-0000-0000-0000-000000000022','  Nombre   Único  ','600 111 242','11000000-0000-0000-0000-000000000001');
INSERT INTO public.tasks(id,date,start_time,end_time,sede_id,cleaner_id,cleaner) VALUES
 ('41000000-0000-0000-0000-000000000022','2026-10-09','11:00','12:00','11000000-0000-0000-0000-000000000001',NULL,'nombre único');
DO $$ DECLARE r jsonb; BEGIN
 PERFORM set_config('request.jwt.claim.sub','21000000-0000-0000-0000-000000000001',true); SET LOCAL ROLE authenticated;
 r:=public.deactivate_cleaner_with_future_assignments('31000000-0000-0000-0000-000000000022',true); RESET ROLE;
 IF r->>'unassignedCount'<>'1' THEN RAISE EXCEPTION 'baja legacy unívoca no atribuyó tarea: %',r; END IF;
 IF (SELECT ROW(cleaner_id,cleaner) FROM public.tasks WHERE id='41000000-0000-0000-0000-000000000022')
    IS DISTINCT FROM ROW(NULL::uuid,NULL::text) THEN
  RAISE EXCEPTION 'baja legacy unívoca no limpió proyección';
 END IF;
 IF (SELECT count(*) FROM public.notification_events
     WHERE task_id='41000000-0000-0000-0000-000000000022'
       AND cleaner_id='31000000-0000-0000-0000-000000000022'
       AND event_type='task_cancelled')<>1 THEN
  RAISE EXCEPTION 'baja legacy unívoca no publicó una cancelación';
 END IF;
END $$;

-- Un run draft y sus items se aprueban/aplican en la misma subtransacción.
UPDATE public.cleaners SET planning_max_daily_minutes=480 WHERE id='31000000-0000-0000-0000-000000000001';
INSERT INTO public.planning_runs(id,sede_id,status) VALUES('71000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000001','draft');
INSERT INTO public.planning_run_items(run_id,task_id,status) VALUES('71000000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000002','draft');
DO $$ DECLARE i jsonb; h text; r jsonb; BEGIN
 i:=jsonb_build_array(jsonb_build_object('task_id','41000000-0000-0000-0000-000000000002','expected_planning_version',0,'expected_status','pending','expected_cleaner_ids','[]'::jsonb,'date','2026-10-06','start_time','12:00','end_time','13:00','cleaner_ids',jsonb_build_array('31000000-0000-0000-0000-000000000001')));
 h:=public.planning_batch_request_hash('11000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000001',0,'best_effort',i);
 PERFORM set_config('request.jwt.claim.sub','21000000-0000-0000-0000-000000000001',true); SET LOCAL ROLE authenticated;
 r:=public.apply_planning_batch('51000000-0000-0000-0000-000000000003','run-atomic-ok','11000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000001',0,h,'best_effort',i); RESET ROLE;
 IF r->>'status'<>'applied' THEN RAISE EXCEPTION 'run draft no aplicado: % / %',r,(SELECT failure_summary FROM public.planning_apply_batches WHERE id='51000000-0000-0000-0000-000000000003'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.planning_runs WHERE id='71000000-0000-0000-0000-000000000001' AND status='approved' AND approved_by='21000000-0000-0000-0000-000000000001' AND approved_at IS NOT NULL AND applied_batch_id='51000000-0000-0000-0000-000000000003') THEN RAISE EXCEPTION 'run no aprobado atómicamente'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.planning_run_items WHERE run_id='71000000-0000-0000-0000-000000000001' AND task_id='41000000-0000-0000-0000-000000000002' AND status='applied' AND applied_at IS NOT NULL) THEN RAISE EXCEPTION 'run item no aplicado atómicamente'; END IF;
END $$;

-- Shadow/test no puede transicionar a processing ni siquiera por update service-role.
DO $$ DECLARE eid uuid; blocked boolean:=false; BEGIN
 INSERT INTO public.notification_events(event_type,entity_id,task_id,cleaner_id,sede_id,payload,dedupe_key,status,notification_mode)
 VALUES('task_modified','41000000-0000-0000-0000-000000000002','41000000-0000-0000-0000-000000000002','31000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000001','{}','shadow-never-provider','pending','shadow') RETURNING id INTO eid;
 BEGIN UPDATE public.notification_events SET status='processing' WHERE id=eid; EXCEPTION WHEN check_violation THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'shadow reclamable'; END IF;
END $$;

-- Contexto transaccional: writer que omite batch_id y modo queda shadow.
UPDATE public.planning_apply_batches SET status='applying' WHERE id='51000000-0000-0000-0000-000000000003';
DO $$ DECLARE eid uuid; blocked boolean:=false; BEGIN
 PERFORM set_config('app.planning_batch_id','51000000-0000-0000-0000-000000000003',true);
 PERFORM set_config('app.planning_notification_mode','shadow',true);
 INSERT INTO public.notification_events(event_type,entity_id,task_id,cleaner_id,sede_id,payload,dedupe_key,status)
 VALUES('task_modified','41000000-0000-0000-0000-000000000002','41000000-0000-0000-0000-000000000002','31000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000001','{}','batch-omits-mode','pending') RETURNING id INTO eid;
 IF (SELECT batch_id FROM public.notification_events WHERE id=eid)<>'51000000-0000-0000-0000-000000000003' THEN RAISE EXCEPTION 'contexto no forzó batch_id'; END IF;
 IF (SELECT notification_mode FROM public.notification_events WHERE id=eid)<>'shadow' THEN RAISE EXCEPTION 'batch sin modo heredó live'; END IF;
 BEGIN UPDATE public.notification_events SET status='processing' WHERE id=eid; EXCEPTION WHEN check_violation THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'batch sin modo reclamable'; END IF;
 PERFORM set_config('app.planning_notification_mode','test',true);
 INSERT INTO public.notification_events(event_type,entity_id,task_id,cleaner_id,sede_id,payload,dedupe_key,status)
 VALUES('task_modified','41000000-0000-0000-0000-000000000002','41000000-0000-0000-0000-000000000002','31000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000001','{}','batch-test-mode','pending') RETURNING id INTO eid;
 IF (SELECT batch_id FROM public.notification_events WHERE id=eid)<>'51000000-0000-0000-0000-000000000003' OR (SELECT notification_mode FROM public.notification_events WHERE id=eid)<>'test' THEN RAISE EXCEPTION 'contexto test no preservado'; END IF;
END $$;
UPDATE public.planning_apply_batches SET status='applied' WHERE id='51000000-0000-0000-0000-000000000003';

-- Ocurrencia existente se rechaza sin sobrescribir una tarea ya materializada.
INSERT INTO public.recurring_tasks(id,name,type,start_time,end_time,check_out,check_in,frequency,start_date,next_execution,sede_id)
VALUES('61000000-0000-0000-0000-000000000001','Existente','cleaning','10:00','11:00','10:00','15:00','weekly','2026-10-07','2026-10-07','11000000-0000-0000-0000-000000000001');
INSERT INTO public.tasks(id,date,start_time,end_time,sede_id,status) VALUES('41000000-0000-0000-0000-000000000099','2026-10-07','09:00','10:00','11000000-0000-0000-0000-000000000001','completed');
INSERT INTO public.recurring_task_executions(recurring_task_id,generated_task_id,execution_day,success) VALUES('61000000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000099','2026-10-07',true);
DO $$ DECLARE i jsonb; h text; r jsonb; BEGIN
 i:=jsonb_build_array(jsonb_build_object('recurring_task_id','61000000-0000-0000-0000-000000000001','execution_date','2026-10-07','next_execution','2026-10-14','expected_recurring_revision',0,'schedule_snapshot',jsonb_build_object('frequency','weekly'),'date','2026-10-07','start_time','10:00','end_time','11:00','cleaner_ids',jsonb_build_array('31000000-0000-0000-0000-000000000001')));
 h:=public.planning_batch_request_hash('11000000-0000-0000-0000-000000000001',NULL,NULL,'best_effort',i);
 PERFORM set_config('request.jwt.claim.sub','21000000-0000-0000-0000-000000000001',true); SET LOCAL ROLE authenticated;
 r:=public.apply_planning_batch('51000000-0000-0000-0000-000000000004','existing-recurrence','11000000-0000-0000-0000-000000000001',NULL,NULL,h,'best_effort',i); RESET ROLE;
 IF r->>'status'<>'validation_failed' OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r->'conflicts') c WHERE c->>'code'='RECURRENCE_ALREADY_MATERIALIZED') THEN RAISE EXCEPTION 'recurrencia existente sobrescrita: %',r; END IF;
 IF (SELECT status FROM public.tasks WHERE id='41000000-0000-0000-0000-000000000099')<>'completed' THEN RAISE EXCEPTION 'tarea recurrente terminal mutada'; END IF;
END $$;

ROLLBACK;
SELECT 'PLANNING_BATCH_ADVERSARIAL_TEST_PASS' AS result;
