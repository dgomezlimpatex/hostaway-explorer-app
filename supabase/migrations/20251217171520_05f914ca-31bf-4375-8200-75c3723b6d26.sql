-- =============================================
-- SISTEMA DE GESTIÓN DE AUSENCIAS DE TRABAJADORES
-- =============================================

-- 1. Tabla de ausencias específicas (día completo o por horas)
CREATE TABLE public.worker_absences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id UUID NOT NULL REFERENCES public.cleaners(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_time TIME, -- NULL = día completo
  end_time TIME,   -- NULL = día completo
  absence_type TEXT NOT NULL CHECK (absence_type IN ('vacation', 'sick', 'day_off', 'holiday', 'personal', 'external_work')),
  location_name TEXT, -- Solo para 'external_work'
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date),
  CONSTRAINT valid_time_range CHECK (
    (start_time IS NULL AND end_time IS NULL) OR 
    (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
  )
);

-- 2. Tabla de días libres fijos (recurrentes)
CREATE TABLE public.worker_fixed_days_off (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id UUID NOT NULL REFERENCES public.cleaners(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Domingo, 6=Sábado
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cleaner_id, day_of_week)
);

-- 3. Tabla de limpiezas de mantenimiento (compromisos externos fijos)
CREATE TABLE public.worker_maintenance_cleanings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id UUID NOT NULL REFERENCES public.cleaners(id) ON DELETE CASCADE,
  days_of_week INTEGER[] NOT NULL, -- Array de días [1, 3] = Lunes y Miércoles
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  location_name TEXT NOT NULL,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_maintenance_time_range CHECK (end_time > start_time)
);

-- 4. Tabla de auditoría de cambios
CREATE TABLE public.worker_absence_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id UUID, -- ID del registro modificado (puede ser NULL si se eliminó)
  reference_type TEXT NOT NULL CHECK (reference_type IN ('absence', 'fixed_day_off', 'maintenance_cleaning')),
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
  cleaner_id UUID NOT NULL,
  old_data JSONB,
  new_data JSONB,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para optimizar consultas
CREATE INDEX idx_worker_absences_cleaner_date ON public.worker_absences(cleaner_id, start_date, end_date);
CREATE INDEX idx_worker_absences_type ON public.worker_absences(absence_type);
CREATE INDEX idx_worker_fixed_days_off_cleaner ON public.worker_fixed_days_off(cleaner_id);
CREATE INDEX idx_worker_maintenance_cleanings_cleaner ON public.worker_maintenance_cleanings(cleaner_id);
CREATE INDEX idx_worker_absence_audit_log_cleaner ON public.worker_absence_audit_log(cleaner_id);
CREATE INDEX idx_worker_absence_audit_log_reference ON public.worker_absence_audit_log(reference_id, reference_type);

-- Habilitar RLS
ALTER TABLE public.worker_absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_fixed_days_off ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_maintenance_cleanings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_absence_audit_log ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para worker_absences
CREATE POLICY "Admin and managers can manage worker absences"
ON public.worker_absences FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'manager')
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'manager')
));

CREATE POLICY "Supervisors can view worker absences"
ON public.worker_absences FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = auth.uid() AND ur.role = 'supervisor'
));

CREATE POLICY "Cleaners can view their own absences"
ON public.worker_absences FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.cleaners c
  WHERE c.id = worker_absences.cleaner_id AND c.user_id = auth.uid()
));

-- Políticas RLS para worker_fixed_days_off
CREATE POLICY "Admin and managers can manage fixed days off"
ON public.worker_fixed_days_off FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'manager')
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'manager')
));

CREATE POLICY "Supervisors can view fixed days off"
ON public.worker_fixed_days_off FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = auth.uid() AND ur.role = 'supervisor'
));

CREATE POLICY "Cleaners can view their own fixed days off"
ON public.worker_fixed_days_off FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.cleaners c
  WHERE c.id = worker_fixed_days_off.cleaner_id AND c.user_id = auth.uid()
));

-- Políticas RLS para worker_maintenance_cleanings
CREATE POLICY "Admin and managers can manage maintenance cleanings"
ON public.worker_maintenance_cleanings FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'manager')
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'manager')
));

CREATE POLICY "Supervisors can view maintenance cleanings"
ON public.worker_maintenance_cleanings FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = auth.uid() AND ur.role = 'supervisor'
));

CREATE POLICY "Cleaners can view their own maintenance cleanings"
ON public.worker_maintenance_cleanings FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.cleaners c
  WHERE c.id = worker_maintenance_cleanings.cleaner_id AND c.user_id = auth.uid()
));

-- Políticas RLS para audit log (solo lectura para admin/manager)
CREATE POLICY "Admin and managers can view audit log"
ON public.worker_absence_audit_log FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'manager')
));

CREATE POLICY "System can insert audit log"
ON public.worker_absence_audit_log FOR INSERT
WITH CHECK (true);

-- Triggers para updated_at
CREATE TRIGGER update_worker_absences_updated_at
  BEFORE UPDATE ON public.worker_absences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_worker_fixed_days_off_updated_at
  BEFORE UPDATE ON public.worker_fixed_days_off
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_worker_maintenance_cleanings_updated_at
  BEFORE UPDATE ON public.worker_maintenance_cleanings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Función para log de auditoría de worker_absences
CREATE OR REPLACE FUNCTION public.log_worker_absence_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.worker_absence_audit_log (reference_id, reference_type, action, cleaner_id, new_data, changed_by)
    VALUES (NEW.id, 'absence', 'created', NEW.cleaner_id, row_to_json(NEW)::jsonb, auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.worker_absence_audit_log (reference_id, reference_type, action, cleaner_id, old_data, new_data, changed_by)
    VALUES (NEW.id, 'absence', 'updated', NEW.cleaner_id, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.worker_absence_audit_log (reference_id, reference_type, action, cleaner_id, old_data, changed_by)
    VALUES (OLD.id, 'absence', 'deleted', OLD.cleaner_id, row_to_json(OLD)::jsonb, auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Función para log de auditoría de worker_fixed_days_off
CREATE OR REPLACE FUNCTION public.log_worker_fixed_days_off_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.worker_absence_audit_log (reference_id, reference_type, action, cleaner_id, new_data, changed_by)
    VALUES (NEW.id, 'fixed_day_off', 'created', NEW.cleaner_id, row_to_json(NEW)::jsonb, auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.worker_absence_audit_log (reference_id, reference_type, action, cleaner_id, old_data, new_data, changed_by)
    VALUES (NEW.id, 'fixed_day_off', 'updated', NEW.cleaner_id, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.worker_absence_audit_log (reference_id, reference_type, action, cleaner_id, old_data, changed_by)
    VALUES (OLD.id, 'fixed_day_off', 'deleted', OLD.cleaner_id, row_to_json(OLD)::jsonb, auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Función para log de auditoría de worker_maintenance_cleanings
CREATE OR REPLACE FUNCTION public.log_worker_maintenance_cleanings_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.worker_absence_audit_log (reference_id, reference_type, action, cleaner_id, new_data, changed_by)
    VALUES (NEW.id, 'maintenance_cleaning', 'created', NEW.cleaner_id, row_to_json(NEW)::jsonb, auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.worker_absence_audit_log (reference_id, reference_type, action, cleaner_id, old_data, new_data, changed_by)
    VALUES (NEW.id, 'maintenance_cleaning', 'updated', NEW.cleaner_id, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.worker_absence_audit_log (reference_id, reference_type, action, cleaner_id, old_data, changed_by)
    VALUES (OLD.id, 'maintenance_cleaning', 'deleted', OLD.cleaner_id, row_to_json(OLD)::jsonb, auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Crear triggers de auditoría
CREATE TRIGGER audit_worker_absences
  AFTER INSERT OR UPDATE OR DELETE ON public.worker_absences
  FOR EACH ROW
  EXECUTE FUNCTION public.log_worker_absence_changes();

CREATE TRIGGER audit_worker_fixed_days_off
  AFTER INSERT OR UPDATE OR DELETE ON public.worker_fixed_days_off
  FOR EACH ROW
  EXECUTE FUNCTION public.log_worker_fixed_days_off_changes();

CREATE TRIGGER audit_worker_maintenance_cleanings
  AFTER INSERT OR UPDATE OR DELETE ON public.worker_maintenance_cleanings
  FOR EACH ROW
  EXECUTE FUNCTION public.log_worker_maintenance_cleanings_changes();