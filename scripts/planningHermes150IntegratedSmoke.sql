\set ON_ERROR_STOP on
INSERT INTO public.sedes(id) VALUES ('13000000-0000-0000-0000-000000000001');
INSERT INTO public.user_roles(user_id,role) VALUES ('23000000-0000-0000-0000-000000000001','manager');
INSERT INTO public.user_sede_access(user_id,sede_id) VALUES
 ('23000000-0000-0000-0000-000000000001','13000000-0000-0000-0000-000000000001');
INSERT INTO public.cleaners(id,name,email,telefono,sede_id) VALUES
 ('33000000-0000-0000-0000-000000000001','Delete primero','delete-first@example.invalid','612345671','13000000-0000-0000-0000-000000000001'),
 ('33000000-0000-0000-0000-000000000002','Batch primero','batch-first@example.invalid','612345672','13000000-0000-0000-0000-000000000001'),
 ('33000000-0000-0000-0000-000000000003','Shape','shape@example.invalid','612345673','13000000-0000-0000-0000-000000000001');
INSERT INTO public.tasks(id,date,start_time,end_time,sede_id) VALUES
 ('43000000-0000-0000-0000-000000000001','2027-01-11','10:00','11:00','13000000-0000-0000-0000-000000000001'),
 ('43000000-0000-0000-0000-000000000002','2027-01-12','10:00','11:00','13000000-0000-0000-0000-000000000001'),
 ('43000000-0000-0000-0000-000000000003','2027-01-13','10:00','11:00','13000000-0000-0000-0000-000000000001'),
 ('43000000-0000-0000-0000-000000000004','2027-01-14','10:00','11:00','13000000-0000-0000-0000-000000000001'),
 ('43000000-0000-0000-0000-000000000005','2027-01-15','10:00','11:00','13000000-0000-0000-0000-000000000001');

-- Helpers exclusivamente del baseline integrado: no forman parte de la migración.
CREATE TABLE public.planning_test_race_results(
 label text PRIMARY KEY,
 result jsonb NOT NULL
);
CREATE TABLE public.planning_test_barriers(
 label text PRIMARY KEY,
 released boolean NOT NULL DEFAULT false
);
INSERT INTO public.planning_test_barriers(label) VALUES ('DELETE_FIRST'),('BATCH_FIRST');
CREATE OR REPLACE FUNCTION public.planning_test_wait_for_release(_label text)
RETURNS void LANGUAGE plpgsql VOLATILE SET search_path=pg_catalog,public AS $$
DECLARE can_release boolean;
BEGIN
 LOOP
  SELECT released INTO can_release FROM public.planning_test_barriers WHERE label=_label;
  IF can_release THEN RETURN; END IF;
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.planning_test_result_is_canonical(_result jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT jsonb_typeof(_result)='object'
   AND (_result ?& ARRAY['batch_id','status','idempotent_replay','applied_task_count','applied_assignment_count','notification_event_count','conflicts'])
   AND jsonb_typeof(_result->'batch_id')='string'
   AND (_result->>'batch_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   AND _result->>'status' IN ('applied','validation_failed','technical_failed')
   AND jsonb_typeof(_result->'idempotent_replay')='boolean'
   AND jsonb_typeof(_result->'applied_task_count')='number'
   AND (_result->>'applied_task_count') ~ '^[0-9]+$'
   AND jsonb_typeof(_result->'applied_assignment_count')='number'
   AND (_result->>'applied_assignment_count') ~ '^[0-9]+$'
   AND jsonb_typeof(_result->'notification_event_count')='number'
   AND (_result->>'notification_event_count') ~ '^[0-9]+$'
   AND jsonb_typeof(_result->'conflicts')='array'
$$;

CREATE OR REPLACE FUNCTION public.planning_integrated_apply_raw(
 _batch uuid,_key text,_policy text,_items jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM set_config('request.jwt.claim.sub','23000000-0000-0000-0000-000000000001',true);
 PERFORM set_config('request.jwt.claim.role','authenticated',true);
 RETURN public.apply_planning_batch(
   _batch,_key,'13000000-0000-0000-0000-000000000001',NULL,NULL,repeat('0',64),_policy,_items);
END $$;

CREATE OR REPLACE FUNCTION public.planning_integrated_apply(
 _batch uuid,_key text,_task uuid,_cleaner uuid,_date date
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE items jsonb;
BEGIN
 items:=jsonb_build_array(jsonb_build_object(
   'task_id',_task,'expected_planning_version',0,'expected_status','pending',
   'expected_cleaner_ids','[]'::jsonb,'date',_date,'start_time','10:00','end_time','11:00',
   'cleaner_ids',jsonb_build_array(_cleaner)));
 RETURN public.planning_integrated_apply_raw(_batch,_key,'best_effort',items);
END $$;

CREATE OR REPLACE FUNCTION public.planning_test_force_technical_failure() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'PLANNING_TEST_TECHNICAL_FAULT' USING ERRCODE='XX000'; END
$$;
CREATE TRIGGER planning_test_force_technical_failure
BEFORE UPDATE ON public.tasks FOR EACH ROW
WHEN (NEW.id='43000000-0000-0000-0000-000000000005'::uuid)
EXECUTE FUNCTION public.planning_test_force_technical_failure();

DO $$
DECLARE
 result jsonb; replay jsonb; items jsonb; before_counts bigint[]; after_counts bigint[];
BEGIN
 -- Autorización y UUID mal tipado siguen siendo errores de transporte fuera/del borde de la función.
 PERFORM set_config('request.jwt.claim.sub','',true);
 BEGIN
   PERFORM public.apply_planning_batch(
     '53000000-0000-4000-8000-000000000099','integrated-unauthorized',
     '13000000-0000-0000-0000-000000000001',NULL,NULL,repeat('0',64),'best_effort','[]'::jsonb);
   RAISE EXCEPTION 'integrated_auth_fail_open';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
   EXECUTE $query$SELECT public.apply_planning_batch('not-a-uuid','transport-invalid-uuid','13000000-0000-0000-0000-000000000001',NULL,NULL,repeat('0',64),'best_effort','[]'::jsonb)$query$;
   RAISE EXCEPTION 'integrated_uuid_transport_fail_open';
 EXCEPTION WHEN invalid_text_representation THEN NULL;
 END;

 SELECT ARRAY[
   (SELECT count(*) FROM public.planning_apply_batches),
   (SELECT count(*) FROM public.planning_apply_batch_items),
   (SELECT count(*) FROM public.planning_assignment_audit),
   (SELECT count(*) FROM public.task_assignments),
   (SELECT count(*) FROM public.notification_events)
 ] INTO before_counts;

 result:=public.planning_integrated_apply_raw(NULL,'valid-null-batch-key','best_effort',jsonb_build_array(jsonb_build_object('x',1)));
 IF NOT public.planning_test_result_is_canonical(result)
    OR result->>'batch_id'<>'00000000-0000-0000-0000-000000000000'
    OR result->>'status'<>'validation_failed' OR result->>'code'<>'INVALID_BATCH_IDEMPOTENCY'
    OR result->'conflicts'<>jsonb_build_array(jsonb_build_object('code','INVALID_BATCH_IDEMPOTENCY')) THEN
   RAISE EXCEPTION 'invalid_batch_idempotency_shape: %',result;
 END IF;
 result:=public.planning_integrated_apply_raw('53000000-0000-4000-8000-000000000011','integrated-items-object','best_effort','{}'::jsonb);
 IF NOT public.planning_test_result_is_canonical(result) OR result->>'code'<>'ITEMS_MUST_BE_ARRAY' THEN
   RAISE EXCEPTION 'items_must_be_array_shape: %',result;
 END IF;
 result:=public.planning_integrated_apply_raw('53000000-0000-4000-8000-000000000012','integrated-empty-items','best_effort','[]'::jsonb);
 IF NOT public.planning_test_result_is_canonical(result) OR result->>'code'<>'ITEM_COUNT_OUT_OF_RANGE' THEN
   RAISE EXCEPTION 'item_count_out_of_range_shape: %',result;
 END IF;
 result:=public.planning_integrated_apply_raw('53000000-0000-4000-8000-000000000013','integrated-invalid-policy','invalid_policy',jsonb_build_array(jsonb_build_object('x',1)));
 IF NOT public.planning_test_result_is_canonical(result) OR result->>'code'<>'INVALID_NOTIFICATION_POLICY' THEN
   RAISE EXCEPTION 'invalid_notification_policy_shape: %',result;
 END IF;

 SELECT ARRAY[
   (SELECT count(*) FROM public.planning_apply_batches),
   (SELECT count(*) FROM public.planning_apply_batch_items),
   (SELECT count(*) FROM public.planning_assignment_audit),
   (SELECT count(*) FROM public.task_assignments),
   (SELECT count(*) FROM public.notification_events)
 ] INTO after_counts;
 IF after_counts<>before_counts THEN
   RAISE EXCEPTION 'early_validation_business_writes: before=%, after=%',before_counts,after_counts;
 END IF;

 -- Validación persistida: conserva ledger del fallo pero no toca negocio.
 result:=public.planning_integrated_apply_raw(
   '53000000-0000-4000-8000-000000000014','integrated-persisted-validation','best_effort',
   jsonb_build_array(jsonb_build_object('task_id','43000000-0000-0000-0000-000000000004')));
 IF NOT public.planning_test_result_is_canonical(result)
    OR result->>'status'<>'validation_failed' OR result->>'code'<>'VALIDATION_FAILED'
    OR NOT EXISTS(SELECT 1 FROM public.planning_apply_batches WHERE id='53000000-0000-4000-8000-000000000014' AND status='validation_failed')
    OR EXISTS(SELECT 1 FROM public.task_assignments WHERE task_id='43000000-0000-0000-0000-000000000004')
    OR EXISTS(SELECT 1 FROM public.planning_assignment_audit WHERE batch_id='53000000-0000-4000-8000-000000000014')
    OR EXISTS(SELECT 1 FROM public.notification_events WHERE batch_id='53000000-0000-4000-8000-000000000014') THEN
   RAISE EXCEPTION 'persisted_validation_invalid: %',result;
 END IF;

 -- Fault injection real dentro de la subtransacción: el trigger es efímero y solo de test.
 result:=public.planning_integrated_apply(
   '53000000-0000-4000-8000-000000000015','integrated-technical-fault',
   '43000000-0000-0000-0000-000000000005','33000000-0000-0000-0000-000000000003','2027-01-15');

 IF NOT public.planning_test_result_is_canonical(result)
    OR result->>'status'<>'technical_failed' OR result->>'code'<>'TECHNICAL_FAILURE'
    OR NOT EXISTS(SELECT 1 FROM public.planning_apply_batches WHERE id='53000000-0000-4000-8000-000000000015' AND status='technical_failed' AND failure_summary->>'message'='PLANNING_TEST_TECHNICAL_FAULT')
    OR EXISTS(SELECT 1 FROM public.planning_apply_batch_items WHERE batch_id='53000000-0000-4000-8000-000000000015')
    OR EXISTS(SELECT 1 FROM public.planning_assignment_audit WHERE batch_id='53000000-0000-4000-8000-000000000015')
    OR EXISTS(SELECT 1 FROM public.notification_events WHERE batch_id='53000000-0000-4000-8000-000000000015')
    OR EXISTS(SELECT 1 FROM public.task_assignments WHERE task_id='43000000-0000-0000-0000-000000000005')
    OR NOT EXISTS(SELECT 1 FROM public.tasks WHERE id='43000000-0000-0000-0000-000000000005' AND planning_version=0 AND date='2027-01-15' AND start_time='10:00' AND end_time='11:00') THEN
   RAISE EXCEPTION 'technical_failure_invalid: %',result;
 END IF;

 -- Éxito, replay y ambos conflictos de idempotencia.
 result:=public.planning_integrated_apply(
   '53000000-0000-4000-8000-000000000003','integrated-shape-success',
   '43000000-0000-0000-0000-000000000003','33000000-0000-0000-0000-000000000003','2027-01-13');
 IF NOT public.planning_test_result_is_canonical(result) OR result->>'status'<>'applied' OR result->>'idempotent_replay'<>'false' THEN
   RAISE EXCEPTION 'integrated_success_shape_invalid: %, failure=%',result,
     (SELECT failure_summary FROM public.planning_apply_batches WHERE id='53000000-0000-4000-8000-000000000003');
 END IF;
 replay:=public.planning_integrated_apply(
   '53000000-0000-4000-8000-000000000003','integrated-shape-success',
   '43000000-0000-0000-0000-000000000003','33000000-0000-0000-0000-000000000003','2027-01-13');
 IF NOT public.planning_test_result_is_canonical(replay) OR replay->>'idempotent_replay'<>'true'
    OR (replay-ARRAY['idempotent_replay'])<>(result-ARRAY['idempotent_replay']) THEN
   RAISE EXCEPTION 'integrated_replay_shape_invalid: % / %',result,replay;
 END IF;
 items:=jsonb_build_array(jsonb_build_object(
   'task_id','43000000-0000-0000-0000-000000000003','expected_planning_version',0,'expected_status','pending',
   'expected_cleaner_ids','[]'::jsonb,'date','2027-01-13','start_time','10:00','end_time','11:00',
   'cleaner_ids',jsonb_build_array('33000000-0000-0000-0000-000000000003')));
 result:=public.planning_integrated_apply_raw('53000000-0000-4000-8000-000000000016','integrated-shape-success','best_effort',items);
 IF NOT public.planning_test_result_is_canonical(result) OR result->>'code'<>'IDEMPOTENCY_CONFLICT'
    OR result->>'batch_id'<>'53000000-0000-4000-8000-000000000003' THEN
   RAISE EXCEPTION 'idempotency_conflict_invalid: %',result;
 END IF;
 result:=public.planning_integrated_apply_raw('53000000-0000-4000-8000-000000000003','integrated-batch-id-conflict','best_effort',items);
 IF NOT public.planning_test_result_is_canonical(result) OR result->>'code'<>'BATCH_IDEMPOTENCY_CONFLICT'
    OR result->>'batch_id'<>'53000000-0000-4000-8000-000000000003' THEN
   RAISE EXCEPTION 'batch_idempotency_conflict_invalid: %',result;
 END IF;
END $$;
DROP TRIGGER planning_test_force_technical_failure ON public.tasks;
DROP FUNCTION public.planning_test_force_technical_failure();
SELECT 'PLANNING_HERMES_150_INTEGRATED_SMOKE_PASS';
