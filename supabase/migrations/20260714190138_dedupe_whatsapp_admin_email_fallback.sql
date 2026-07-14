-- Evita correos de respaldo duplicados ante webhooks de fallo repetidos de Meta.
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_deliveries_rejected_email_once
ON public.notification_deliveries (notification_event_id)
WHERE channel = 'email'
  AND template_name = 'task_rejected_admin_fallback_email';
