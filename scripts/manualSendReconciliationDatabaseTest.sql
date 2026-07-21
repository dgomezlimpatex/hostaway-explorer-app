-- Ejecutar dentro de una transacción después de aplicar las migraciones WhatsApp.
DO $probe$
DECLARE
  admin_id uuid;
  non_admin_id uuid;
  task_row record;
  wa_event uuid := gen_random_uuid(); wa_delivery uuid := gen_random_uuid();
  sent_event uuid := gen_random_uuid(); sent_delivery uuid := gen_random_uuid();
  email_event uuid := gen_random_uuid(); failed_wa uuid := gen_random_uuid(); email_delivery uuid := gen_random_uuid();
  action_uuid uuid; applied record; claim_row record;
  stale_token uuid; current_token uuid;
  callback_uuid uuid := gen_random_uuid();
  stale_callback_token uuid; current_callback_token uuid;
  late_event uuid := gen_random_uuid(); late_delivery uuid := gen_random_uuid();
  late_send_token uuid := gen_random_uuid(); late_result record;
  expired_resend_event uuid := gen_random_uuid(); expired_resend_delivery uuid := gen_random_uuid();
  fallback_claim record;
  retry_event uuid := gen_random_uuid(); retry_delivery uuid := gen_random_uuid();
  retry_token uuid := gen_random_uuid(); recovered_retry_token uuid := gen_random_uuid();
  retry_claimed uuid; retry_prepared record; stale_retry_prepared record; retry_uncertain record;
  callback_race_event uuid := gen_random_uuid(); callback_race_delivery uuid := gen_random_uuid();
  callback_race_token uuid := gen_random_uuid(); callback_race_bound uuid;
  callback_race_old_payload text; callback_race_new_payload text; callback_race_prepared record;
BEGIN
  SELECT ur.user_id INTO admin_id FROM public.user_roles ur WHERE ur.role::text = 'admin' LIMIT 1;
  SELECT ur.user_id INTO non_admin_id FROM public.user_roles ur WHERE ur.role::text <> 'admin' LIMIT 1;
  IF admin_id IS NULL THEN RAISE EXCEPTION 'admin_fixture_missing'; END IF;
  IF has_table_privilege('authenticated', 'public.notification_send_reconciliation_actions', 'SELECT')
     OR has_table_privilege('authenticated', 'public.notification_send_reconciliation_actions', 'INSERT') THEN
    RAISE EXCEPTION 'authenticated_action_table_privilege_leak';
  END IF;
  IF has_function_privilege('authenticated', 'public.claim_notification_send_reconciliation_actions(integer)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.apply_notification_send_reconciliation_action(uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.validate_notification_send_reconciliation_effect(uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.finalize_whatsapp_non_delivery_result(uuid,uuid,text,jsonb,text,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.claim_bounded_whatsapp_retry(uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.get_bounded_whatsapp_retry_event_ids(integer)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.finish_notification_send_reconciliation_action(uuid,uuid,boolean,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated_internal_rpc_privilege_leak';
  END IF;
  IF non_admin_id IS NOT NULL THEN
    PERFORM set_config('request.jwt.claim.sub', non_admin_id::text, true);
    BEGIN
      PERFORM public.get_notification_send_reconciliation_queue(1);
      RAISE EXCEPTION 'non_admin_queue_access_allowed';
    EXCEPTION WHEN insufficient_privilege THEN
      NULL;
    END;
  END IF;
  SELECT task.id, task.cleaner_id, task.sede_id INTO task_row FROM public.tasks task WHERE task.cleaner_id IS NOT NULL LIMIT 1;
  IF task_row.id IS NULL THEN RAISE EXCEPTION 'task_fixture_missing'; END IF;
  callback_race_old_payload := 'approve:' || task_row.id || ':first001';
  callback_race_new_payload := 'approve:' || task_row.id || ':second02';
  PERFORM set_config('request.jwt.claim.sub', admin_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  INSERT INTO public.whatsapp_webhook_inbox (
    id, callback_key, callback_kind, provider_message_id, occurred_at, processing_status
  ) VALUES (
    callback_uuid, 'hermes-callback-aba-' || callback_uuid, 'status',
    'wamid.callback-aba-probe', now(), 'pending'
  );
  SELECT claimed.callback_claim_token INTO stale_callback_token
  FROM public.claim_whatsapp_webhook_callbacks(20) claimed
  WHERE claimed.id = callback_uuid;
  UPDATE public.whatsapp_webhook_inbox SET claimed_at = now() - interval '11 minutes'
  WHERE id = callback_uuid;
  SELECT claimed.callback_claim_token INTO current_callback_token
  FROM public.claim_whatsapp_webhook_callbacks(20) claimed
  WHERE claimed.id = callback_uuid;
  IF stale_callback_token IS NULL OR current_callback_token IS NULL
     OR stale_callback_token = current_callback_token THEN
    RAISE EXCEPTION 'callback_claim_generation_not_rotated';
  END IF;
  PERFORM public.mark_whatsapp_webhook_callback(
    callback_uuid, 'retry_failed', false, 'stale', stale_callback_token
  );
  IF NOT EXISTS (
    SELECT 1 FROM public.whatsapp_webhook_inbox inbox
    WHERE inbox.id = callback_uuid
      AND inbox.processing_status = 'processing'
      AND inbox.callback_claim_token = current_callback_token
  ) THEN RAISE EXCEPTION 'stale_callback_worker_degraded_current_claim'; END IF;
  PERFORM public.mark_whatsapp_webhook_callback(
    callback_uuid, 'sent', true, NULL, current_callback_token
  );
  IF NOT EXISTS (
    SELECT 1 FROM public.whatsapp_webhook_inbox inbox
    WHERE inbox.id = callback_uuid
      AND inbox.processing_status = 'processed'
      AND inbox.callback_claim_token IS NULL
  ) THEN RAISE EXCEPTION 'current_callback_worker_could_not_finish'; END IF;

  -- Reproduce el interleaving auditado: el POST síncrono sigue esperando,
  -- una conciliación administrativa confirma sent y la respuesta tardía sin ID
  -- intenta cerrar failed. Debe observar sent sin degradarlo.
  INSERT INTO public.notification_events(
    id,event_type,entity_type,entity_id,task_id,cleaner_id,sede_id,payload,dedupe_key,status,processed_at
  ) VALUES (
    late_event,'task_assigned','tasks',task_row.id,task_row.id,task_row.cleaner_id,
    task_row.sede_id,'{}','hermes-late-meta-'||late_event,'processing',now()
  );
  INSERT INTO public.notification_deliveries(
    id,notification_event_id,channel,provider,recipient,template_name,status,provider_payload
  ) VALUES (
    late_delivery,late_event,'whatsapp','meta_cloud_api','+340****0099','task_assigned_approval_es','queued',
    jsonb_build_object(
      'send_started_at',now(),
      'meta_attempt_state','contacting_meta',
      'send_lease_token',late_send_token
    )
  );
  UPDATE public.notification_deliveries
  SET status='sent', provider_message_id='wamid.admin-won-race', sent_at=now()
  WHERE id=late_delivery;
  SELECT * INTO late_result FROM public.finalize_whatsapp_non_delivery_result(
    late_delivery,late_send_token,'failed','{}'::jsonb,'provider_rejected','late worker'
  );
  IF late_result.effective_status <> 'sent'
     OR late_result.provider_message_id <> 'wamid.admin-won-race'
     OR NOT EXISTS (
       SELECT 1 FROM public.notification_deliveries delivery
       WHERE delivery.id=late_delivery
         AND delivery.status='sent'
         AND delivery.provider_message_id='wamid.admin-won-race'
     ) THEN
    RAISE EXCEPTION 'late_non_delivery_result_degraded_sent';
  END IF;

  INSERT INTO public.notification_events(id,event_type,entity_type,entity_id,task_id,cleaner_id,sede_id,payload,dedupe_key,status,processed_at) VALUES(wa_event,'task_assigned','tasks',task_row.id,task_row.id,task_row.cleaner_id,task_row.sede_id,'{}','hermes-manual-wa-'||wa_event,'processing',now());
  INSERT INTO public.notification_deliveries(id,notification_event_id,channel,provider,recipient,template_name,status,provider_payload,error_code,error_message) VALUES(wa_delivery,wa_event,'whatsapp','meta_cloud_api','+340****0000','task_assigned_approval_es','queued',jsonb_build_object('send_started_at',now(),'meta_attempt_state','contacting_meta','send_lease_token',gen_random_uuid()),'reconciliation_required','uncertain');
  BEGIN
    PERFORM public.request_notification_send_reconciliation(wa_delivery,'confirmed_not_sent',NULL);
    RAISE EXCEPTION 'meta_inflight_reopen_allowed';
  EXCEPTION WHEN invalid_parameter_value THEN
    NULL;
  END;
  UPDATE public.notification_deliveries
  SET provider_payload = provider_payload || jsonb_build_object('meta_attempt_state','completed_uncertain','meta_attempt_completed_at',now())
  WHERE id = wa_delivery;
  BEGIN
    PERFORM public.request_notification_send_reconciliation(wa_delivery,'confirmed_not_sent',NULL);
    RAISE EXCEPTION 'completed_uncertain_meta_reopen_allowed';
  EXCEPTION WHEN invalid_parameter_value THEN
    NULL;
  END;
  IF EXISTS (
    SELECT 1 FROM public.notification_send_reconciliation_actions action
    WHERE action.delivery_id = wa_delivery AND action.resolution = 'confirmed_not_sent'
  ) THEN RAISE EXCEPTION 'whatsapp_not_sent_action_persisted'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.notification_deliveries d
    WHERE d.id=wa_delivery AND d.status='queued'
      AND d.provider_payload->>'meta_attempt_state'='completed_uncertain'
      AND d.provider_payload ? 'send_started_at'
      AND d.error_code='reconciliation_required'
  ) THEN RAISE EXCEPTION 'whatsapp_uncertainty_was_reopened'; END IF;

  INSERT INTO public.notification_events(id,event_type,entity_type,entity_id,task_id,cleaner_id,sede_id,payload,dedupe_key,status,processed_at) VALUES(sent_event,'task_assigned','tasks',task_row.id,task_row.id,task_row.cleaner_id,task_row.sede_id,'{}','hermes-manual-sent-'||sent_event,'processing',now());
  INSERT INTO public.notification_deliveries(id,notification_event_id,channel,provider,recipient,template_name,status,provider_payload,error_code,error_message) VALUES(sent_delivery,sent_event,'whatsapp','meta_cloud_api','+34000000001','task_assigned_approval_es','queued',jsonb_build_object('send_started_at',now()),'reconciliation_required','uncertain');
  action_uuid := public.request_notification_send_reconciliation(sent_delivery,'confirmed_sent','wamid.manual-probe');
  SELECT * INTO claim_row FROM public.claim_notification_send_reconciliation_actions(20) WHERE action_id = action_uuid;
  current_token := claim_row.claim_token;
  PERFORM public.apply_notification_send_reconciliation_action(action_uuid, current_token);
  IF NOT EXISTS (SELECT 1 FROM public.notification_deliveries d WHERE d.id=sent_delivery AND d.status='sent' AND d.provider_message_id='wamid.manual-probe') THEN RAISE EXCEPTION 'confirmed_sent_not_applied'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.notification_events e WHERE e.id=sent_event AND e.status='sent') THEN RAISE EXCEPTION 'confirmed_sent_event_not_applied'; END IF;
  PERFORM public.finish_notification_send_reconciliation_action(action_uuid,current_token,true,'probe');

  INSERT INTO public.notification_events(id,event_type,entity_type,entity_id,task_id,cleaner_id,sede_id,payload,dedupe_key,status,processed_at) VALUES(email_event,'task_rejected_alert','tasks',task_row.id,task_row.id,task_row.cleaner_id,task_row.sede_id,'{}','hermes-manual-email-'||email_event,'failed',now());
  INSERT INTO public.notification_deliveries(id,notification_event_id,channel,provider,recipient,template_name,status,error_code,error_message,failed_at) VALUES(failed_wa,email_event,'whatsapp','meta_cloud_api','+34000000002','task_rejected_admin_alert_es','failed','provider_failed','failed',now());
  INSERT INTO public.notification_deliveries(id,notification_event_id,channel,provider,recipient,template_name,status,provider_response,error_code,error_message) VALUES(email_delivery,email_event,'email','resend','ops@example.invalid','task_rejected_admin_fallback_email','queued',jsonb_build_object('fallback_send_started_at',now()-interval '25 hours','fallback_attempt_state','reconciliation_required'),'reconciliation_required','uncertain');
  BEGIN
    PERFORM public.request_notification_send_reconciliation(email_delivery,'confirmed_not_sent',NULL);
    RAISE EXCEPTION 'expired_resend_window_reopen_allowed';
  EXCEPTION WHEN invalid_parameter_value THEN
    NULL;
  END;
  UPDATE public.notification_deliveries
  SET provider_response = provider_response || jsonb_build_object('fallback_send_started_at',now()-interval '22 hours')
  WHERE id = email_delivery;
  action_uuid := public.request_notification_send_reconciliation(email_delivery,'confirmed_not_sent',NULL);
  SELECT * INTO claim_row FROM public.claim_notification_send_reconciliation_actions(20) WHERE action_id = action_uuid;
  stale_token := claim_row.claim_token;
  UPDATE public.notification_send_reconciliation_actions
  SET processing_started_at = now() - interval '11 minutes'
  WHERE id = action_uuid;
  SELECT * INTO claim_row FROM public.claim_notification_send_reconciliation_actions(20) WHERE action_id = action_uuid;
  current_token := claim_row.claim_token;
  IF stale_token = current_token THEN RAISE EXCEPTION 'claim_generation_not_rotated'; END IF;
  BEGIN
    PERFORM public.apply_notification_send_reconciliation_action(action_uuid, stale_token);
    RAISE EXCEPTION 'stale_apply_allowed';
  EXCEPTION WHEN invalid_parameter_value THEN
    NULL;
  END;
  SELECT * INTO applied FROM public.apply_notification_send_reconciliation_action(action_uuid, current_token);
  IF NOT applied.force_email_fallback OR applied.fallback_whatsapp_delivery_id <> failed_wa THEN RAISE EXCEPTION 'email_retry_contract_failed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.notification_deliveries d WHERE d.id=email_delivery AND d.status='failed' AND d.error_code='manual_confirmed_not_sent') THEN RAISE EXCEPTION 'email_not_reopened'; END IF;
  UPDATE public.notification_deliveries
  SET provider_response = provider_response || jsonb_build_object('fallback_send_started_at',now()-interval '24 hours')
  WHERE id = email_delivery;
  UPDATE public.notification_send_reconciliation_actions
  SET effect_started_at = now(), processing_started_at = now()
  WHERE id = action_uuid;
  PERFORM public.claim_notification_send_reconciliation_actions(20);
  IF NOT EXISTS (
    SELECT 1 FROM public.notification_send_reconciliation_actions action
    WHERE action.id = action_uuid AND action.status = 'effect_pending' AND action.claim_token = current_token
  ) THEN RAISE EXCEPTION 'active_effect_expired_at_boundary'; END IF;
  IF public.validate_notification_send_reconciliation_effect(action_uuid,current_token) THEN
    RAISE EXCEPTION 'expired_effect_validated';
  END IF;
  UPDATE public.notification_deliveries
  SET provider_response = provider_response || jsonb_build_object('fallback_send_started_at',now()-interval '22 hours')
  WHERE id = email_delivery;
  UPDATE public.notification_send_reconciliation_actions
  SET effect_started_at = now(), processing_started_at = now()
  WHERE id = action_uuid;
  IF NOT public.validate_notification_send_reconciliation_effect(action_uuid,current_token) THEN
    RAISE EXCEPTION 'current_effect_not_validated';
  END IF;
  IF public.finish_notification_send_reconciliation_action(action_uuid,stale_token,false,'stale-worker') THEN
    RAISE EXCEPTION 'stale_finish_allowed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.notification_send_reconciliation_actions action
    WHERE action.id = action_uuid AND action.status = 'effect_pending' AND action.claim_token = current_token
  ) THEN RAISE EXCEPTION 'stale_finish_degraded_effect_pending'; END IF;
  IF NOT public.finish_notification_send_reconciliation_action(action_uuid,current_token,true,'probe') THEN
    RAISE EXCEPTION 'current_finish_failed';
  END IF;

  -- Una respuesta Resend que ya inició el POST nunca puede reabrirse fuera de
  -- la vigencia de su clave idempotente. Dentro de 23 horas sí reutiliza la
  -- misma fila y la misma clave, siempre bajo un claim generacional nuevo.
  INSERT INTO public.notification_events(
    id,event_type,entity_type,entity_id,task_id,cleaner_id,sede_id,payload,dedupe_key,status,processed_at
  ) VALUES (
    expired_resend_event,'task_rejected_alert','tasks',task_row.id,task_row.id,
    task_row.cleaner_id,task_row.sede_id,'{}','hermes-expired-resend-'||expired_resend_event,'failed',now()
  );
  INSERT INTO public.notification_deliveries(
    id,notification_event_id,channel,provider,recipient,template_name,status,provider_response,error_code,error_message,failed_at
  ) VALUES (
    expired_resend_delivery,expired_resend_event,'email','resend','ops@example.invalid',
    'task_rejected_admin_fallback_email','failed',
    jsonb_build_object('fallback_send_started_at',now()-interval '25 hours','fallback_attempt_state','failed'),
    'resend_error','deterministic_or_missing_id',now()
  );
  SELECT * INTO fallback_claim
  FROM public.claim_whatsapp_admin_fallback(expired_resend_event,'ops@example.invalid','probe');
  IF fallback_claim.claimed OR fallback_claim.claim_token IS NOT NULL THEN
    RAISE EXCEPTION 'expired_resend_failed_delivery_reclaimed';
  END IF;
  UPDATE public.notification_deliveries
  SET provider_response = provider_response || jsonb_build_object('fallback_send_started_at',now()-interval '22 hours')
  WHERE id = expired_resend_delivery;
  SELECT * INTO fallback_claim
  FROM public.claim_whatsapp_admin_fallback(expired_resend_event,'ops@example.invalid','probe');
  IF NOT fallback_claim.claimed OR fallback_claim.claim_token IS NULL
     OR fallback_claim.delivery_id <> expired_resend_delivery THEN
    RAISE EXCEPTION 'valid_resend_failed_delivery_not_reclaimed';
  END IF;

  -- Carrera callback vs retry: prepare 2/2 no puede sustituir el correlador del
  -- intento 1. Un botón firmado que llegue antes de begin debe ganar y bloquearlo.
  INSERT INTO public.notification_events(
    id,event_type,entity_type,entity_id,task_id,cleaner_id,sede_id,payload,dedupe_key,status,processed_at
  ) VALUES (
    callback_race_event,'task_assigned','tasks',task_row.id,task_row.id,task_row.cleaner_id,
    task_row.sede_id,'{}','hermes-callback-race-'||callback_race_event,'failed',now()
  );
  INSERT INTO public.notification_deliveries(
    id,notification_event_id,channel,provider,recipient,template_name,status,
    provider_payload,error_code,error_message
  ) VALUES (
    callback_race_delivery,callback_race_event,'whatsapp','meta_cloud_api','+340****0011',
    'task_assigned_approval_es','queued',
    jsonb_build_object(
      'buttonPayloads',jsonb_build_array(callback_race_old_payload),
      'send_started_at',now()-interval '16 minutes',
      'first_send_started_at',now()-interval '16 minutes',
      'meta_attempt_count',1,
      'meta_attempt_state','completed_uncertain'
    ),'reconciliation_required','uncertain'
  );
  IF public.claim_bounded_whatsapp_retry(callback_race_event,callback_race_token)
     IS DISTINCT FROM callback_race_delivery THEN
    RAISE EXCEPTION 'callback_race_retry_not_claimed';
  END IF;
  SELECT * INTO callback_race_prepared FROM public.prepare_whatsapp_send_delivery(
    callback_race_event,callback_race_token,'+340****0011','task_assigned_approval_es',
    jsonb_build_object('buttonPayloads',jsonb_build_array(callback_race_new_payload))
  );
  IF NOT callback_race_prepared.ready_to_send THEN
    RAISE EXCEPTION 'callback_race_retry_not_prepared';
  END IF;
  callback_race_bound := public.bind_whatsapp_delivery_from_button(
    'wamid.callback-before-retry', '+3400011', callback_race_old_payload
  );
  IF callback_race_bound IS DISTINCT FROM callback_race_delivery THEN
    RAISE EXCEPTION 'first_attempt_payload_lost_before_retry_begin';
  END IF;
  IF public.begin_whatsapp_send_delivery(
    callback_race_delivery,callback_race_event,callback_race_token,
    jsonb_build_object('buttonPayloads',jsonb_build_array(callback_race_new_payload))
  ) THEN RAISE EXCEPTION 'retry_started_after_signed_callback'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.notification_deliveries delivery
    JOIN public.notification_events event ON event.id = delivery.notification_event_id
    WHERE delivery.id = callback_race_delivery
      AND delivery.status = 'sent'
      AND delivery.provider_message_id = 'wamid.callback-before-retry'
      AND (delivery.provider_payload->>'meta_attempt_count')::integer = 1
      AND event.status = 'sent'
  ) THEN RAISE EXCEPTION 'callback_race_not_terminal_sent'; END IF;

  -- Política priorizar entrega: un solo segundo POST tras 15 minutos.
  INSERT INTO public.notification_events(
    id,event_type,entity_type,entity_id,task_id,cleaner_id,sede_id,payload,dedupe_key,status,processed_at
  ) VALUES (
    retry_event,'task_assigned','tasks',task_row.id,task_row.id,task_row.cleaner_id,
    task_row.sede_id,'{}','hermes-bounded-retry-'||retry_event,'failed',now()
  );
  INSERT INTO public.notification_deliveries(
    id,notification_event_id,channel,provider,recipient,template_name,status,
    provider_payload,error_code,error_message
  ) VALUES (
    retry_delivery,retry_event,'whatsapp','meta_cloud_api','+340****0010',
    'task_assigned_approval_es','queued',
    jsonb_build_object(
      'send_started_at',now()-interval '16 minutes',
      'first_send_started_at',now()-interval '16 minutes',
      'meta_attempt_count',1,
      'meta_attempt_state','completed_uncertain'
    ),'reconciliation_required','uncertain'
  );
  IF NOT EXISTS (
    SELECT 1 FROM public.get_bounded_whatsapp_retry_event_ids(100) candidate
    WHERE candidate.event_id = retry_event
  ) THEN RAISE EXCEPTION 'bounded_retry_candidate_missing'; END IF;
  retry_claimed := public.claim_bounded_whatsapp_retry(retry_event,retry_token);
  IF retry_claimed IS DISTINCT FROM retry_delivery THEN
    RAISE EXCEPTION 'bounded_retry_not_claimed';
  END IF;

  -- Simula crash exacto después del claim y antes de begin. La autorización
  -- durable 1/2 debe poder rotar de generación una sola vez tras expirar.
  UPDATE public.notification_events
  SET processed_at = now() - interval '16 minutes'
  WHERE id = retry_event;
  IF NOT EXISTS (
    SELECT 1 FROM public.get_bounded_whatsapp_retry_event_ids(100) candidate
    WHERE candidate.event_id = retry_event
  ) THEN RAISE EXCEPTION 'claimed_retry_not_recoverable'; END IF;
  retry_claimed := public.claim_bounded_whatsapp_retry(retry_event,recovered_retry_token);
  IF retry_claimed IS DISTINCT FROM retry_delivery THEN
    RAISE EXCEPTION 'claimed_retry_generation_not_rotated';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.notification_events event
    WHERE event.id = retry_event
      AND event.processing_lease_token = retry_token
  ) OR NOT EXISTS (
    SELECT 1 FROM public.notification_events event
    WHERE event.id = retry_event
      AND event.processing_lease_token = recovered_retry_token
  ) THEN RAISE EXCEPTION 'claimed_retry_stale_lease_survived'; END IF;

  SELECT * INTO stale_retry_prepared FROM public.prepare_whatsapp_send_delivery(
    retry_event,retry_token,'+340****0010','task_assigned_approval_es','{}'::jsonb
  );
  IF stale_retry_prepared.ready_to_send
     OR stale_retry_prepared.effective_status <> 'stale_lease' THEN
    RAISE EXCEPTION 'stale_retry_generation_prepared';
  END IF;
  IF public.begin_whatsapp_send_delivery(
    retry_delivery,retry_event,retry_token,'{}'::jsonb
  ) THEN RAISE EXCEPTION 'stale_retry_generation_started'; END IF;

  SELECT * INTO retry_prepared FROM public.prepare_whatsapp_send_delivery(
    retry_event,recovered_retry_token,'+340****0010','task_assigned_approval_es','{}'::jsonb
  );
  IF NOT retry_prepared.ready_to_send OR retry_prepared.effective_status <> 'retry_authorized' THEN
    RAISE EXCEPTION 'bounded_retry_not_prepared';
  END IF;
  IF NOT public.begin_whatsapp_send_delivery(
    retry_delivery,retry_event,recovered_retry_token,'{}'::jsonb
  ) THEN RAISE EXCEPTION 'bounded_retry_not_started'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.notification_deliveries delivery
    WHERE delivery.id = retry_delivery
      AND (delivery.provider_payload->>'meta_attempt_count')::integer = 2
      AND delivery.provider_payload->>'meta_attempt_state' = 'contacting_meta'
      AND delivery.provider_payload->>'retry_risk_policy' = 'prioritize_delivery'
  ) THEN RAISE EXCEPTION 'bounded_retry_attempt_not_auditable'; END IF;

  -- Simula crash después de begin y antes de recibir la respuesta de Meta. Al
  -- expirar el lease, otro worker debe cerrar el 2/2 sin necesitar el token viejo.
  UPDATE public.notification_events
  SET processed_at = now() - interval '11 minutes'
  WHERE id = retry_event;

  -- El resultado incierto del POST 2/2 conserva la delivery para conciliación,
  -- pero el evento debe quedar terminal y dejar de ser candidato del cron.
  SELECT * INTO retry_uncertain FROM public.finalize_uncertain_whatsapp_send_delivery(
    retry_delivery,NULL,'{}'::jsonb,
    'Intento WhatsApp 2/2 incierto; reintentos automáticos agotados'
  );
  IF NOT retry_uncertain.reconciliation_required THEN
    RAISE EXCEPTION 'second_uncertain_not_visible';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.notification_events event
    WHERE event.id = retry_event
      AND event.status = 'failed'
      AND event.processing_lease_token IS NULL
      AND event.error_message ILIKE '%2/2%agotad%'
  ) THEN RAISE EXCEPTION 'second_uncertain_event_not_terminal'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.notification_deliveries delivery
    WHERE delivery.id = retry_delivery
      AND delivery.status = 'queued'
      AND delivery.error_code = 'reconciliation_required'
      AND delivery.provider_payload->>'meta_attempt_state' = 'completed_uncertain'
      AND (delivery.provider_payload->>'meta_attempt_count')::integer = 2
  ) THEN RAISE EXCEPTION 'second_uncertain_delivery_not_reconcilable'; END IF;

  UPDATE public.notification_deliveries
  SET provider_payload=provider_payload || jsonb_build_object(
    'send_started_at',now()-interval '16 minutes',
    'meta_attempt_state','completed_uncertain'
  ), error_code='reconciliation_required'
  WHERE id=retry_delivery;
  IF EXISTS (
    SELECT 1 FROM public.get_bounded_whatsapp_retry_event_ids(100) candidate
    WHERE candidate.event_id = retry_event
  ) THEN RAISE EXCEPTION 'third_meta_attempt_exposed'; END IF;
  IF public.claim_bounded_whatsapp_retry(retry_event,gen_random_uuid()) IS NOT NULL THEN
    RAISE EXCEPTION 'third_meta_attempt_claimed';
  END IF;
END
$probe$;
SELECT 'MANUAL_SEND_RECONCILIATION_ROLLBACK_OK' AS result;
ROLLBACK;
