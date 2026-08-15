-- Evita reenviar repetidamente el aviso inmediato de una misma incidencia.
ALTER TABLE public.supervision_incidents
  ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notification_message_id TEXT;
