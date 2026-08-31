
-- Habilitar RLS y crear políticas para hostaway_reservations
ALTER TABLE public.hostaway_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for authenticated users on hostaway_reservations" 
ON public.hostaway_reservations 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Habilitar RLS y crear políticas para hostaway_sync_logs
ALTER TABLE public.hostaway_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for authenticated users on hostaway_sync_logs" 
ON public.hostaway_sync_logs 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Habilitar RLS y crear políticas para property_groups
ALTER TABLE public.property_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for authenticated users on property_groups" 
ON public.property_groups 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Habilitar RLS y crear políticas para auto_assignment_rules
ALTER TABLE public.auto_assignment_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for authenticated users on auto_assignment_rules" 
ON public.auto_assignment_rules 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Habilitar RLS y crear políticas para assignment_patterns
ALTER TABLE public.assignment_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for authenticated users on assignment_patterns" 
ON public.assignment_patterns 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Habilitar RLS y crear políticas para property_group_assignments
ALTER TABLE public.property_group_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for authenticated users on property_group_assignments" 
ON public.property_group_assignments 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Habilitar RLS y crear políticas para cleaner_group_assignments
ALTER TABLE public.cleaner_group_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for authenticated users on cleaner_group_assignments" 
ON public.cleaner_group_assignments 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Habilitar RLS y crear políticas para auto_assignment_logs
ALTER TABLE public.auto_assignment_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for authenticated users on auto_assignment_logs" 
ON public.auto_assignment_logs 
FOR ALL 
USING (true) 
WITH CHECK (true);
