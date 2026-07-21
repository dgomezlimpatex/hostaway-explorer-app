\if :pre_migration
INSERT INTO public.notification_events(
 id,event_type,entity_type,entity_id,task_id,cleaner_id,sede_id,payload,dedupe_key,
 status,processed_at,processing_lease_token
) VALUES
(
 '50000000-0000-0000-0000-000000000010','task_assigned','tasks',
 '20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
 '10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',
 '{}','legacy-contacting-before-15200','processing',now()-interval '16 minutes',
 '60000000-0000-0000-0000-000000000010'
),
(
 '50000000-0000-0000-0000-000000000011','task_assigned','tasks',
 '20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
 '10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',
 '{}','legacy-known-before-15200','sent',now()-interval '12 minutes',
 '60000000-0000-0000-0000-000000000011'
);
INSERT INTO public.notification_deliveries(
 id,notification_event_id,channel,provider,recipient,template_name,status,
 provider_payload,provider_message_id,sent_at,error_code,error_message
) VALUES
(
 '70000000-0000-0000-0000-000000000010','50000000-0000-0000-0000-000000000010',
 'whatsapp','meta_cloud_api','+346****5678','task_assigned_approval_es','queued',
 jsonb_build_object(
   'meta_attempt_count',1,'meta_attempt_state','contacting_meta',
   'send_started_at',now()-interval '16 minutes',
   'first_send_started_at',now()-interval '16 minutes',
   'send_lease_token','60000000-0000-0000-0000-000000000010',
   'buttonPayloads',jsonb_build_array('approve:20000000-0000-0000-0000-000000000001:legacy')
 ),NULL,NULL,'reconciliation_required','Legacy Meta in-flight antes de 15200'
),
(
 '70000000-0000-0000-0000-000000000011','50000000-0000-0000-0000-000000000011',
 'whatsapp','meta_cloud_api','+346****5678','task_assigned_approval_es','sent',
 jsonb_build_object(
   'meta_attempt_count',1,'meta_attempt_state','retry_authorized',
   'send_started_at',now()-interval '12 minutes',
   'first_send_started_at',now()-interval '20 minutes',
   'send_lease_token','60000000-0000-0000-0000-000000000011',
   'retry_risk_policy','prioritize_delivery'
 ),'wamid.legacy-known',now()-interval '11 minutes',NULL,NULL
);
\else
INSERT INTO public.notification_events(
 id,event_type,entity_type,entity_id,task_id,cleaner_id,sede_id,payload,dedupe_key,
 status,processed_at,processing_lease_token
) VALUES (
 '50000000-0000-0000-0000-000000000001','task_assigned','tasks',
 '20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
 '10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',
 '{}','concurrent-crash-recovery','processing',now(),'60000000-0000-0000-0000-000000000001'
);
INSERT INTO public.notification_deliveries(
 id,notification_event_id,channel,provider,recipient,template_name,status,provider_payload
) VALUES (
 '70000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001',
 'whatsapp','meta_cloud_api','+34612345678','task_assigned_approval_es','queued','{}'
);
SELECT claimed FROM public.begin_whatsapp_send_attempt(
 '70000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001',
 '60000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000001','{}'
);
UPDATE public.notification_events SET processed_at=now()-interval '16 minutes'
WHERE id='50000000-0000-0000-0000-000000000001';
UPDATE public.notification_deliveries SET provider_payload=provider_payload||jsonb_build_object(
 'send_started_at',now()-interval '16 minutes','first_send_started_at',now()-interval '16 minutes',
 'meta_attempt_count',1,'meta_attempt_state','contacting_meta','send_lease_token','60000000-0000-0000-0000-000000000001'
) WHERE id='70000000-0000-0000-0000-000000000001';
UPDATE public.notification_delivery_attempts SET started_at=now()-interval '16 minutes'
WHERE delivery_id='70000000-0000-0000-0000-000000000001';

INSERT INTO public.notification_events(
 id,event_type,entity_type,entity_id,task_id,cleaner_id,sede_id,payload,dedupe_key,
 status,processed_at,processing_lease_token
) VALUES (
 '50000000-0000-0000-0000-000000000020','task_assigned','tasks',
 '20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
 '10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',
 '{}','uncertain-vs-status-race','processing',now(),'60000000-0000-0000-0000-000000000020'
);
INSERT INTO public.notification_deliveries(
 id,notification_event_id,channel,provider,recipient,template_name,status,provider_payload,provider_message_id
) VALUES (
 '70000000-0000-0000-0000-000000000020','50000000-0000-0000-0000-000000000020',
 'whatsapp','meta_cloud_api','+346****5678','task_assigned_approval_es','queued',
 jsonb_build_object('meta_attempt_count',1,'meta_attempt_state','contacting_meta',
   'send_started_at',now(),'send_lease_token','60000000-0000-0000-0000-000000000020'),
 'wamid.race-provisional'
);
INSERT INTO public.notification_delivery_attempts(
 id,delivery_id,attempt_no,claim_token,event_lease_token,state,provider_message_id,correlation_source
) VALUES (
 '80000000-0000-0000-0000-000000000020','70000000-0000-0000-0000-000000000020',1,
 '90000000-0000-0000-0000-000000000020','60000000-0000-0000-0000-000000000020',
 'contacting_meta','wamid.race-provisional','button_callback'
);

CREATE OR REPLACE FUNCTION public.hermes_pause_uncertain_attempt_update()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF pg_catalog.current_setting('hermes.pause_uncertain_attempt', true) = 'on'
     AND OLD.id = '80000000-0000-0000-0000-000000000020'::uuid THEN
    PERFORM pg_catalog.pg_sleep(1.5);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER hermes_pause_uncertain_attempt_update
BEFORE UPDATE ON public.notification_delivery_attempts
FOR EACH ROW EXECUTE FUNCTION public.hermes_pause_uncertain_attempt_update();
\endif
