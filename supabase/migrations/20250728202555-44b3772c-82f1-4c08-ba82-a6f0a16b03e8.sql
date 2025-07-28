-- Modificar la tabla task_reports para quitar la restricción de un reporte por tarea
-- y permitir múltiples reportes (uno por cada trabajador asignado)

-- Primero, eliminar cualquier constraint único que pueda existir en task_id
ALTER TABLE public.task_reports DROP CONSTRAINT IF EXISTS task_reports_task_id_key;

-- Agregar una restricción única compuesta para task_id + cleaner_id
-- para garantizar que cada trabajador solo pueda tener un reporte por tarea
ALTER TABLE public.task_reports ADD CONSTRAINT task_reports_task_cleaner_unique 
UNIQUE (task_id, cleaner_id);

-- Crear índice para mejorar performance en consultas por tarea
CREATE INDEX IF NOT EXISTS idx_task_reports_task_id ON public.task_reports(task_id);
CREATE INDEX IF NOT EXISTS idx_task_reports_cleaner_id ON public.task_reports(cleaner_id);

-- Crear una vista para obtener reportes agrupados por tarea
CREATE OR REPLACE VIEW public.task_reports_grouped AS
SELECT 
    tr.task_id,
    COUNT(tr.id) as total_reports,
    COUNT(CASE WHEN tr.overall_status = 'completed' THEN 1 END) as completed_reports,
    COUNT(CASE WHEN tr.overall_status = 'in_progress' THEN 1 END) as in_progress_reports,
    COUNT(CASE WHEN tr.overall_status = 'pending' THEN 1 END) as pending_reports,
    COUNT(CASE WHEN tr.overall_status = 'needs_review' THEN 1 END) as needs_review_reports,
    MIN(tr.start_time) as earliest_start_time,
    MAX(tr.end_time) as latest_end_time,
    ARRAY_AGG(
        JSON_BUILD_OBJECT(
            'id', tr.id,
            'cleaner_id', tr.cleaner_id,
            'cleaner_name', c.name,
            'overall_status', tr.overall_status,
            'start_time', tr.start_time,
            'end_time', tr.end_time,
            'created_at', tr.created_at,
            'updated_at', tr.updated_at
        ) ORDER BY tr.created_at
    ) as individual_reports
FROM public.task_reports tr
LEFT JOIN public.cleaners c ON tr.cleaner_id = c.id
GROUP BY tr.task_id;

-- Actualizar las políticas RLS para la nueva vista
ALTER VIEW public.task_reports_grouped OWNER TO postgres;

-- Otorgar permisos de lectura para usuarios autenticados
GRANT SELECT ON public.task_reports_grouped TO authenticated;

-- Crear política RLS para la vista (aunque las vistas heredan las políticas de las tablas subyacentes)
-- Esta es una medida adicional de seguridad
CREATE POLICY "Users can view grouped reports based on role" ON public.task_reports_grouped
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND (
      ur.role IN ('admin', 'manager', 'supervisor') 
      OR (
        ur.role = 'cleaner' 
        AND EXISTS (
          SELECT 1 FROM task_reports tr2
          JOIN cleaners c2 ON tr2.cleaner_id = c2.id
          WHERE tr2.task_id = task_reports_grouped.task_id
          AND c2.user_id = auth.uid()
        )
      )
    )
  )
);