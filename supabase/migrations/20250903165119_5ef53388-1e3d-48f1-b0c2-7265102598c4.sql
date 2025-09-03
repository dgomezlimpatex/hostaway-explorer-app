-- Crear tabla para contratos laborales
CREATE TABLE public.worker_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cleaner_id UUID NOT NULL,
  contract_type TEXT NOT NULL CHECK (contract_type IN ('full-time', 'part-time', 'temporary', 'freelance')),
  position TEXT NOT NULL,
  department TEXT NOT NULL,
  hourly_rate DECIMAL(10,2) NOT NULL,
  contract_hours_per_week INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  renewal_date DATE NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'expired', 'terminated')),
  benefits TEXT[] DEFAULT '{}',
  notes TEXT,
  documents JSONB DEFAULT '[]',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear tabla para solicitudes de vacaciones
CREATE TABLE public.vacation_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cleaner_id UUID NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_requested INTEGER NOT NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('vacation', 'sick', 'personal')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reason TEXT,
  notes TEXT,
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_by UUID NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE NULL,
  review_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.worker_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vacation_requests ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para contratos
CREATE POLICY "Users can manage contracts from their assigned sedes" 
ON public.worker_contracts FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.cleaners c 
    WHERE c.id = worker_contracts.cleaner_id 
    AND c.sede_id = ANY(get_user_accessible_sedes())
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'manager')
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cleaners c 
    WHERE c.id = worker_contracts.cleaner_id 
    AND c.sede_id = ANY(get_user_accessible_sedes())
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'manager')
    )
  )
);

CREATE POLICY "Cleaners can view their own contracts" 
ON public.worker_contracts FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.cleaners c 
    WHERE c.id = worker_contracts.cleaner_id 
    AND c.user_id = auth.uid()
  )
);

-- Políticas RLS para solicitudes de vacaciones
CREATE POLICY "Users can manage vacation requests from their assigned sedes" 
ON public.vacation_requests FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.cleaners c 
    WHERE c.id = vacation_requests.cleaner_id 
    AND c.sede_id = ANY(get_user_accessible_sedes())
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'manager')
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cleaners c 
    WHERE c.id = vacation_requests.cleaner_id 
    AND c.sede_id = ANY(get_user_accessible_sedes())
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'manager')
    )
  )
);

CREATE POLICY "Cleaners can manage their own vacation requests" 
ON public.vacation_requests FOR ALL 
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

-- Triggers para updated_at
CREATE TRIGGER update_worker_contracts_updated_at
  BEFORE UPDATE ON public.worker_contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vacation_requests_updated_at
  BEFORE UPDATE ON public.vacation_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para mejor rendimiento
CREATE INDEX idx_worker_contracts_cleaner_id ON public.worker_contracts(cleaner_id);
CREATE INDEX idx_worker_contracts_status ON public.worker_contracts(status);
CREATE INDEX idx_vacation_requests_cleaner_id ON public.vacation_requests(cleaner_id);
CREATE INDEX idx_vacation_requests_status ON public.vacation_requests(status);