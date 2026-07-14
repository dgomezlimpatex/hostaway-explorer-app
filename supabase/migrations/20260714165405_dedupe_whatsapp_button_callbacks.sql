-- Evita que los reintentos de Meta dupliquen una respuesta de botón.
CREATE UNIQUE INDEX IF NOT EXISTS idx_task_approval_events_whatsapp_message_unique
ON public.task_approval_events (whatsapp_message_id)
WHERE whatsapp_message_id IS NOT NULL;
