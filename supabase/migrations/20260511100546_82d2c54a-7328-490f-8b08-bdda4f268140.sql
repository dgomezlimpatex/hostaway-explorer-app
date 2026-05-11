DROP POLICY IF EXISTS "Limpiadoras pueden actualizar sus reportes" ON public.task_reports;

CREATE POLICY "Usuarios autorizados pueden actualizar reportes"
ON public.task_reports
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = ANY (ARRAY['admin'::app_role, 'manager'::app_role, 'supervisor'::app_role])
  )
  OR EXISTS (
    SELECT 1 FROM public.cleaners c
    WHERE c.user_id = auth.uid()
      AND c.id = task_reports.cleaner_id
  )
);