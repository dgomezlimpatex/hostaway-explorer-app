-- Extender tabla cleaners con información de contrato
ALTER TABLE public.cleaners ADD COLUMN IF NOT EXISTS contract_hours_per_week DECIMAL(5,2) DEFAULT 40.00;
ALTER TABLE public.cleaners ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(8,2);
ALTER TABLE public.cleaners ADD COLUMN IF NOT EXISTS contract_type VARCHAR(50) DEFAULT 'full-time';
ALTER TABLE public.cleaners ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE public.cleaners ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255);
ALTER TABLE public.cleaners ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(50);

-- Crear tabla para registros de tiempo trabajado
CREATE TABLE IF NOT EXISTS public.time_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cleaner_id UUID NOT NULL REFERENCES public.cleaners(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  clock_in TIMESTAMP WITH TIME ZONE,
  clock_out TIMESTAMP WITH TIME ZONE,
  break_duration_minutes INTEGER DEFAULT 0,
  total_hours DECIMAL(4,2) GENERATED ALWAYS AS (
    CASE 
      WHEN clock_in IS NOT NULL AND clock_out IS NOT NULL 
      THEN EXTRACT(EPOCH FROM (clock_out - clock_in)) / 3600.0 - (break_duration_minutes / 60.0)
      ELSE 0
    END
  ) STORED,
  overtime_hours DECIMAL(4,2) DEFAULT 0,
  notes TEXT,
  status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(cleaner_id, date)
);

-- Crear tabla para días de trabajo programados (calendario individual)
CREATE TABLE IF NOT EXISTS public.cleaner_work_schedule (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cleaner_id UUID NOT NULL REFERENCES public.cleaners(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  scheduled_start_time TIME NOT NULL,
  scheduled_end_time TIME NOT NULL,
  is_working_day BOOLEAN DEFAULT true,
  schedule_type VARCHAR(20) DEFAULT 'regular', -- regular, overtime, holiday
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(cleaner_id, date)
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_time_logs_cleaner_date ON public.time_logs(cleaner_id, date);
CREATE INDEX IF NOT EXISTS idx_work_schedule_cleaner_date ON public.cleaner_work_schedule(cleaner_id, date);

-- Triggers para updated_at
CREATE TRIGGER update_time_logs_updated_at
  BEFORE UPDATE ON public.time_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_work_schedule_updated_at
  BEFORE UPDATE ON public.cleaner_work_schedule
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar RLS
ALTER TABLE public.time_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleaner_work_schedule ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para time_logs
CREATE POLICY "Cleaners can view their own time logs" 
  ON public.time_logs FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM cleaners c 
      WHERE c.id = time_logs.cleaner_id 
      AND c.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'manager', 'supervisor')
    )
  );

CREATE POLICY "Cleaners can insert their own time logs" 
  ON public.time_logs FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cleaners c 
      WHERE c.id = time_logs.cleaner_id 
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Cleaners can update their own time logs" 
  ON public.time_logs FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM cleaners c 
      WHERE c.id = time_logs.cleaner_id 
      AND c.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'manager', 'supervisor')
    )
  );

-- Políticas RLS para work_schedule
CREATE POLICY "Users can manage work schedules based on role" 
  ON public.cleaner_work_schedule FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM cleaners c 
      WHERE c.id = cleaner_work_schedule.cleaner_id 
      AND c.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'manager', 'supervisor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cleaners c 
      WHERE c.id = cleaner_work_schedule.cleaner_id 
      AND c.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'manager', 'supervisor')
    )
  );