-- =====================================================
-- AVANTIO CHANNEL MANAGER INTEGRATION - DATABASE SCHEMA
-- =====================================================

-- Tabla para almacenar las reservas sincronizadas de Avantio
CREATE TABLE public.avantio_reservations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  avantio_reservation_id TEXT NOT NULL UNIQUE, -- ID único de la reserva en Avantio
  property_id UUID REFERENCES public.properties(id),
  cliente_id UUID REFERENCES public.clients(id),
  guest_name TEXT NOT NULL, -- Nombre del huésped (identificador de la reserva)
  guest_email TEXT,
  arrival_date DATE NOT NULL,
  departure_date DATE NOT NULL,
  reservation_date TIMESTAMP WITH TIME ZONE,
  cancellation_date TIMESTAMP WITH TIME ZONE,
  nights INTEGER,
  adults INTEGER DEFAULT 0,
  children INTEGER DEFAULT 0,
  status TEXT NOT NULL, -- confirmed, cancelled, pending, etc.
  task_id UUID REFERENCES public.tasks(id),
  accommodation_id TEXT, -- ID del alojamiento en Avantio
  accommodation_name TEXT, -- Nombre del alojamiento en Avantio
  total_amount DECIMAL(10,2),
  currency TEXT DEFAULT 'EUR',
  notes TEXT,
  last_sync_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para búsquedas eficientes
CREATE INDEX idx_avantio_reservations_property ON public.avantio_reservations(property_id);
CREATE INDEX idx_avantio_reservations_departure ON public.avantio_reservations(departure_date);
CREATE INDEX idx_avantio_reservations_status ON public.avantio_reservations(status);
CREATE INDEX idx_avantio_reservations_guest ON public.avantio_reservations(guest_name);
CREATE INDEX idx_avantio_reservations_accommodation ON public.avantio_reservations(accommodation_id);

-- Tabla para logs de sincronización
CREATE TABLE public.avantio_sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sync_completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'running', -- running, completed, failed
  reservations_processed INTEGER DEFAULT 0,
  new_reservations INTEGER DEFAULT 0,
  updated_reservations INTEGER DEFAULT 0,
  cancelled_reservations INTEGER DEFAULT 0,
  tasks_created INTEGER DEFAULT 0,
  tasks_cancelled INTEGER DEFAULT 0,
  tasks_modified INTEGER DEFAULT 0,
  errors TEXT[],
  tasks_details JSONB,
  tasks_cancelled_details JSONB,
  tasks_modified_details JSONB,
  reservations_details JSONB,
  triggered_by TEXT, -- 'manual', 'scheduled', 'cron_09', 'cron_14', 'cron_19'
  schedule_name TEXT,
  retry_attempt INTEGER DEFAULT 0,
  original_sync_id UUID REFERENCES public.avantio_sync_logs(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla para horarios de sincronización
CREATE TABLE public.avantio_sync_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  hour INTEGER NOT NULL CHECK (hour >= 0 AND hour <= 23),
  minute INTEGER NOT NULL DEFAULT 0 CHECK (minute >= 0 AND minute <= 59),
  timezone TEXT NOT NULL DEFAULT 'Europe/Madrid',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla para errores de sincronización
CREATE TABLE public.avantio_sync_errors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_log_id UUID REFERENCES public.avantio_sync_logs(id),
  schedule_id UUID REFERENCES public.avantio_sync_schedules(id),
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  error_details JSONB,
  retry_attempt INTEGER DEFAULT 0,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Añadir campo avantio_accommodation_id a properties para mapeo
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS avantio_accommodation_id TEXT,
ADD COLUMN IF NOT EXISTS avantio_accommodation_name TEXT;

CREATE INDEX IF NOT EXISTS idx_properties_avantio ON public.properties(avantio_accommodation_id);

-- Trigger para updated_at automático
CREATE TRIGGER update_avantio_reservations_updated_at
  BEFORE UPDATE ON public.avantio_reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_avantio_sync_schedules_updated_at
  BEFORE UPDATE ON public.avantio_sync_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar RLS
ALTER TABLE public.avantio_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avantio_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avantio_sync_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avantio_sync_errors ENABLE ROW LEVEL SECURITY;

-- Políticas RLS - Solo admins y managers pueden gestionar
CREATE POLICY "Admins and managers can manage avantio_reservations"
  ON public.avantio_reservations
  FOR ALL
  USING (public.user_is_admin_or_manager());

CREATE POLICY "Admins and managers can manage avantio_sync_logs"
  ON public.avantio_sync_logs
  FOR ALL
  USING (public.user_is_admin_or_manager());

CREATE POLICY "Admins and managers can manage avantio_sync_schedules"
  ON public.avantio_sync_schedules
  FOR ALL
  USING (public.user_is_admin_or_manager());

CREATE POLICY "Admins and managers can manage avantio_sync_errors"
  ON public.avantio_sync_errors
  FOR ALL
  USING (public.user_is_admin_or_manager());

-- Insertar horarios predeterminados (09:00, 14:00, 19:00)
INSERT INTO public.avantio_sync_schedules (name, hour, minute, timezone, is_active)
VALUES 
  ('Sincronización Mañana', 9, 0, 'Europe/Madrid', true),
  ('Sincronización Mediodía', 14, 0, 'Europe/Madrid', true),
  ('Sincronización Tarde', 19, 0, 'Europe/Madrid', true);

-- Función para gestionar cron jobs de Avantio
CREATE OR REPLACE FUNCTION public.manage_avantio_cron_job(
  job_name TEXT, 
  cron_schedule TEXT, 
  function_url TEXT, 
  auth_header TEXT, 
  request_body TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  result JSONB;
  job_id BIGINT;
BEGIN
  -- Primero, intentar desactivar el job si ya existe
  BEGIN
    PERFORM cron.unschedule(job_name);
    RAISE NOTICE 'Unscheduled existing job: %', job_name;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'No existing job to unschedule: %', job_name;
  END;
  
  -- Crear el nuevo cron job
  SELECT cron.schedule(
    job_name,
    cron_schedule,
    format(
      $sql$
      SELECT net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := %L::jsonb
      ) as request_id;
      $sql$,
      function_url,
      auth_header,
      request_body
    )
  ) INTO job_id;
  
  result := jsonb_build_object(
    'success', true,
    'job_id', job_id,
    'job_name', job_name,
    'schedule', cron_schedule
  );
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    result := jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'detail', SQLSTATE
    );
    RETURN result;
END;
$function$;

-- Función para listar cron jobs de Avantio
CREATE OR REPLACE FUNCTION public.list_avantio_cron_jobs()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  jobs JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'jobid', jobid,
      'schedule', schedule,
      'command', command,
      'jobname', jobname,
      'active', active
    )
  )
  INTO jobs
  FROM cron.job
  WHERE jobname LIKE 'avantio_sync_%';
  
  RETURN COALESCE(jobs, '[]'::jsonb);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$function$;

-- Función para eliminar cron jobs de Avantio
CREATE OR REPLACE FUNCTION public.delete_avantio_cron_job(job_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  result JSONB;
BEGIN
  PERFORM cron.unschedule(job_name);
  
  result := jsonb_build_object(
    'success', true,
    'job_name', job_name,
    'message', 'Job unscheduled successfully'
  );
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    result := jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
    RETURN result;
END;
$function$;