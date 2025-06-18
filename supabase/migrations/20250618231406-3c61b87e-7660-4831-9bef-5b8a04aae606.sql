
-- Crear tabla para grupos de propiedades (edificios/bloques)
CREATE TABLE public.property_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  check_out_time TIME NOT NULL DEFAULT '11:00:00',
  check_in_time TIME NOT NULL DEFAULT '17:00:00',
  is_active BOOLEAN NOT NULL DEFAULT true,
  auto_assign_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Crear tabla para asignar propiedades a grupos
CREATE TABLE public.property_group_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_group_id UUID REFERENCES public.property_groups(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(property_id) -- Una propiedad solo puede estar en un grupo
);

-- Crear tabla para asignar trabajadoras a grupos con prioridades
CREATE TABLE public.cleaner_group_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_group_id UUID REFERENCES public.property_groups(id) ON DELETE CASCADE,
  cleaner_id UUID REFERENCES public.cleaners(id) ON DELETE CASCADE,
  priority INTEGER NOT NULL, -- 1 = principal, 2,3,etc = secundarias
  max_tasks_per_day INTEGER DEFAULT 8,
  estimated_travel_time_minutes INTEGER DEFAULT 15, -- tiempo entre propiedades
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(property_group_id, cleaner_id)
);

-- Crear tabla para reglas de asignación automática
CREATE TABLE public.auto_assignment_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_group_id UUID REFERENCES public.property_groups(id) ON DELETE CASCADE,
  algorithm TEXT NOT NULL DEFAULT 'workload-balance', -- 'round-robin', 'workload-balance', 'availability-first'
  max_concurrent_tasks INTEGER DEFAULT 3,
  buffer_time_minutes INTEGER DEFAULT 15, -- tiempo mínimo entre tareas
  consider_travel_time BOOLEAN DEFAULT true,
  learn_from_history BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Crear tabla para aprendizaje automático (patrones históricos)
CREATE TABLE public.assignment_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_group_id UUID REFERENCES public.property_groups(id) ON DELETE CASCADE,
  cleaner_id UUID REFERENCES public.cleaners(id) ON DELETE CASCADE,
  day_of_week INTEGER, -- 0=domingo, 1=lunes, etc
  hour_of_day INTEGER,
  avg_completion_time_minutes INTEGER,
  success_rate DECIMAL(5,2), -- porcentaje de tareas completadas a tiempo
  preference_score DECIMAL(5,2), -- puntuación de preferencia basada en historial
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
  sample_size INTEGER DEFAULT 1, -- número de tareas consideradas para el cálculo
  UNIQUE(property_group_id, cleaner_id, day_of_week, hour_of_day)
);

-- Crear tabla para logs de asignaciones automáticas
CREATE TABLE public.auto_assignment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  property_group_id UUID REFERENCES public.property_groups(id),
  assigned_cleaner_id UUID REFERENCES public.cleaners(id),
  algorithm_used TEXT,
  assignment_reason TEXT,
  confidence_score DECIMAL(5,2), -- qué tan seguro estaba el algoritmo
  was_manual_override BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Añadir índices para mejorar rendimiento
CREATE INDEX idx_property_group_assignments_group ON public.property_group_assignments(property_group_id);
CREATE INDEX idx_property_group_assignments_property ON public.property_group_assignments(property_id);
CREATE INDEX idx_cleaner_group_assignments_group ON public.cleaner_group_assignments(property_group_id);
CREATE INDEX idx_cleaner_group_assignments_cleaner ON public.cleaner_group_assignments(cleaner_id);
CREATE INDEX idx_assignment_patterns_group_cleaner ON public.assignment_patterns(property_group_id, cleaner_id);
CREATE INDEX idx_assignment_patterns_day_hour ON public.assignment_patterns(day_of_week, hour_of_day);
CREATE INDEX idx_auto_assignment_logs_task ON public.auto_assignment_logs(task_id);
CREATE INDEX idx_auto_assignment_logs_created ON public.auto_assignment_logs(created_at);

-- Añadir campo a tasks para marcar si fue asignada automáticamente
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS auto_assigned BOOLEAN DEFAULT false;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS assignment_confidence DECIMAL(5,2);

-- Crear triggers para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_property_groups_updated_at BEFORE UPDATE ON public.property_groups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cleaner_group_assignments_updated_at BEFORE UPDATE ON public.cleaner_group_assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_auto_assignment_rules_updated_at BEFORE UPDATE ON public.auto_assignment_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
