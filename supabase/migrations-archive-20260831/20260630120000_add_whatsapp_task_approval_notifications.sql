-- WhatsApp Business API: aprobación de tareas + capa de notificaciones operativas.
-- PREPARACIÓN (no cambia el comportamiento actual hasta activar el feature flag).
-- Timezone operativa: Europe/Madrid. Migración idempotente.

-- ─────────────────────────────────────────────────────────────────
-- 1. Ampliar public.tasks con estado de aprobación
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS approval_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_response_source text,
  ADD COLUMN IF NOT EXISTS approval_rejection_reason text,
  ADD COLUMN IF NOT EXISTS last_approval_reminder_at timestamptz,
  ADD COLUMN IF NOT EXISTS late_start_reminder_sent_at timestamptz;

-- CHECK del dominio de approval_status (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_approval_status_check'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_approval_status_check
      CHECK (approval_status IN (
        'not_required','pending','approved','rejected','expired','auto_approved_by_admin'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tasks_approval_pending_today
ON public.tasks(date, approval_status, cleaner_id)
WHERE cleaner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_late_start_pending
ON public.tasks(date, start_time, status, cleaner_id)
WHERE cleaner_id IS NOT NULL AND status = 'pending';

-- ─────────────────────────────────────────────────────────────────
-- 2. Ampliar public.cleaners con datos de WhatsApp / opt-in
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.cleaners
  ADD COLUMN IF NOT EXISTS whatsapp_phone_e164 text,
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in_source text,
  ADD COLUMN IF NOT EXISTS whatsapp_notifications_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_last_error text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cleaners_whatsapp_phone_e164_unique
ON public.cleaners(whatsapp_phone_e164)
WHERE whatsapp_phone_e164 IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────
-- 3. notification_events: evento lógico, independiente del canal
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN (
    'task_assigned',
    'task_modified',
    'task_cancelled',
    'task_approval_reminder',
    'task_late_start_reminder',
    'task_rejected_alert',
    'task_approved_confirmation'
  )),
  entity_type text NOT NULL DEFAULT 'tasks',
  entity_id uuid NOT NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  cleaner_id uuid REFERENCES public.cleaners(id) ON DELETE SET NULL,
  sede_id uuid REFERENCES public.sedes(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','sent','failed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  error_message text
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_events_dedupe
ON public.notification_events(dedupe_key);

CREATE INDEX IF NOT EXISTS idx_notification_events_task
ON public.notification_events(task_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────
-- 4. notification_deliveries: cada intento de envío por canal
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_event_id uuid NOT NULL REFERENCES public.notification_events(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email','whatsapp')),
  provider text NOT NULL,
  provider_message_id text,
  recipient text NOT NULL,
  template_name text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN (
    'queued','sent','delivered','read','failed','undeliverable','skipped'
  )),
  provider_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  provider_response jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_code text,
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_event
ON public.notification_deliveries(notification_event_id);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_provider_message
ON public.notification_deliveries(provider_message_id);

-- ─────────────────────────────────────────────────────────────────
-- 5. task_approval_events: auditoría de aprobación/rechazo
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.task_approval_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  cleaner_id uuid REFERENCES public.cleaners(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('requested','approved','rejected','reminded','expired','admin_override')),
  source text NOT NULL CHECK (source IN ('whatsapp','admin','system','worker_app')),
  whatsapp_message_id text,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_approval_events_task
ON public.task_approval_events(task_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────
-- 6. RLS + grants + policies
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_approval_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.notification_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_events TO service_role;

GRANT SELECT ON public.notification_deliveries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_deliveries TO service_role;

GRANT SELECT, INSERT ON public.task_approval_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_approval_events TO service_role;

-- notification_events: admin/manager gestionan; supervisor lee
DROP POLICY IF EXISTS "notification_events_admin_manager_all" ON public.notification_events;
DROP POLICY IF EXISTS "notification_events_supervisor_read" ON public.notification_events;

CREATE POLICY "notification_events_admin_manager_all"
ON public.notification_events
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
);

CREATE POLICY "notification_events_supervisor_read"
ON public.notification_events
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'supervisor'));

-- notification_deliveries: admin/manager gestionan; supervisor lee
DROP POLICY IF EXISTS "notification_deliveries_admin_manager_all" ON public.notification_deliveries;
DROP POLICY IF EXISTS "notification_deliveries_supervisor_read" ON public.notification_deliveries;

CREATE POLICY "notification_deliveries_admin_manager_all"
ON public.notification_deliveries
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
);

CREATE POLICY "notification_deliveries_supervisor_read"
ON public.notification_deliveries
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'supervisor'));

-- task_approval_events: admin/manager gestionan; supervisor lee
DROP POLICY IF EXISTS "task_approval_events_admin_manager_all" ON public.task_approval_events;
DROP POLICY IF EXISTS "task_approval_events_supervisor_read" ON public.task_approval_events;

CREATE POLICY "task_approval_events_admin_manager_all"
ON public.task_approval_events
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
);

CREATE POLICY "task_approval_events_supervisor_read"
ON public.task_approval_events
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'supervisor'));
