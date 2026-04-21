-- ============================================================
-- Tabla 1: staffing_targets
-- Plantilla mínima por día de la semana
-- ============================================================
CREATE TABLE public.staffing_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sede_id UUID REFERENCES public.sedes(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  min_workers INTEGER NOT NULL DEFAULT 2 CHECK (min_workers >= 0),
  min_hours NUMERIC(5,2) NOT NULL DEFAULT 12 CHECK (min_hours >= 0),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (sede_id, day_of_week)
);

CREATE INDEX idx_staffing_targets_sede ON public.staffing_targets(sede_id);

ALTER TABLE public.staffing_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view staffing targets"
  ON public.staffing_targets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and manager can insert staffing targets"
  ON public.staffing_targets FOR INSERT
  TO authenticated
  WITH CHECK (public.user_is_admin_or_manager());

CREATE POLICY "Admin and manager can update staffing targets"
  ON public.staffing_targets FOR UPDATE
  TO authenticated
  USING (public.user_is_admin_or_manager());

CREATE POLICY "Admin and manager can delete staffing targets"
  ON public.staffing_targets FOR DELETE
  TO authenticated
  USING (public.user_is_admin_or_manager());

CREATE TRIGGER update_staffing_targets_updated_at
  BEFORE UPDATE ON public.staffing_targets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed inicial: para cada sede activa, crear targets por defecto
INSERT INTO public.staffing_targets (sede_id, day_of_week, min_workers, min_hours)
SELECT s.id, d.day_of_week,
  CASE
    WHEN d.day_of_week = 0 THEN 6   -- Domingo
    WHEN d.day_of_week = 6 THEN 4   -- Sábado
    ELSE 2
  END AS min_workers,
  CASE
    WHEN d.day_of_week = 0 THEN 36  -- Domingo
    WHEN d.day_of_week = 6 THEN 24  -- Sábado
    ELSE 12
  END AS min_hours
FROM public.sedes s
CROSS JOIN (SELECT generate_series(0, 6) AS day_of_week) d
WHERE s.is_active = true
ON CONFLICT (sede_id, day_of_week) DO NOTHING;

-- ============================================================
-- Tabla 2: forecast_alerts_log
-- Registro de alertas enviadas para evitar duplicados
-- ============================================================
CREATE TABLE public.forecast_alerts_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sede_id UUID REFERENCES public.sedes(id) ON DELETE CASCADE,
  alert_date DATE NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('red', 'yellow')),
  deficit_hours NUMERIC(6,2),
  deficit_workers INTEGER,
  recipient_email TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  dismissed_at TIMESTAMP WITH TIME ZONE,
  dismissed_by UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (alert_date, alert_type, recipient_email, sede_id)
);

CREATE INDEX idx_forecast_alerts_date ON public.forecast_alerts_log(alert_date);
CREATE INDEX idx_forecast_alerts_sede ON public.forecast_alerts_log(sede_id);

ALTER TABLE public.forecast_alerts_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and manager can view alert log"
  ON public.forecast_alerts_log FOR SELECT
  TO authenticated
  USING (public.user_is_admin_or_manager());

CREATE POLICY "Admin and manager can insert into alert log"
  ON public.forecast_alerts_log FOR INSERT
  TO authenticated
  WITH CHECK (public.user_is_admin_or_manager());

CREATE POLICY "Admin and manager can update alert log"
  ON public.forecast_alerts_log FOR UPDATE
  TO authenticated
  USING (public.user_is_admin_or_manager());

-- ============================================================
-- Tabla 3: forecast_subscribers
-- Usuarios suscritos a alertas de previsión
-- ============================================================
CREATE TABLE public.forecast_subscribers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  sede_id UUID REFERENCES public.sedes(id) ON DELETE CASCADE,
  daily_digest BOOLEAN NOT NULL DEFAULT true,
  instant_red_alerts BOOLEAN NOT NULL DEFAULT true,
  min_days_advance INTEGER NOT NULL DEFAULT 7 CHECK (min_days_advance >= 1 AND min_days_advance <= 60),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, sede_id)
);

CREATE INDEX idx_forecast_subscribers_user ON public.forecast_subscribers(user_id);
CREATE INDEX idx_forecast_subscribers_sede ON public.forecast_subscribers(sede_id);

ALTER TABLE public.forecast_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscription"
  ON public.forecast_subscribers FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.user_is_admin_or_manager());

CREATE POLICY "Users can create their own subscription"
  ON public.forecast_subscribers FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.user_is_admin_or_manager());

CREATE POLICY "Users can update their own subscription"
  ON public.forecast_subscribers FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.user_is_admin_or_manager());

CREATE POLICY "Users can delete their own subscription"
  ON public.forecast_subscribers FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.user_is_admin_or_manager());

CREATE TRIGGER update_forecast_subscribers_updated_at
  BEFORE UPDATE ON public.forecast_subscribers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();