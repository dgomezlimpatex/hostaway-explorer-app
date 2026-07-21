\set ON_ERROR_STOP on
CREATE FUNCTION public.qa_assert(ok boolean, message text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF NOT coalesce(ok,false) THEN RAISE EXCEPTION 'ASSERT: %',message; END IF; END $$;
SELECT set_config('request.jwt.claim.role','service_role',false);
SELECT set_config('request.jwt.claim.sub','',false);

-- Auth/sede: manager solo tiene sede 1; la sede 2 debe ser rechazada sin mutación.
DO $$ DECLARE rejected boolean := false; before_count integer; BEGIN
 SELECT count(*) INTO before_count FROM public.tasks;
 BEGIN
  PERFORM public.batch_create_tasks_transactional(
   '20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002',
   '[{"propertyId":"40000000-0000-0000-0000-000000000002","date":"2026-07-22","startTime":"10:00","endTime":"11:00","cleanerIds":[]}]','qa-denied','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  );
 EXCEPTION WHEN insufficient_privilege THEN rejected := true; END;
 PERFORM public.qa_assert(rejected,'manager sin sede aceptado');
 PERFORM public.qa_assert((SELECT count(*) FROM public.tasks)=before_count,'auth denegada mutó tasks');
END $$;

-- Rollback a mitad de lote: el segundo assignment falla por trigger de prueba.
CREATE FUNCTION public.qa_fail_second_assignment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (SELECT count(*) FROM public.task_assignments) >= 1 THEN RAISE EXCEPTION 'qa middle fault'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER qa_fail_second_assignment BEFORE INSERT ON public.task_assignments FOR EACH ROW EXECUTE FUNCTION public.qa_fail_second_assignment();
DO $$ DECLARE rejected boolean := false; before_tasks integer; before_events integer; BEGIN
 SELECT count(*) INTO before_tasks FROM public.tasks;
 SELECT count(*) INTO before_events FROM public.notification_events;
 BEGIN
  PERFORM public.batch_create_tasks_transactional(
   '20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001',
   '[{"propertyId":"40000000-0000-0000-0000-000000000001","date":"2026-07-22","startTime":"10:00","endTime":"11:00","cleanerIds":["50000000-0000-0000-0000-000000000001"]},{"propertyId":"40000000-0000-0000-0000-000000000001","date":"2026-07-22","startTime":"12:00","endTime":"13:00","cleanerIds":["50000000-0000-0000-0000-000000000001"]}]','qa-rollback','bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
  );
 EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE '%qa middle fault%' THEN rejected := true; ELSE RAISE; END IF; END;
 PERFORM public.qa_assert(rejected,'fault injection no falló');
 PERFORM public.qa_assert((SELECT count(*) FROM public.tasks)=before_tasks,'rollback dejó tasks');
 PERFORM public.qa_assert((SELECT count(*) FROM public.task_assignments)=0,'rollback dejó assignments');
 PERFORM public.qa_assert((SELECT count(*) FROM public.notification_events)=before_events,'rollback dejó outbox');
END $$;
DROP TRIGGER qa_fail_second_assignment ON public.task_assignments;
DROP FUNCTION public.qa_fail_second_assignment();

-- Éxito: nombres/email/datos de propiedad solo salen de DB.
DO $$ DECLARE result jsonb; v_task_id uuid; BEGIN
 result := public.batch_create_tasks_transactional(
  '20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001',
  '[{"propertyId":"40000000-0000-0000-0000-000000000001","property":"EVIL","address":"EVIL","date":"2026-07-22","startTime":"14:00","endTime":"15:00","cleanerIds":["50000000-0000-0000-0000-000000000001"],"cleanerName":"EVIL","cleanerEmail":"evil@example.test"}]','qa-success','cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
 );
 v_task_id := (result->'taskIds'->>0)::uuid;
 PERFORM public.qa_assert(result->>'success'='true' AND (result->>'created')::int=1,'batch success inválido');
 PERFORM public.qa_assert((SELECT property='DB Property' AND address='DB Address' FROM public.tasks WHERE id=v_task_id),'confió property/address request');
 PERFORM public.qa_assert(result->'emailBatches'->0->>'cleanerName'='DB Cleaner','confió nombre request');
 PERFORM public.qa_assert(result->'emailBatches'->0->>'email'='db-cleaner@example.test','confió email request');
 PERFORM public.qa_assert((SELECT count(*) FROM public.notification_events ne WHERE ne.task_id=v_task_id)=1,'faltó outbox');
END $$;

-- Retry durable: misma key/payload devuelve los mismos IDs sin duplicar writers ni outbox.
DO $$ DECLARE a jsonb; b jsonb; rejected boolean := false; bt int; ba int; bo int; BEGIN
 SELECT count(*) INTO bt FROM public.tasks; SELECT count(*) INTO ba FROM public.task_assignments; SELECT count(*) INTO bo FROM public.notification_events;
 a := public.batch_create_tasks_transactional('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','[{"propertyId":"40000000-0000-0000-0000-000000000001","date":"2026-07-28","startTime":"10:00","endTime":"11:00","cleanerIds":["50000000-0000-0000-0000-000000000001"]}]','qa-durable','dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd');
 b := public.batch_create_tasks_transactional('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','[{"propertyId":"40000000-0000-0000-0000-000000000001","date":"2026-07-28","startTime":"10:00","endTime":"11:00","cleanerIds":["50000000-0000-0000-0000-000000000001"]}]','qa-durable','dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd');
 PERFORM public.qa_assert(a->'taskIds'=b->'taskIds','retry cambió IDs');
 PERFORM public.qa_assert((SELECT count(*) FROM public.tasks)=bt+1 AND (SELECT count(*) FROM public.task_assignments)=ba+1 AND (SELECT count(*) FROM public.notification_events)=bo+1,'retry duplicó writers');
 PERFORM public.qa_assert((SELECT count(*) FROM public.batch_task_email_deliveries WHERE request_id=(a->>'requestId')::uuid)=1,'retry duplicó email state');
 BEGIN PERFORM public.batch_create_tasks_transactional('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','[{"propertyId":"40000000-0000-0000-0000-000000000001","date":"2026-07-29","startTime":"10:00","endTime":"11:00","cleanerIds":[]}]','qa-durable','eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee');
 EXCEPTION WHEN unique_violation THEN rejected := true; END;
 PERFORM public.qa_assert(rejected,'misma key aceptó payload distinto');
END $$;

-- IA: fallo en segunda acción revierte horario/asignación/auditoría y mantiene pending.
INSERT INTO public.tasks(id,property,address,date,start_time,end_time,type,status,check_in,check_out,propiedad_id,sede_id)
VALUES('70000000-0000-0000-0000-000000000001','DB Property','DB Address','2026-07-23','09:00','10:00','clean','pending','15:00','11:00','40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
INSERT INTO public.ai_action_proposals(id,owner_user_id,owner_email,status,sede_id,actions)
VALUES('80000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','dgomezlimpatex@gmail.com','pending','10000000-0000-0000-0000-000000000001',
 '[{"type":"assign_task","taskId":"70000000-0000-0000-0000-000000000001","cleanerId":"50000000-0000-0000-0000-000000000001","startTime":"11:00","endTime":"12:00"},{"type":"forbidden"}]');
DO $$ DECLARE rejected boolean := false; BEGIN
 BEGIN PERFORM public.apply_ai_actions_transactional('80000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001');
 EXCEPTION WHEN invalid_parameter_value THEN rejected := true; END;
 PERFORM public.qa_assert(rejected,'IA inválida no falló');
 PERFORM public.qa_assert((SELECT status='pending' FROM public.ai_action_proposals WHERE id='80000000-0000-0000-0000-000000000001'),'proposal no hizo rollback');
 PERFORM public.qa_assert((SELECT start_time='09:00' AND cleaner_id IS NULL FROM public.tasks WHERE id='70000000-0000-0000-0000-000000000001'),'primera acción IA persistió');
 PERFORM public.qa_assert((SELECT count(*) FROM public.ai_action_audit_logs WHERE proposal_id='80000000-0000-0000-0000-000000000001')=0,'audit parcial persistió');
END $$;

-- Auto-assign respeta ausencias.
INSERT INTO public.tasks(id,property,address,date,start_time,end_time,type,status,check_in,check_out,propiedad_id,sede_id)
VALUES('70000000-0000-0000-0000-000000000002','DB Property','DB Address','2026-07-24','09:00','10:00','clean','pending','15:00','11:00','40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
INSERT INTO public.worker_absences(cleaner_id,start_date,end_date) VALUES('50000000-0000-0000-0000-000000000001','2026-07-24','2026-07-24');
SELECT public.qa_assert(
 (public.auto_assign_task_transactional('70000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002')->>'success')::boolean=false,
 'auto-assign ignoró ausencia'
);
SELECT public.qa_assert((SELECT count(*) FROM public.task_assignments WHERE task_id='70000000-0000-0000-0000-000000000002')=0,'auto-assign ausente escribió');
DELETE FROM public.worker_absences;

-- Solape/capacidad legacy sin fila canónica también bloquea al cleaner.
INSERT INTO public.tasks(id,property,address,date,start_time,end_time,type,status,check_in,check_out,propiedad_id,sede_id,cleaner_id,cleaner) VALUES
('70000000-0000-0000-0000-000000000003','DB Property','DB Address','2026-07-30','09:00','10:00','clean','pending','15:00','11:00','40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','DB Cleaner'),
('70000000-0000-0000-0000-000000000004','DB Property','DB Address','2026-07-30','09:30','10:30','clean','pending','15:00','11:00','40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',null,null);
SELECT public.qa_assert((public.auto_assign_task_transactional('70000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000002')->>'success')::boolean=false,'auto ignoró asignación legacy');
SELECT public.qa_assert((SELECT count(*) FROM public.task_assignments WHERE task_id='70000000-0000-0000-0000-000000000004')=0,'auto escribió pese a solape legacy');

-- Fixtures de concurrencia: auto A/B y propuesta IA idempotente.
INSERT INTO public.tasks(id,property,address,date,start_time,end_time,type,status,check_in,check_out,propiedad_id,sede_id)
VALUES
 ('70000000-0000-0000-0000-000000000010','DB Property','DB Address','2026-07-25','09:00','10:00','clean','pending','15:00','11:00','40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001'),
 ('70000000-0000-0000-0000-000000000011','DB Property','DB Address','2026-07-25','09:30','10:30','clean','pending','15:00','11:00','40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001'),
 ('70000000-0000-0000-0000-000000000012','DB Property','DB Address','2026-07-26','11:00','12:00','clean','pending','15:00','11:00','40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001'),
 ('70000000-0000-0000-0000-000000000020','DB Property','DB Address','2026-07-27','08:00','09:00','clean','pending','15:00','11:00','40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001'),
 ('70000000-0000-0000-0000-000000000021','DB Property','DB Address','2026-07-27','10:00','11:00','clean','pending','15:00','11:00','40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
INSERT INTO public.ai_action_proposals(id,owner_user_id,owner_email,status,sede_id,actions)
VALUES('80000000-0000-0000-0000-000000000010','20000000-0000-0000-0000-000000000001','dgomezlimpatex@gmail.com','pending','10000000-0000-0000-0000-000000000001',
 '[{"type":"assign_task","taskId":"70000000-0000-0000-0000-000000000012","cleanerId":"50000000-0000-0000-0000-000000000001"}]');
INSERT INTO public.tasks(id,property,address,date,start_time,end_time,type,status,check_in,check_out,propiedad_id,sede_id)
VALUES('70000000-0000-0000-0000-000000000013','DB Property','DB Address','2026-07-31','11:00','12:00','clean','pending','15:00','11:00','40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
INSERT INTO public.ai_action_proposals(id,owner_user_id,owner_email,status,sede_id,actions)
VALUES('80000000-0000-0000-0000-000000000011','20000000-0000-0000-0000-000000000001','dgomezlimpatex@gmail.com','pending','10000000-0000-0000-0000-000000000001',
 '[{"type":"assign_task","taskId":"70000000-0000-0000-0000-000000000013","cleanerId":"50000000-0000-0000-0000-000000000001"}]');
INSERT INTO public.ai_action_proposals(id,owner_user_id,owner_email,status,sede_id,actions) VALUES
('80000000-0000-0000-0000-000000000020','20000000-0000-0000-0000-000000000001','dgomezlimpatex@gmail.com','pending','10000000-0000-0000-0000-000000000001','[{"type":"assign_task","taskId":"70000000-0000-0000-0000-000000000020","cleanerId":"50000000-0000-0000-0000-000000000001"},{"type":"assign_task","taskId":"70000000-0000-0000-0000-000000000021","cleanerId":"50000000-0000-0000-0000-000000000001"}]'),
('80000000-0000-0000-0000-000000000021','20000000-0000-0000-0000-000000000001','dgomezlimpatex@gmail.com','pending','10000000-0000-0000-0000-000000000001','[{"type":"assign_task","taskId":"70000000-0000-0000-0000-000000000021","cleanerId":"50000000-0000-0000-0000-000000000001"},{"type":"assign_task","taskId":"70000000-0000-0000-0000-000000000020","cleanerId":"50000000-0000-0000-0000-000000000001"}]');

-- Catálogo/grants.
SELECT public.qa_assert(NOT has_function_privilege('anon','public.batch_create_tasks_transactional(uuid,uuid,jsonb,text,text)','EXECUTE'),'anon ejecuta batch');
SELECT public.qa_assert(NOT has_function_privilege('authenticated','public.batch_create_tasks_transactional(uuid,uuid,jsonb,text,text)','EXECUTE'),'authenticated ejecuta batch directo');
SELECT public.qa_assert(NOT has_function_privilege('anon','public.apply_ai_actions_transactional(uuid,uuid)','EXECUTE'),'anon ejecuta AI');
SELECT public.qa_assert(NOT has_function_privilege('anon','public.auto_assign_task_transactional(uuid,uuid)','EXECUTE'),'anon ejecuta auto');
SELECT public.qa_assert((SELECT prosecdef AND proconfig @> ARRAY['search_path=public, pg_temp'] FROM pg_proc WHERE oid='public.auto_assign_task_transactional(uuid,uuid)'::regprocedure),'search_path/definer auto inválido');
SELECT 'canonical-writers-db-phase1: OK';
