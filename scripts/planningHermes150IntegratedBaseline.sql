\set ON_ERROR_STOP on
\ir /tmp/planningBatchTestBaseline.sql

-- Relaciones productivas requeridas por 13000 que no participan en el smoke.
ALTER TABLE public.cleaners
  ADD COLUMN whatsapp_notifications_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN whatsapp_opt_in boolean NOT NULL DEFAULT true;
ALTER TABLE public.tasks
  ADD COLUMN auto_assigned boolean NOT NULL DEFAULT false,
  ADD COLUMN assignment_confidence numeric;
ALTER TABLE public.tasks DROP CONSTRAINT tasks_cleaner_id_fkey;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_cleaner_id_fkey
  FOREIGN KEY(cleaner_id) REFERENCES public.cleaners(id) ON DELETE SET NULL;
ALTER TABLE public.task_assignments DROP CONSTRAINT task_assignments_cleaner_id_fkey;
ALTER TABLE public.task_assignments ADD CONSTRAINT task_assignments_cleaner_id_fkey
  FOREIGN KEY(cleaner_id) REFERENCES public.cleaners(id) ON DELETE CASCADE;

CREATE TABLE public.properties(
  id uuid PRIMARY KEY, sede_id uuid NOT NULL REFERENCES public.sedes(id), is_active boolean NOT NULL DEFAULT true,
  nombre text NOT NULL DEFAULT 'Propiedad', direccion text NOT NULL DEFAULT '', cliente_id uuid,
  check_in_predeterminado time NOT NULL DEFAULT '15:00', check_out_predeterminado time NOT NULL DEFAULT '10:00',
  duracion_servicio integer NOT NULL DEFAULT 60, coste_servicio numeric
);
CREATE TABLE public.profiles(id uuid PRIMARY KEY, email text);
CREATE TABLE public.ai_action_proposals(
  id uuid PRIMARY KEY, owner_user_id uuid NOT NULL, owner_email text, status text NOT NULL DEFAULT 'pending',
  result jsonb, sede_id uuid, actions jsonb NOT NULL DEFAULT '[]', updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ai_action_audit_logs(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), proposal_id uuid, owner_user_id uuid, owner_email text,
  action_type text, status text, payload jsonb, result jsonb
);
CREATE OR REPLACE FUNCTION public.ai_is_allowed_user() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;
CREATE TABLE public.property_groups(
  id uuid PRIMARY KEY, is_active boolean NOT NULL DEFAULT true, auto_assign_enabled boolean NOT NULL DEFAULT true
);
CREATE TABLE public.property_group_assignments(
  property_id uuid PRIMARY KEY REFERENCES public.properties(id), property_group_id uuid NOT NULL REFERENCES public.property_groups(id)
);
CREATE TABLE public.cleaner_group_assignments(
  cleaner_id uuid NOT NULL REFERENCES public.cleaners(id), property_group_id uuid NOT NULL REFERENCES public.property_groups(id),
  priority integer NOT NULL DEFAULT 1, max_tasks_per_day integer NOT NULL DEFAULT 8,
  estimated_travel_time_minutes integer NOT NULL DEFAULT 0, is_active boolean NOT NULL DEFAULT true,
  PRIMARY KEY(cleaner_id,property_group_id)
);
CREATE TABLE public.auto_assignment_logs(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_id uuid, property_group_id uuid,
  assigned_cleaner_id uuid, algorithm_used text, assignment_reason text,
  confidence_score numeric, was_manual_override boolean
);

-- Baseline fiel del pipeline WhatsApp previo a 15100/15200.
ALTER TABLE public.notification_events
  ADD COLUMN processing_lease_token uuid;
CREATE TABLE public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_event_id uuid NOT NULL REFERENCES public.notification_events(id) ON DELETE CASCADE,
  channel text NOT NULL, provider text NOT NULL, recipient text NOT NULL, template_name text,
  status text NOT NULL, provider_payload jsonb NOT NULL DEFAULT '{}', provider_response jsonb NOT NULL DEFAULT '{}',
  provider_message_id text, sent_at timestamptz, delivered_at timestamptz, read_at timestamptz, failed_at timestamptz,
  error_code text, error_message text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX notification_deliveries_provider_id_unique
  ON public.notification_deliveries(channel,provider,provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE TABLE public.whatsapp_webhook_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), callback_key text NOT NULL UNIQUE, callback_kind text NOT NULL,
  provider_message_id text NOT NULL, whatsapp_message_id text, sender text, button_payload text, action text,
  task_id uuid, delivery_status text, occurred_at timestamptz NOT NULL, error_message text,
  processing_status text NOT NULL DEFAULT 'pending', outcome text, attempts integer NOT NULL DEFAULT 0,
  received_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz, claimed_at timestamptz,
  callback_claim_token uuid, last_error text
);
CREATE OR REPLACE FUNCTION public.finalize_uncertain_whatsapp_send_delivery(
  _delivery_id uuid,_lease_token uuid,_provider_response jsonb,_error_message text
) RETURNS TABLE(effective_status text,provider_message_id text,reconciliation_required boolean)
LANGUAGE sql AS $$ SELECT 'queued'::text,NULL::text,true $$;
CREATE OR REPLACE FUNCTION public.finalize_whatsapp_non_delivery_result(
  _delivery_id uuid,_lease_token uuid,_result_status text,_provider_response jsonb,_error_code text,_error_message text
) RETURNS TABLE(effective_status text,provider_message_id text,reconciliation_required boolean)
LANGUAGE sql AS $$ SELECT _result_status,NULL::text,false $$;
CREATE OR REPLACE FUNCTION public.apply_whatsapp_delivery_status(
  _provider_message_id text,_status text,_occurred_at timestamptz,_error_message text DEFAULT NULL
) RETURNS TABLE(delivery_id uuid,notification_event_id uuid,applied boolean,effective_status text)
LANGUAGE sql AS $$ SELECT NULL::uuid,NULL::uuid,false,NULL::text WHERE false $$;
CREATE OR REPLACE FUNCTION public.replay_whatsapp_status_callbacks(_provider_message_id text)
RETURNS TABLE(callback_id uuid,notification_event_id uuid,effective_status text)
LANGUAGE sql AS $$ SELECT NULL::uuid,NULL::uuid,NULL::text WHERE false $$;
