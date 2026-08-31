-- FASE 1.1: Extensión de tabla time_logs
ALTER TABLE public.time_logs ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES public.tasks(id);
ALTER TABLE public.time_logs ADD COLUMN IF NOT EXISTS base_salary NUMERIC DEFAULT 0;
ALTER TABLE public.time_logs ADD COLUMN IF NOT EXISTS overtime_multiplier NUMERIC DEFAULT 1.5;
ALTER TABLE public.time_logs ADD COLUMN IF NOT EXISTS vacation_hours_accrued NUMERIC DEFAULT 0;
ALTER TABLE public.time_logs ADD COLUMN IF NOT EXISTS vacation_hours_used NUMERIC DEFAULT 0;

-- Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_time_logs_task_id ON public.time_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_cleaner_date ON public.time_logs(cleaner_id, date);

-- FASE 1.2: Nueva tabla worker_contracts
CREATE TABLE IF NOT EXISTS public.worker_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id UUID NOT NULL REFERENCES public.cleaners(id) ON DELETE CASCADE,
  contract_type TEXT NOT NULL DEFAULT 'full-time',
  start_date DATE NOT NULL,
  end_date DATE,
  base_salary NUMERIC NOT NULL DEFAULT 0,
  hourly_rate NUMERIC,
  overtime_rate NUMERIC DEFAULT 1.5,
  vacation_days_per_year INTEGER DEFAULT 22,
  sick_days_per_year INTEGER DEFAULT 10,
  contract_hours_per_week NUMERIC DEFAULT 40,
  payment_frequency TEXT DEFAULT 'monthly', -- weekly, biweekly, monthly
  benefits JSONB DEFAULT '{}',
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.worker_contracts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for worker_contracts
CREATE POLICY "Users can manage contracts from their assigned sedes" 
ON public.worker_contracts 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.cleaners c 
    WHERE c.id = worker_contracts.cleaner_id 
    AND c.sede_id = ANY (get_user_accessible_sedes()) 
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cleaners c 
    WHERE c.id = worker_contracts.cleaner_id 
    AND c.sede_id = ANY (get_user_accessible_sedes()) 
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
    )
  )
);

CREATE POLICY "Supervisors can view contracts" 
ON public.worker_contracts 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.cleaners c 
    WHERE c.id = worker_contracts.cleaner_id 
    AND c.sede_id = ANY (get_user_accessible_sedes()) 
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'supervisor'::app_role
    )
  )
);

-- FASE 1.3: Nueva tabla vacation_requests
CREATE TABLE IF NOT EXISTS public.vacation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id UUID NOT NULL REFERENCES public.cleaners(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_requested INTEGER NOT NULL,
  request_type TEXT DEFAULT 'vacation', -- vacation, sick, personal
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  reason TEXT,
  notes TEXT,
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.vacation_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vacation_requests
CREATE POLICY "Workers can manage their own vacation requests" 
ON public.vacation_requests 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.cleaners c 
    WHERE c.id = vacation_requests.cleaner_id 
    AND c.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cleaners c 
    WHERE c.id = vacation_requests.cleaner_id 
    AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Managers can manage vacation requests from their sedes" 
ON public.vacation_requests 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.cleaners c 
    WHERE c.id = vacation_requests.cleaner_id 
    AND c.sede_id = ANY (get_user_accessible_sedes()) 
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cleaners c 
    WHERE c.id = vacation_requests.cleaner_id 
    AND c.sede_id = ANY (get_user_accessible_sedes()) 
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
    )
  )
);

CREATE POLICY "Supervisors can view vacation requests" 
ON public.vacation_requests 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.cleaners c 
    WHERE c.id = vacation_requests.cleaner_id 
    AND c.sede_id = ANY (get_user_accessible_sedes()) 
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'supervisor'::app_role
    )
  )
);

-- Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_vacation_requests_cleaner_id ON public.vacation_requests(cleaner_id);
CREATE INDEX IF NOT EXISTS idx_vacation_requests_status ON public.vacation_requests(status);
CREATE INDEX IF NOT EXISTS idx_vacation_requests_dates ON public.vacation_requests(start_date, end_date);

-- Trigger para updated_at en worker_contracts
CREATE TRIGGER update_worker_contracts_updated_at
    BEFORE UPDATE ON public.worker_contracts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para updated_at en vacation_requests
CREATE TRIGGER update_vacation_requests_updated_at
    BEFORE UPDATE ON public.vacation_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();