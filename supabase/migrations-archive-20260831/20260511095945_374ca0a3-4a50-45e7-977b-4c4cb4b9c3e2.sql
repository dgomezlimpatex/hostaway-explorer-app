CREATE POLICY "Admins managers supervisors pueden subir media"
ON public.task_media
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = ANY (ARRAY['admin'::app_role, 'manager'::app_role, 'supervisor'::app_role])
  )
);

CREATE POLICY "Admins managers supervisors pueden actualizar media"
ON public.task_media
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = ANY (ARRAY['admin'::app_role, 'manager'::app_role, 'supervisor'::app_role])
  )
);