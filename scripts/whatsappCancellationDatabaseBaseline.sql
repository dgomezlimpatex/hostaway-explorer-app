CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.cleaners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  telefono text,
  whatsapp_phone_e164 text,
  whatsapp_notifications_enabled boolean NOT NULL DEFAULT true,
  whatsapp_opt_in boolean NOT NULL DEFAULT true
);

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id uuid REFERENCES public.cleaners(id) ON DELETE SET NULL,
  sede_id uuid NOT NULL,
  property text,
  address text,
  date date,
  start_time time,
  end_time time
);

CREATE TABLE public.task_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  cleaner_id uuid REFERENCES public.cleaners(id) ON DELETE CASCADE,
  cleaner_name text,
  assigned_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  cleaner_id uuid REFERENCES public.cleaners(id) ON DELETE SET NULL,
  sede_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  processed_at timestamptz,
  processing_lease_token uuid,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_events_status_check CHECK (status IN ('pending','processing','sent','failed','cancelled'))
);

CREATE TABLE public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_event_id uuid NOT NULL REFERENCES public.notification_events(id) ON DELETE CASCADE,
  channel text NOT NULL,
  provider text NOT NULL,
  recipient text NOT NULL,
  template_name text,
  status text NOT NULL,
  provider_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  provider_response jsonb NOT NULL DEFAULT '{}'::jsonb,
  provider_message_id text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz,
  error_code text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX notification_deliveries_provider_id_unique
ON public.notification_deliveries(channel,provider,provider_message_id)
WHERE provider_message_id IS NOT NULL;

CREATE TABLE public.whatsapp_webhook_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  callback_key text NOT NULL UNIQUE,
  callback_kind text NOT NULL,
  provider_message_id text NOT NULL,
  whatsapp_message_id text,
  sender text,
  button_payload text,
  action text,
  task_id uuid,
  delivery_status text,
  occurred_at timestamptz NOT NULL,
  error_message text,
  processing_status text NOT NULL DEFAULT 'pending',
  outcome text,
  attempts integer NOT NULL DEFAULT 0,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  claimed_at timestamptz,
  callback_claim_token uuid,
  last_error text
);

CREATE OR REPLACE FUNCTION public.enqueue_task_assignment_notification()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN COALESCE(NEW,OLD); END $$;
CREATE TRIGGER trg_task_assignments_notifications
AFTER INSERT OR DELETE ON public.task_assignments
FOR EACH ROW EXECUTE FUNCTION public.enqueue_task_assignment_notification();

CREATE OR REPLACE FUNCTION public.finalize_uncertain_whatsapp_send_delivery(
  _delivery_id uuid, _lease_token uuid, _provider_response jsonb, _error_message text
)
RETURNS TABLE(effective_status text,provider_message_id text,reconciliation_required boolean)
LANGUAGE sql AS $$ SELECT 'queued'::text,NULL::text,true $$;

CREATE OR REPLACE FUNCTION public.finalize_whatsapp_non_delivery_result(
  _delivery_id uuid, _lease_token uuid, _result_status text, _provider_response jsonb,
  _error_code text, _error_message text
)
RETURNS TABLE(effective_status text,provider_message_id text,reconciliation_required boolean)
LANGUAGE sql AS $$ SELECT _result_status,NULL::text,false $$;

CREATE OR REPLACE FUNCTION public.apply_whatsapp_delivery_status(
  _provider_message_id text, _status text, _occurred_at timestamptz, _error_message text DEFAULT NULL
)
RETURNS TABLE(delivery_id uuid,notification_event_id uuid,applied boolean,effective_status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE target public.notification_deliveries%ROWTYPE;
BEGIN
  SELECT delivery.* INTO target FROM public.notification_deliveries delivery
  WHERE delivery.channel='whatsapp' AND delivery.provider='meta_cloud_api'
    AND delivery.provider_message_id=_provider_message_id FOR UPDATE;
  IF target.id IS NULL THEN RETURN; END IF;
  UPDATE public.notification_deliveries delivery
  SET status=_status,
      sent_at=CASE WHEN _status='sent' THEN COALESCE(delivery.sent_at,_occurred_at) ELSE delivery.sent_at END,
      delivered_at=CASE WHEN _status='delivered' THEN COALESCE(delivery.delivered_at,_occurred_at) ELSE delivery.delivered_at END,
      read_at=CASE WHEN _status='read' THEN COALESCE(delivery.read_at,_occurred_at) ELSE delivery.read_at END,
      failed_at=CASE WHEN _status='failed' THEN COALESCE(delivery.failed_at,_occurred_at) ELSE delivery.failed_at END
  WHERE delivery.id=target.id;
  UPDATE public.notification_events event
  SET status=CASE WHEN _status='failed' THEN 'failed' ELSE 'sent' END, processed_at=now()
  WHERE event.id=target.notification_event_id;
  RETURN QUERY SELECT target.id,target.notification_event_id,true,_status;
END $$;

CREATE OR REPLACE FUNCTION public.replay_whatsapp_status_callbacks(_provider_message_id text)
RETURNS TABLE(callback_id uuid,notification_event_id uuid,effective_status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE pending public.whatsapp_webhook_inbox%ROWTYPE; transition record;
BEGIN
  FOR pending IN SELECT inbox.* FROM public.whatsapp_webhook_inbox inbox
    WHERE inbox.callback_kind='status' AND inbox.processing_status='pending'
      AND inbox.provider_message_id=_provider_message_id
    ORDER BY inbox.occurred_at,inbox.received_at FOR UPDATE
  LOOP
    SELECT * INTO transition FROM public.apply_whatsapp_delivery_status(
      pending.provider_message_id,pending.delivery_status,pending.occurred_at,pending.error_message
    );
    IF FOUND THEN
      UPDATE public.whatsapp_webhook_inbox inbox
      SET processing_status=CASE WHEN transition.effective_status='failed' THEN 'pending' ELSE 'processed' END,
          outcome=transition.effective_status,attempts=inbox.attempts+1,
          processed_at=CASE WHEN transition.effective_status='failed' THEN NULL ELSE now() END
      WHERE inbox.id=pending.id;
      callback_id:=pending.id;
      notification_event_id:=transition.notification_event_id;
      effective_status:=transition.effective_status;
      RETURN NEXT;
    END IF;
  END LOOP;
END $$;

INSERT INTO public.cleaners(id,name,email,telefono,whatsapp_phone_e164)
VALUES('10000000-0000-0000-0000-000000000001','Fixture Cleaner','fixture@example.invalid','612345678','+34612345678');
INSERT INTO public.tasks(id,cleaner_id,sede_id,property,address,date,start_time,end_time) VALUES
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Piso 1','Calle 1','2026-07-22','10:00','12:00'),
('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Piso 2','Calle 2','2026-07-23','11:00','13:00');
INSERT INTO public.task_assignments(id,task_id,cleaner_id,cleaner_name) VALUES
('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Fixture Cleaner'),
('40000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Fixture Cleaner');
