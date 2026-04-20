
-- 1. Crear tabla de log de alertas para deduplicación
CREATE TABLE IF NOT EXISTS public.avantio_alert_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  accommodation_id TEXT,
  reference_date DATE NOT NULL,
  reservation_id TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  email_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Índice único: solo 1 alerta por (tipo + propiedad + fecha)
CREATE UNIQUE INDEX IF NOT EXISTS avantio_alert_log_dedup_idx 
  ON public.avantio_alert_log (alert_type, property_id, reference_date);

CREATE INDEX IF NOT EXISTS avantio_alert_log_sent_at_idx 
  ON public.avantio_alert_log (sent_at DESC);

ALTER TABLE public.avantio_alert_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/manager can view alert log"
  ON public.avantio_alert_log FOR SELECT
  USING (public.user_is_admin_or_manager());

CREATE POLICY "Service role can insert alert log"
  ON public.avantio_alert_log FOR INSERT
  WITH CHECK (true);

-- 2. Limpiar las reservas REQUESTED basura de Prioral (LAG3) para hoy/mañana
UPDATE public.avantio_reservations
SET status = 'cancelled',
    cancellation_date = COALESCE(cancellation_date, NOW()),
    updated_at = NOW()
WHERE accommodation_id = '678845'
  AND arrival_date = '2026-04-19'
  AND departure_date = '2026-04-20'
  AND status = 'REQUESTED'
  AND task_id IS NULL;
