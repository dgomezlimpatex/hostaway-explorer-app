-- Crear tabla para configuración de horarios de sincronización
CREATE TABLE public.hostaway_sync_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  hour INTEGER NOT NULL CHECK (hour >= 0 AND hour <= 23),
  minute INTEGER NOT NULL CHECK (minute >= 0 AND minute <= 59),
  timezone TEXT NOT NULL DEFAULT 'Europe/Madrid',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  CONSTRAINT unique_schedule_time UNIQUE (hour, minute, timezone)
);

-- Crear tabla para errores específicos de sincronización
CREATE TABLE public.hostaway_sync_errors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_log_id UUID REFERENCES public.hostaway_sync_logs(id),
  schedule_id UUID REFERENCES public.hostaway_sync_schedules(id),
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  error_details JSONB DEFAULT '{}',
  retry_attempt INTEGER DEFAULT 0,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Agregar campos adicionales a hostaway_sync_logs
ALTER TABLE public.hostaway_sync_logs 
ADD COLUMN triggered_by TEXT DEFAULT 'manual',
ADD COLUMN schedule_name TEXT,
ADD COLUMN retry_attempt INTEGER DEFAULT 0,
ADD COLUMN original_sync_id UUID REFERENCES public.hostaway_sync_logs(id);

-- Crear índices para mejor rendimiento
CREATE INDEX idx_hostaway_sync_schedules_active ON public.hostaway_sync_schedules(is_active, hour, minute);
CREATE INDEX idx_hostaway_sync_errors_unresolved ON public.hostaway_sync_errors(resolved, created_at);
CREATE INDEX idx_hostaway_sync_logs_triggered_by ON public.hostaway_sync_logs(triggered_by, created_at);

-- Habilitar RLS en las nuevas tablas
ALTER TABLE public.hostaway_sync_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostaway_sync_errors ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para hostaway_sync_schedules
CREATE POLICY "Admin y managers pueden gestionar schedules" 
ON public.hostaway_sync_schedules 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'manager')
  )
);

-- Políticas RLS para hostaway_sync_errors
CREATE POLICY "Admin y managers pueden ver errores de sync" 
ON public.hostaway_sync_errors 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'manager')
  )  
);

CREATE POLICY "Sistema puede insertar errores de sync" 
ON public.hostaway_sync_errors 
FOR INSERT 
WITH CHECK (true);

-- Insertar horarios por defecto
INSERT INTO public.hostaway_sync_schedules (name, hour, minute, timezone, is_active) VALUES
('Sincronización Mañana', 9, 0, 'Europe/Madrid', true),
('Sincronización Tarde', 14, 0, 'Europe/Madrid', true), 
('Sincronización Noche', 20, 0, 'Europe/Madrid', true);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.update_hostaway_sync_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Crear trigger para updated_at
CREATE TRIGGER update_hostaway_sync_schedules_updated_at
    BEFORE UPDATE ON public.hostaway_sync_schedules
    FOR EACH ROW
    EXECUTE FUNCTION public.update_hostaway_sync_schedules_updated_at();