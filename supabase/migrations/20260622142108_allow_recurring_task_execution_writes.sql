GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_task_executions TO authenticated;

DROP POLICY IF EXISTS "Users can insert executions for their accessible sedes"
ON public.recurring_task_executions;

CREATE POLICY "Users can insert executions for their accessible sedes"
ON public.recurring_task_executions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.recurring_tasks rt
    WHERE rt.id = recurring_task_id
      AND rt.sede_id = ANY(public.get_user_accessible_sedes())
  )
);

DROP POLICY IF EXISTS "Users can update executions for their accessible sedes"
ON public.recurring_task_executions;

CREATE POLICY "Users can update executions for their accessible sedes"
ON public.recurring_task_executions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.recurring_tasks rt
    WHERE rt.id = recurring_task_id
      AND rt.sede_id = ANY(public.get_user_accessible_sedes())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.recurring_tasks rt
    WHERE rt.id = recurring_task_id
      AND rt.sede_id = ANY(public.get_user_accessible_sedes())
  )
);

DROP POLICY IF EXISTS "Users can delete executions for their accessible sedes"
ON public.recurring_task_executions;

CREATE POLICY "Users can delete executions for their accessible sedes"
ON public.recurring_task_executions
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.recurring_tasks rt
    WHERE rt.id = recurring_task_id
      AND rt.sede_id = ANY(public.get_user_accessible_sedes())
  )
);
