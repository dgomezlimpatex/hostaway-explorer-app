
-- Crear tabla para asignaciones de plantillas de checklist a propiedades
CREATE TABLE public.property_checklist_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  checklist_template_id UUID NOT NULL REFERENCES public.task_checklists_templates(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.property_checklist_assignments ENABLE ROW LEVEL SECURITY;

-- Crear políticas RLS (permitir acceso a usuarios autenticados para simplificar)
CREATE POLICY "Usuarios autenticados pueden ver asignaciones de checklist" 
  ON public.property_checklist_assignments 
  FOR SELECT 
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden crear asignaciones de checklist" 
  ON public.property_checklist_assignments 
  FOR INSERT 
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar asignaciones de checklist" 
  ON public.property_checklist_assignments 
  FOR UPDATE 
  TO authenticated
  USING (true);

-- Crear índices para mejorar el rendimiento
CREATE INDEX idx_property_checklist_assignments_property_id ON public.property_checklist_assignments(property_id);
CREATE INDEX idx_property_checklist_assignments_template_id ON public.property_checklist_assignments(checklist_template_id);
CREATE INDEX idx_property_checklist_assignments_active ON public.property_checklist_assignments(is_active);

-- Trigger para actualizar updated_at
CREATE TRIGGER update_property_checklist_assignments_updated_at
    BEFORE UPDATE ON public.property_checklist_assignments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
