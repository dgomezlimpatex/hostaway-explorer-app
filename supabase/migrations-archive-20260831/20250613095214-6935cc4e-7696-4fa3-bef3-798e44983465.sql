
-- Crear tabla para gestionar la disponibilidad de los trabajadores
CREATE TABLE public.cleaner_availability (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cleaner_id UUID NOT NULL REFERENCES public.cleaners(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Domingo, 1=Lunes, ..., 6=Sábado
  is_available BOOLEAN NOT NULL DEFAULT true,
  start_time TIME WITHOUT TIME ZONE, -- Hora de inicio de disponibilidad (null si no está disponible)
  end_time TIME WITHOUT TIME ZONE, -- Hora de fin de disponibilidad (null si no está disponible)
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Asegurar que si está disponible, debe tener horarios definidos
  CONSTRAINT availability_time_check CHECK (
    (is_available = false) OR 
    (is_available = true AND start_time IS NOT NULL AND end_time IS NOT NULL AND start_time < end_time)
  ),
  
  -- Un trabajador solo puede tener una configuración por día de la semana
  UNIQUE(cleaner_id, day_of_week)
);

-- Crear índices para mejorar el rendimiento
CREATE INDEX idx_cleaner_availability_cleaner_id ON public.cleaner_availability(cleaner_id);
CREATE INDEX idx_cleaner_availability_day ON public.cleaner_availability(day_of_week);

-- Trigger para actualizar updated_at automáticamente
CREATE TRIGGER update_cleaner_availability_updated_at
  BEFORE UPDATE ON public.cleaner_availability
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar Row Level Security (aunque por ahora no necesitamos políticas específicas)
ALTER TABLE public.cleaner_availability ENABLE ROW LEVEL SECURITY;

-- Crear política básica (permitir todo por ahora, se puede restringir más adelante)
CREATE POLICY "Allow all operations on cleaner_availability" 
  ON public.cleaner_availability 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);
