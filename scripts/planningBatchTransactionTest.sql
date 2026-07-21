\set ON_ERROR_STOP on
-- Contrato ejecutable de Fase 3. Debe correr tras el esquema actual y la migración nueva.
DO $$
BEGIN
  IF to_regprocedure('public.apply_planning_batch(uuid,text,uuid,uuid,bigint,text,text,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'RED: apply_planning_batch no existe';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tasks' AND column_name='planning_version') THEN
    RAISE EXCEPTION 'planning_version no existe';
  END IF;
END $$;

BEGIN;
INSERT INTO public.sedes(id) VALUES ('10000000-0000-0000-0000-000000000001');
INSERT INTO public.user_roles(user_id,role) VALUES
 ('20000000-0000-0000-0000-000000000001','manager'),
 ('20000000-0000-0000-0000-000000000002','supervisor'),
 ('20000000-0000-0000-0000-000000000003','manager');
INSERT INTO public.user_sede_access(user_id,sede_id) VALUES ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
INSERT INTO public.cleaners(id,name,telefono,sede_id) VALUES
 ('30000000-0000-0000-0000-000000000001','Ana','600 111 001','10000000-0000-0000-0000-000000000001'),
 ('30000000-0000-0000-0000-000000000002','Bea','711 222 002','10000000-0000-0000-0000-000000000001'),
 ('30000000-0000-0000-0000-000000000003','Sin móvil',NULL,'10000000-0000-0000-0000-000000000001');
INSERT INTO public.tasks(id,date,start_time,end_time,sede_id) VALUES
 ('40000000-0000-0000-0000-000000000001','2026-08-03','10:00','11:00','10000000-0000-0000-0000-000000000001'),
 ('40000000-0000-0000-0000-000000000002','2026-08-03','12:00','13:00','10000000-0000-0000-0000-000000000001');
INSERT INTO public.task_assignments(task_id,cleaner_id,cleaner_name) VALUES ('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Ana');

DO $$
DECLARE items jsonb; h text; result jsonb; before_events bigint;
BEGIN
 items := jsonb_build_array(jsonb_build_object(
   'task_id','40000000-0000-0000-0000-000000000001','expected_planning_version',0,
   'expected_status','pending','expected_start_time','10:00','expected_end_time','11:00',
   'expected_cleaner_ids',jsonb_build_array('30000000-0000-0000-0000-000000000001'),
   'date','2026-08-03','start_time','10:30','end_time','12:00',
   'cleaner_ids',jsonb_build_array('30000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001')
 ));
 h := public.planning_batch_request_hash('10000000-0000-0000-0000-000000000001',NULL,NULL,'require_all_recipients',items);
 PERFORM set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
 SET LOCAL ROLE authenticated;
 result := public.apply_planning_batch('50000000-0000-0000-0000-000000000001','idem-ok1','10000000-0000-0000-0000-000000000001',NULL,NULL,NULL,'require_all_recipients',items);
 RESET ROLE;
 IF result->>'status'<>'applied' OR (result->>'applied_task_count')::int<>1 THEN RAISE EXCEPTION 'apply inesperado: %, detalle: %',result,(SELECT failure_summary FROM public.planning_apply_batches WHERE id='50000000-0000-0000-0000-000000000001'); END IF;
 IF (SELECT array_agg(cleaner_id ORDER BY assigned_at,id) FROM public.task_assignments WHERE task_id='40000000-0000-0000-0000-000000000001') <> ARRAY['30000000-0000-0000-0000-000000000002'::uuid,'30000000-0000-0000-0000-000000000001'::uuid] THEN RAISE EXCEPTION 'orden/asignaciones canónicas incorrectos'; END IF;
 IF (SELECT cleaner_id FROM public.tasks WHERE id='40000000-0000-0000-0000-000000000001') <> '30000000-0000-0000-0000-000000000002' THEN RAISE EXCEPTION 'proyección legacy incorrecta'; END IF;
 IF (SELECT count(*) FROM public.planning_assignment_audit WHERE batch_id='50000000-0000-0000-0000-000000000001')<>1 THEN RAISE EXCEPTION 'auditoría ausente'; END IF;
 IF (SELECT count(*) FROM public.notification_events WHERE batch_id='50000000-0000-0000-0000-000000000001')<>2 THEN RAISE EXCEPTION 'diff neto/outbox incorrecto'; END IF;
 IF EXISTS(SELECT 1 FROM public.notification_events WHERE batch_id='50000000-0000-0000-0000-000000000001' AND recipient_phone_snapshot IS NULL) THEN RAISE EXCEPTION 'outbox sin routing snapshot'; END IF;
 before_events := (SELECT count(*) FROM public.notification_events);
 SET LOCAL ROLE authenticated;
 result := public.apply_planning_batch('50000000-0000-0000-0000-000000000001','idem-ok1','10000000-0000-0000-0000-000000000001',NULL,NULL,'hash-cliente-arbitrario','require_all_recipients',items);
 RESET ROLE;
 IF result->>'idempotent_replay'<>'true' OR (SELECT count(*) FROM public.notification_events)<>before_events THEN RAISE EXCEPTION 'retry no idempotente: %',result; END IF;
END $$;

-- Unicode, objetos anidados y números se ligan al hash jsonb autoritativo del
-- servidor. El cliente puede omitir o inventar _request_hash sin influir.
DO $$ DECLARE original jsonb; reordered jsonb; changed jsonb; r jsonb; BEGIN
 original:=jsonb_build_array(jsonb_build_object(
   'task_id','40000000-0000-0000-0000-000000000002','expected_planning_version',0,
   'expected_status','pending','expected_cleaner_ids','[]'::jsonb,
   'date','2026-08-04','start_time','12:00','end_time','13:00','cleaner_ids','[]'::jsonb,
   'é',jsonb_build_object('nested',jsonb_build_array(1,2.50,-3)),'aa','exterior'));
 reordered:='[{"aa":"exterior","é":{"nested":[1,2.50,-3]},"cleaner_ids":[],"end_time":"13:00","start_time":"12:00","date":"2026-08-04","expected_cleaner_ids":[],"expected_status":"pending","expected_planning_version":0,"task_id":"40000000-0000-0000-0000-000000000002"}]'::jsonb;
 PERFORM set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true); SET LOCAL ROLE authenticated;
 r:=public.apply_planning_batch('50000000-0000-0000-0000-000000000008','unicode-idempotency','10000000-0000-0000-0000-000000000001',NULL,NULL,NULL,'best_effort',original);
 IF r->>'status'<>'applied' THEN RAISE EXCEPTION 'payload Unicode no aplicado: %',r; END IF;
 r:=public.apply_planning_batch('50000000-0000-0000-0000-000000000008','unicode-idempotency','10000000-0000-0000-0000-000000000001',NULL,NULL,'cualquier-hash','best_effort',reordered);
 IF r->>'idempotent_replay'<>'true' THEN RAISE EXCEPTION 'replay Unicode equivalente rechazado: %',r; END IF;
 changed:=jsonb_set(reordered,'{0,é,nested,1}','2.51'::jsonb);
 r:=public.apply_planning_batch('50000000-0000-0000-0000-000000000008','unicode-idempotency','10000000-0000-0000-0000-000000000001',NULL,NULL,repeat('f',64),'best_effort',changed);
 RESET ROLE;
 IF r->>'code'<>'IDEMPOTENCY_CONFLICT' THEN RAISE EXCEPTION 'payload Unicode distinto aceptado: %',r; END IF;
END $$;

-- Payload malformado se clasifica como validación, no como fallo técnico.
DO $$ DECLARE items jsonb:=jsonb_build_array(jsonb_build_object('task_id','not-a-uuid','cleaner_ids','bad')); h text; r jsonb; BEGIN
 h:=public.planning_batch_request_hash('10000000-0000-0000-0000-000000000001',NULL,NULL,'best_effort',items);
 PERFORM set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true); SET LOCAL ROLE authenticated;
 r:=public.apply_planning_batch('50000000-0000-0000-0000-000000000005','idem-bad-schema','10000000-0000-0000-0000-000000000001',NULL,NULL,h,'best_effort',items); RESET ROLE;
 IF r->>'status'<>'validation_failed' OR r->'conflicts'->0->>'code'<>'INVALID_ITEM_SCHEMA' THEN RAISE EXCEPTION 'schema inválido mal clasificado: %',r; END IF;
END $$;

-- El servidor recalcula el hash antes del replay: payload distinto con la misma
-- key y el hash original del cliente nunca se acepta como replay.
DO $$ DECLARE r jsonb; items jsonb; original_hash text; BEGIN
 items:=jsonb_build_array(jsonb_build_object(
   'task_id','40000000-0000-0000-0000-000000000001','expected_planning_version',0,
   'expected_status','pending','expected_start_time','10:00','expected_end_time','11:00',
   'expected_cleaner_ids',jsonb_build_array('30000000-0000-0000-0000-000000000001'),
   'date','2026-08-03','start_time','10:45','end_time','12:00',
   'cleaner_ids',jsonb_build_array('30000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001')));
 SELECT request_hash INTO original_hash FROM public.planning_apply_batches WHERE id='50000000-0000-0000-0000-000000000001';
 PERFORM set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true); SET LOCAL ROLE authenticated;
 r:=public.apply_planning_batch('50000000-0000-0000-0000-000000000001','idem-ok1','10000000-0000-0000-0000-000000000001',NULL,NULL,original_hash,'require_all_recipients',items); RESET ROLE;
 IF r->>'code'<>'IDEMPOTENCY_CONFLICT' THEN RAISE EXCEPTION 'conflicto idempotencia ausente: %',r; END IF;
END $$;

-- Validación prospectiva revierte el lote completo y conserva ledger fallido.
DO $$ DECLARE items jsonb; h text; r jsonb; BEGIN
 items:=jsonb_build_array(
  jsonb_build_object('task_id','40000000-0000-0000-0000-000000000002','expected_planning_version',0,'expected_status','pending','expected_cleaner_ids','[]'::jsonb,'date','2026-08-03','start_time','13:00','end_time','14:00','cleaner_ids',jsonb_build_array('30000000-0000-0000-0000-000000000001')),
  jsonb_build_object('task_id','40000000-0000-0000-0000-000000000001','expected_planning_version',0,'expected_status','pending','expected_cleaner_ids',jsonb_build_array('30000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001'),'date','2026-08-03','start_time','14:00','end_time','15:00','cleaner_ids',jsonb_build_array('30000000-0000-0000-0000-000000000001')));
 h:=public.planning_batch_request_hash('10000000-0000-0000-0000-000000000001',NULL,NULL,'require_all_recipients',items);
 PERFORM set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true); SET LOCAL ROLE authenticated;
 r:=public.apply_planning_batch('50000000-0000-0000-0000-000000000002','idem-stale','10000000-0000-0000-0000-000000000001',NULL,NULL,h,'require_all_recipients',items); RESET ROLE;
 IF r->>'status'<>'validation_failed' OR (SELECT start_time FROM public.tasks WHERE id='40000000-0000-0000-0000-000000000002')<>'12:00' THEN RAISE EXCEPTION 'rollback validación falló: %',r; END IF;
 IF (SELECT status FROM public.planning_apply_batches WHERE id='50000000-0000-0000-0000-000000000002')<>'validation_failed' THEN RAISE EXCEPTION 'batch fallido no auditable'; END IF;
END $$;

-- Ausencias se revalidan contra el estado prospectivo completo.
INSERT INTO public.worker_absences(cleaner_id,start_date,end_date) VALUES('30000000-0000-0000-0000-000000000003','2026-08-03','2026-08-03');
DO $$ DECLARE items jsonb; h text; r jsonb; BEGIN
 items:=jsonb_build_array(jsonb_build_object('task_id','40000000-0000-0000-0000-000000000002','expected_planning_version',0,'expected_status','pending','expected_cleaner_ids','[]'::jsonb,'date','2026-08-03','start_time','12:00','end_time','13:00','cleaner_ids',jsonb_build_array('30000000-0000-0000-0000-000000000003')));
 h:=public.planning_batch_request_hash('10000000-0000-0000-0000-000000000001',NULL,NULL,'best_effort',items);
 PERFORM set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true); SET LOCAL ROLE authenticated;
 r:=public.apply_planning_batch('50000000-0000-0000-0000-000000000006','idem-absence','10000000-0000-0000-0000-000000000001',NULL,NULL,h,'best_effort',items); RESET ROLE;
 IF r->>'status'<>'validation_failed' OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r->'conflicts') c WHERE c->>'code'='WORKER_ABSENT') THEN RAISE EXCEPTION 'ausencia no revalidada: %',r; END IF;
END $$;
DELETE FROM public.worker_absences;

-- La ocurrencia recurrente, su asignación y su outbox nacen en el mismo commit.
INSERT INTO public.recurring_tasks(id,name,type,start_time,end_time,check_out,check_in,frequency,start_date,next_execution,sede_id)
VALUES('60000000-0000-0000-0000-000000000001','Recurrente','cleaning','10:00','11:00','10:00','15:00','weekly','2026-08-04','2026-08-04','10000000-0000-0000-0000-000000000001');
DO $$ DECLARE items jsonb; h text; r jsonb; generated uuid; BEGIN
 items:=jsonb_build_array(jsonb_build_object(
  'recurring_task_id','60000000-0000-0000-0000-000000000001','execution_date','2026-08-04','next_execution','2026-08-11','expected_recurring_revision',0,
  'schedule_snapshot',jsonb_build_object('frequency','weekly','interval_days',1,'days_of_week',NULL,'day_of_month',NULL,'start_date','2026-08-04','end_date',NULL),
  'date','2026-08-04','start_time','10:00','end_time','11:00','cleaner_ids',jsonb_build_array('30000000-0000-0000-0000-000000000001')));
 h:=public.planning_batch_request_hash('10000000-0000-0000-0000-000000000001',NULL,NULL,'require_all_recipients',items);
 PERFORM set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true); SET LOCAL ROLE authenticated;
 r:=public.apply_planning_batch('50000000-0000-0000-0000-000000000003','idem-recurrence','10000000-0000-0000-0000-000000000001',NULL,NULL,h,'require_all_recipients',items); RESET ROLE;
 IF r->>'status'<>'applied' THEN RAISE EXCEPTION 'recurrencia no aplicada: %, %',r,(SELECT failure_summary FROM public.planning_apply_batches WHERE id='50000000-0000-0000-0000-000000000003'); END IF;
 SELECT generated_task_id INTO generated FROM public.recurring_task_executions WHERE recurring_task_id='60000000-0000-0000-0000-000000000001' AND execution_day='2026-08-04' AND success;
 IF generated IS NULL OR NOT EXISTS(SELECT 1 FROM public.task_assignments WHERE task_id=generated AND cleaner_id='30000000-0000-0000-0000-000000000001') THEN RAISE EXCEPTION 'materialización/asignación recurrente incompleta'; END IF;
END $$;

-- Fault injection real en el INSERT de la asignación 75/150: rollback total de negocio.
INSERT INTO public.tasks(id,date,start_time,end_time,sede_id)
SELECT md5('fault-task-'||i)::uuid,DATE '2026-09-01'+(i-1),'10:00','11:00','10000000-0000-0000-0000-000000000001' FROM generate_series(1,150)i;
INSERT INTO public.planning_runs(id,sede_id,status) VALUES('70000000-0000-0000-0000-000000000075','10000000-0000-0000-0000-000000000001','draft');
INSERT INTO public.planning_run_items(run_id,task_id,status) VALUES('70000000-0000-0000-0000-000000000075',md5('fault-task-1')::uuid,'draft');
CREATE FUNCTION public.planning_test_fail_75() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.task_id=md5('fault-task-75')::uuid THEN RAISE EXCEPTION 'injected item 75'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER planning_test_fail_75 BEFORE INSERT ON public.task_assignments FOR EACH ROW EXECUTE FUNCTION public.planning_test_fail_75();
DO $$ DECLARE items jsonb; h text; r jsonb; BEGIN
 SELECT jsonb_agg(jsonb_build_object('task_id',md5('fault-task-'||i)::uuid,'expected_planning_version',0,'expected_status','pending','expected_cleaner_ids','[]'::jsonb,'date',DATE '2026-09-01'+(i-1),'start_time','11:00','end_time','12:00','cleaner_ids',jsonb_build_array('30000000-0000-0000-0000-000000000002')) ORDER BY i) INTO items FROM generate_series(1,150)i;
 h:=public.planning_batch_request_hash('10000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000075',0,'require_all_recipients',items);
 PERFORM set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true); SET LOCAL ROLE authenticated;
 r:=public.apply_planning_batch('50000000-0000-0000-0000-000000000004','idem-fault-75','10000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000075',0,h,'require_all_recipients',items); RESET ROLE;
 IF r->>'status'<>'technical_failed' THEN RAISE EXCEPTION 'fault 75 no falló: %',r; END IF;
 IF EXISTS(SELECT 1 FROM public.tasks WHERE id IN(SELECT md5('fault-task-'||i)::uuid FROM generate_series(1,150)i) AND (start_time<>'10:00' OR planning_version<>0)) THEN RAISE EXCEPTION 'rollback tareas 75/150 parcial'; END IF;
 IF EXISTS(SELECT 1 FROM public.task_assignments WHERE task_id IN(SELECT md5('fault-task-'||i)::uuid FROM generate_series(1,150)i)) OR EXISTS(SELECT 1 FROM public.notification_events WHERE batch_id='50000000-0000-0000-0000-000000000004') OR EXISTS(SELECT 1 FROM public.planning_assignment_audit WHERE batch_id='50000000-0000-0000-0000-000000000004') THEN RAISE EXCEPTION 'rollback 75/150 dejó efectos de negocio'; END IF;
 IF (SELECT status FROM public.planning_apply_batches WHERE id='50000000-0000-0000-0000-000000000004')<>'technical_failed' THEN RAISE EXCEPTION 'fault batch no auditable'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.planning_runs WHERE id='70000000-0000-0000-0000-000000000075' AND status='draft' AND approved_by IS NULL AND approved_at IS NULL AND applied_batch_id IS NULL AND version=0) THEN RAISE EXCEPTION 'rollback 75/150 mutó planning_run'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.planning_run_items WHERE run_id='70000000-0000-0000-0000-000000000075' AND status='draft' AND applied_at IS NULL) THEN RAISE EXCEPTION 'rollback 75/150 mutó planning_run_items'; END IF;
END $$;
DROP TRIGGER planning_test_fail_75 ON public.task_assignments;
DROP FUNCTION public.planning_test_fail_75();

-- 501 retorna validación canónica sin crear ledger ni hacer business writes.
DO $$ DECLARE items jsonb; h text; r jsonb; batch uuid:=gen_random_uuid(); before_batches bigint; BEGIN
 SELECT jsonb_agg(jsonb_build_object('task_id',gen_random_uuid(),'cleaner_ids','[]'::jsonb)) INTO items FROM generate_series(1,501);
 h:=public.planning_batch_request_hash('10000000-0000-0000-0000-000000000001',NULL,NULL,'best_effort',items);
 SELECT count(*) INTO before_batches FROM public.planning_apply_batches;
 PERFORM set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true); SET LOCAL ROLE authenticated;
 r:=public.apply_planning_batch(batch,'idem-over-500','10000000-0000-0000-0000-000000000001',NULL,NULL,h,'best_effort',items); RESET ROLE;
 IF r->>'status'<>'validation_failed' OR r->>'code'<>'ITEM_COUNT_OUT_OF_RANGE'
    OR r->>'batch_id'<>batch::text OR r->>'idempotent_replay'<>'false'
    OR r->>'applied_task_count'<>'0' OR r->>'applied_assignment_count'<>'0'
    OR r->>'notification_event_count'<>'0' OR jsonb_typeof(r->'conflicts')<>'array'
    OR r->'conflicts'<>jsonb_build_array(jsonb_build_object('code','ITEM_COUNT_OUT_OF_RANGE')) THEN
  RAISE EXCEPTION '501 items shape inválido: %',r;
 END IF;
 IF (SELECT count(*) FROM public.planning_apply_batches)<>before_batches
    OR EXISTS(SELECT 1 FROM public.planning_apply_batches WHERE id=batch)
    OR EXISTS(SELECT 1 FROM public.planning_apply_batch_items WHERE batch_id=batch)
    OR EXISTS(SELECT 1 FROM public.planning_assignment_audit WHERE batch_id=batch)
    OR EXISTS(SELECT 1 FROM public.notification_events WHERE batch_id=batch) THEN
  RAISE EXCEPTION '501 items dejó writes: %',r;
 END IF;
END $$;

-- Seguridad: supervisor y manager sin sede no pueden ejecutar.
DO $$ DECLARE ok boolean:=false; BEGIN
 PERFORM set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true); SET LOCAL ROLE authenticated;
 BEGIN PERFORM public.apply_planning_batch(gen_random_uuid(),'denied','10000000-0000-0000-0000-000000000001',NULL,NULL,repeat('0',64),'best_effort','[]'); EXCEPTION WHEN insufficient_privilege THEN ok:=true; END; RESET ROLE;
 IF NOT ok THEN RAISE EXCEPTION 'supervisor autorizado indebidamente'; END IF;
END $$;
DO $$ DECLARE ok boolean:=false; BEGIN
 PERFORM set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000003',true); SET LOCAL ROLE authenticated;
 BEGIN PERFORM public.apply_planning_batch(gen_random_uuid(),'denied2','10000000-0000-0000-0000-000000000001',NULL,NULL,repeat('0',64),'best_effort','[]'); EXCEPTION WHEN insufficient_privilege THEN ok:=true; END; RESET ROLE;
 IF NOT ok THEN RAISE EXCEPTION 'manager sin sede autorizado indebidamente'; END IF;
END $$;
ROLLBACK;
SELECT 'PLANNING_BATCH_TRANSACTION_TEST_PASS' AS result;
