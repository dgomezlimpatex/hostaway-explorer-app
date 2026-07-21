BEGIN;
SET LOCAL request.jwt.claim.role = 'service_role';

DO $test$
DECLARE
  fixture record;
  event_id uuid := gen_random_uuid();
  target_delivery_id uuid := gen_random_uuid();
  lease_a uuid := gen_random_uuid();
  lease_b uuid := gen_random_uuid();
  lease_loser uuid := gen_random_uuid();
  token_a uuid := gen_random_uuid();
  token_b uuid := gen_random_uuid();
  claim_a record;
  claim_b record;
  bound uuid;
  final_status text;
  transition record;
  status_callback_id uuid;
  alien_callback_id uuid;
BEGIN
  -- Las filas creadas después de 15100 pero antes de 15200 deben tener ya su
  -- slot 1 durable. El upgrade conserva identidad y no fabrica un POST 3.
  IF NOT EXISTS (
    SELECT 1 FROM public.notification_delivery_attempts
    WHERE delivery_id='70000000-0000-0000-0000-000000000010'
      AND attempt_no=1 AND state='contacting_meta'
      AND provider_message_id IS NULL
  ) THEN RAISE EXCEPTION 'legacy_contacting_attempt_not_materialized'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.notification_delivery_attempts
    WHERE delivery_id='70000000-0000-0000-0000-000000000011'
      AND attempt_no=1 AND state='reconciled'
      AND provider_message_id='wamid.legacy-known'
  ) THEN RAISE EXCEPTION 'legacy_known_attempt_not_reconciled'; END IF;
  IF (SELECT claimed FROM public.begin_whatsapp_send_attempt(
      '70000000-0000-0000-0000-000000000011',
      '50000000-0000-0000-0000-000000000011',
      '60000000-0000-0000-0000-000000000011',gen_random_uuid(),'{}')) THEN
    RAISE EXCEPTION 'known_legacy_delivery_reopened';
  END IF;

  SELECT task.id AS task_id, task.cleaner_id, task.sede_id
  INTO fixture FROM public.tasks task WHERE task.cleaner_id IS NOT NULL LIMIT 1;
  IF fixture.task_id IS NULL THEN RAISE EXCEPTION 'task_fixture_missing'; END IF;

  INSERT INTO public.notification_events(
    id,event_type,entity_type,entity_id,task_id,cleaner_id,sede_id,payload,dedupe_key,
    status,processed_at,processing_lease_token
  ) VALUES (
    event_id,'task_assigned','tasks',fixture.task_id,fixture.task_id,fixture.cleaner_id,
    fixture.sede_id,'{}','hermes-attempt-history-'||event_id,'processing',now(),lease_a
  );
  INSERT INTO public.notification_deliveries(
    id,notification_event_id,channel,provider,recipient,template_name,status,provider_payload
  ) VALUES (
    target_delivery_id,event_id,'whatsapp','meta_cloud_api','+34612345678',
    'task_assigned_approval_es','queued',jsonb_build_object(
      'buttonPayloads',jsonb_build_array('approve:'||fixture.task_id||':attempt1')
    )
  );

  -- t0: begin persiste intención; simulamos crash sin ninguna finalize.
  SELECT * INTO claim_a FROM public.begin_whatsapp_send_attempt(
    target_delivery_id,event_id,lease_a,token_a,'{}'::jsonb
  );
  IF NOT claim_a.claimed OR claim_a.attempt_no <> 1 THEN RAISE EXCEPTION 'attempt_1_not_claimed'; END IF;
  IF (SELECT claimed FROM public.begin_whatsapp_send_attempt(target_delivery_id,event_id,lease_a,gen_random_uuid(),'{}')) THEN
    RAISE EXCEPTION 'second_worker_claimed_same_attempt_at_t0';
  END IF;

  -- t10: el lease genérico ya parece stale, pero no se abandona el intento ni se
  -- autoriza otro POST antes de la frontera operativa de 15 minutos.
  UPDATE public.notification_events SET processed_at=now()-interval '11 minutes' WHERE id=event_id;
  UPDATE public.notification_deliveries SET provider_payload=provider_payload||jsonb_build_object(
    'send_started_at',now()-interval '10 minutes','first_send_started_at',now()-interval '10 minutes',
    'meta_attempt_count',1,'meta_attempt_state','contacting_meta','send_lease_token',lease_a
  ) WHERE id=target_delivery_id;
  UPDATE public.notification_delivery_attempts SET started_at=now()-interval '10 minutes'
  WHERE id=claim_a.attempt_id;
  IF public.claim_bounded_whatsapp_retry(event_id,lease_b) IS NOT NULL THEN
    RAISE EXCEPTION 'retry_claimed_at_t10';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.notification_delivery_attempts WHERE id=claim_a.attempt_id AND state='contacting_meta') THEN
    RAISE EXCEPTION 'attempt_abandoned_before_t15';
  END IF;

  -- t15: un worker gana bajo aggregate lock; el otro observa el nuevo lease y no
  -- obtiene autorización. El child stale pasa a uncertain antes del slot 2.
  UPDATE public.notification_events SET processed_at=now()-interval '16 minutes' WHERE id=event_id;
  UPDATE public.notification_deliveries SET provider_payload=provider_payload||jsonb_build_object(
    'send_started_at',now()-interval '16 minutes','first_send_started_at',now()-interval '16 minutes'
  ) WHERE id=target_delivery_id;
  UPDATE public.notification_delivery_attempts SET started_at=now()-interval '16 minutes'
  WHERE id=claim_a.attempt_id;

  IF public.claim_bounded_whatsapp_retry(event_id,lease_b) IS DISTINCT FROM target_delivery_id THEN
    RAISE EXCEPTION 'retry_not_claimed_at_t15';
  END IF;
  IF public.claim_bounded_whatsapp_retry(event_id,lease_loser) IS NOT NULL THEN
    RAISE EXCEPTION 'second_worker_also_claimed_retry';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.notification_delivery_attempts
    WHERE id=claim_a.attempt_id AND state='completed_uncertain'
      AND error_code='worker_crash_recovered'
  ) THEN RAISE EXCEPTION 'crashed_attempt_not_terminalized_uncertain'; END IF;

  SELECT * INTO claim_b FROM public.begin_whatsapp_send_attempt(
    target_delivery_id,event_id,lease_b,token_b,'{}'::jsonb
  );
  IF NOT claim_b.claimed OR claim_b.attempt_no <> 2 THEN RAISE EXCEPTION 'attempt_2_not_claimed'; END IF;
  IF (SELECT claimed FROM public.begin_whatsapp_send_attempt(target_delivery_id,event_id,lease_b,gen_random_uuid(),'{}')) THEN
    RAISE EXCEPTION 'post_3_was_authorized';
  END IF;

  -- Los botones conservan correlación fuerte por nonce+sender. A puede llegar
  -- después de preparar B y debe mantener su identidad remota independiente.
  bound := public.bind_whatsapp_delivery_from_button(
    'wamid.attempt-A','+34612345678','approve:'||fixture.task_id||':attempt1'
  );
  IF bound IS DISTINCT FROM target_delivery_id THEN RAISE EXCEPTION 'callback_A_not_correlated'; END IF;

  -- Status B se adelanta al finalize: persiste pending/unmatched. Otro callback
  -- ajeno con el mismo teléfono tampoco puede apropiarse de la delivery.
  INSERT INTO public.whatsapp_webhook_inbox(
    callback_key,callback_kind,provider_message_id,sender,delivery_status,occurred_at
  ) VALUES (
    'status-before-finalize-'||event_id,'status','wamid.attempt-B','34612345678','delivered',now()
  ) RETURNING id INTO status_callback_id;
  INSERT INTO public.whatsapp_webhook_inbox(
    callback_key,callback_kind,provider_message_id,sender,delivery_status,occurred_at
  ) VALUES (
    'status-alien-same-phone-'||event_id,'status','wamid.alien','34612345678','read',now()
  ) RETURNING id INTO alien_callback_id;

  IF public.bind_whatsapp_delivery_from_status('wamid.attempt-B','34612345678',now()) IS NOT NULL
     OR public.bind_whatsapp_delivery_from_status('wamid.alien','34612345678',now()) IS NOT NULL THEN
    RAISE EXCEPTION 'unknown_status_bound_by_phone';
  END IF;
  SELECT * INTO transition FROM public.apply_whatsapp_delivery_status(
    'wamid.attempt-B','delivered',now(),NULL
  );
  IF FOUND THEN RAISE EXCEPTION 'early_status_applied_without_provider_identity'; END IF;

  final_status := public.finalize_whatsapp_send_attempt(
    claim_b.attempt_id,token_b,'wamid.attempt-B','{}',now()
  );
  IF final_status <> 'delivered' THEN RAISE EXCEPTION 'early_status_not_replayed_by_finalize: %', final_status; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.whatsapp_webhook_inbox
    WHERE id=status_callback_id AND processing_status='processed' AND outcome='delivered'
  ) THEN RAISE EXCEPTION 'legitimate_early_status_not_reconciled'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.whatsapp_webhook_inbox
    WHERE id=alien_callback_id AND processing_status='pending'
  ) THEN RAISE EXCEPTION 'alien_same_phone_callback_was_consumed'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.notification_delivery_attempts
    WHERE delivery_id=target_delivery_id AND provider_message_id='wamid.alien'
  ) THEN RAISE EXCEPTION 'alien_provider_id_was_owned'; END IF;
  IF (SELECT count(DISTINCT provider_message_id) FROM public.notification_delivery_attempts
      WHERE delivery_id=target_delivery_id) <> 2 THEN
    RAISE EXCEPTION 'provider_ids_A_B_not_preserved';
  END IF;

  -- Tras persistir B, un status tardío del intento A sigue siendo evidencia del
  -- mismo delivery lógico gracias al historial one-to-many; no se pierde por el
  -- provider_message_id mutable del parent.
  IF public.bind_whatsapp_delivery_from_status('wamid.attempt-A','34612345678',now())
       IS DISTINCT FROM target_delivery_id THEN
    RAISE EXCEPTION 'late_status_A_not_bound_from_attempt_history';
  END IF;
  SELECT * INTO transition FROM public.apply_whatsapp_delivery_status(
    'wamid.attempt-A','read',now()+interval '1 second',NULL
  );
  IF NOT FOUND OR transition.effective_status <> 'read' THEN
    RAISE EXCEPTION 'late_status_A_not_applied_from_attempt_history';
  END IF;

  IF (SELECT count(*) FROM public.notification_delivery_attempts WHERE delivery_id=target_delivery_id) <> 2 THEN
    RAISE EXCEPTION 'attempt_budget_exceeded';
  END IF;
END
$test$;

DO $test$
BEGIN
  IF has_table_privilege('authenticated','public.notification_delivery_attempts','SELECT')
     OR has_function_privilege('authenticated','public.begin_whatsapp_send_attempt(uuid,uuid,uuid,uuid,jsonb)','EXECUTE')
     OR has_function_privilege('authenticated','public.claim_bounded_whatsapp_retry(uuid,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'attempt_audit_privilege_leak';
  END IF;
END
$test$;

SELECT 'whatsapp-meta-attempt-history-db-tests: OK' AS result;
ROLLBACK;
