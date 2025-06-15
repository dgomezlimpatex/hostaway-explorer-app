
-- Crear enum para tipos de media
CREATE TYPE media_type AS ENUM ('photo', 'video');

-- Crear enum para estado de reportes
CREATE TYPE report_status AS ENUM ('pending', 'in_progress', 'completed', 'needs_review');

-- Plantillas de checklist por tipo de propiedad
CREATE TABLE public.task_checklists_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_type TEXT NOT NULL, -- studio, 1br, 2br, 3br, villa, etc.
    template_name TEXT NOT NULL,
    checklist_items JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array de items con categorías
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Reportes de tareas completadas
CREATE TABLE public.task_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    cleaner_id UUID REFERENCES public.cleaners(id),
    checklist_template_id UUID REFERENCES public.task_checklists_templates(id),
    checklist_completed JSONB NOT NULL DEFAULT '{}'::jsonb, -- Estado de cada item
    overall_status report_status NOT NULL DEFAULT 'pending',
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    issues_found JSONB DEFAULT '[]'::jsonb, -- Array de problemas encontrados
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Multimedia asociado a reportes
CREATE TABLE public.task_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_report_id UUID NOT NULL REFERENCES public.task_reports(id) ON DELETE CASCADE,
    media_type media_type NOT NULL,
    file_url TEXT NOT NULL, -- URL en Supabase Storage
    checklist_item_id TEXT, -- Vinculado a item específico del checklist
    description TEXT,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    file_size INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear bucket de storage para multimedia de reportes
INSERT INTO storage.buckets (id, name, public) 
VALUES ('task-reports-media', 'task-reports-media', true);

-- Políticas de acceso para las nuevas tablas
ALTER TABLE public.task_checklists_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_media ENABLE ROW LEVEL SECURITY;

-- Políticas para plantillas de checklist (solo admins y managers pueden crear/editar)
CREATE POLICY "Admin y managers pueden ver plantillas" 
    ON public.task_checklists_templates FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur 
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('admin', 'manager', 'supervisor', 'cleaner')
        )
    );

CREATE POLICY "Admin y managers pueden crear plantillas" 
    ON public.task_checklists_templates FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles ur 
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('admin', 'manager')
        )
    );

CREATE POLICY "Admin y managers pueden actualizar plantillas" 
    ON public.task_checklists_templates FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur 
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('admin', 'manager')
        )
    );

-- Políticas para reportes de tareas
CREATE POLICY "Usuarios pueden ver reportes relacionados" 
    ON public.task_reports FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur 
            WHERE ur.user_id = auth.uid() 
            AND (
                ur.role IN ('admin', 'manager', 'supervisor') 
                OR (ur.role = 'cleaner' AND cleaner_id IN (
                    SELECT id FROM public.cleaners WHERE user_id = auth.uid()
                ))
            )
        )
    );

CREATE POLICY "Limpiadoras pueden crear sus reportes" 
    ON public.task_reports FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.cleaners c 
            JOIN public.user_roles ur ON c.user_id = ur.user_id
            WHERE ur.user_id = auth.uid() 
            AND ur.role = 'cleaner'
            AND c.id = cleaner_id
        )
    );

CREATE POLICY "Limpiadoras pueden actualizar sus reportes" 
    ON public.task_reports FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM public.cleaners c 
            JOIN public.user_roles ur ON c.user_id = ur.user_id
            WHERE ur.user_id = auth.uid() 
            AND (
                ur.role IN ('admin', 'manager', 'supervisor')
                OR (ur.role = 'cleaner' AND c.id = cleaner_id)
            )
        )
    );

-- Políticas para multimedia
CREATE POLICY "Usuarios pueden ver media de reportes accesibles" 
    ON public.task_media FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.task_reports tr
            JOIN public.user_roles ur ON ur.user_id = auth.uid()
            WHERE tr.id = task_report_id
            AND (
                ur.role IN ('admin', 'manager', 'supervisor')
                OR (ur.role = 'cleaner' AND tr.cleaner_id IN (
                    SELECT id FROM public.cleaners WHERE user_id = auth.uid()
                ))
            )
        )
    );

CREATE POLICY "Limpiadoras pueden subir media a sus reportes" 
    ON public.task_media FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.task_reports tr
            JOIN public.cleaners c ON tr.cleaner_id = c.id
            JOIN public.user_roles ur ON c.user_id = ur.user_id
            WHERE tr.id = task_report_id
            AND ur.user_id = auth.uid() 
            AND ur.role = 'cleaner'
        )
    );

-- Políticas de storage para el bucket
CREATE POLICY "Authenticated users can upload media"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'task-reports-media' AND auth.role() = 'authenticated');

CREATE POLICY "Users can view media"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'task-reports-media');

CREATE POLICY "Users can update their media"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'task-reports-media' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their media"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'task-reports-media' AND auth.role() = 'authenticated');

-- Triggers para updated_at
CREATE TRIGGER update_task_checklists_templates_updated_at
    BEFORE UPDATE ON public.task_checklists_templates
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_task_reports_updated_at
    BEFORE UPDATE ON public.task_reports
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insertar una plantilla de ejemplo para apartamentos de 1 dormitorio
INSERT INTO public.task_checklists_templates (property_type, template_name, checklist_items) VALUES (
    '1br',
    'Limpieza Estándar 1 Dormitorio',
    '[
        {
            "id": "living_room",
            "category": "Salón",
            "items": [
                {"id": "living_vacuum", "task": "Aspirar sofás y alfombras", "required": true, "photo_required": false},
                {"id": "living_surfaces", "task": "Limpiar superficies y mesas", "required": true, "photo_required": false},
                {"id": "living_windows", "task": "Limpiar ventanas y espejos", "required": true, "photo_required": true}
            ]
        },
        {
            "id": "kitchen",
            "category": "Cocina", 
            "items": [
                {"id": "kitchen_appliances", "task": "Limpiar electrodomésticos", "required": true, "photo_required": true},
                {"id": "kitchen_surfaces", "task": "Desinfectar encimeras", "required": true, "photo_required": false},
                {"id": "kitchen_sink", "task": "Limpiar fregadero", "required": true, "photo_required": false}
            ]
        },
        {
            "id": "bedroom",
            "category": "Dormitorio",
            "items": [
                {"id": "bedroom_bed", "task": "Cambiar sábanas", "required": true, "photo_required": true},
                {"id": "bedroom_surfaces", "task": "Limpiar superficies", "required": true, "photo_required": false},
                {"id": "bedroom_vacuum", "task": "Aspirar suelo", "required": true, "photo_required": false}
            ]
        },
        {
            "id": "bathroom",
            "category": "Baño",
            "items": [
                {"id": "bathroom_toilet", "task": "Limpiar y desinfectar WC", "required": true, "photo_required": false},
                {"id": "bathroom_shower", "task": "Limpiar ducha/bañera", "required": true, "photo_required": true},
                {"id": "bathroom_mirror", "task": "Limpiar espejo", "required": true, "photo_required": false},
                {"id": "bathroom_towels", "task": "Cambiar toallas", "required": true, "photo_required": false}
            ]
        }
    ]'::jsonb
);
