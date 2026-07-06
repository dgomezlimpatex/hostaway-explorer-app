CREATE OR REPLACE FUNCTION public.get_task_assignment_counts(_task_ids uuid[])
RETURNS TABLE(task_id uuid, assignment_count integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ta.task_id,
    count(*)::integer AS assignment_count
  FROM public.task_assignments ta
  WHERE ta.task_id = ANY(coalesce(_task_ids, '{}'::uuid[]))
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'manager'::public.app_role)
      OR public.has_role(auth.uid(), 'supervisor'::public.app_role)
      OR EXISTS (
        SELECT 1
        FROM public.task_assignments own_ta
        JOIN public.cleaners c ON c.id = own_ta.cleaner_id
        WHERE own_ta.task_id = ta.task_id
          AND c.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.tasks t
        JOIN public.cleaners c ON c.id = t.cleaner_id
        WHERE t.id = ta.task_id
          AND c.user_id = auth.uid()
      )
    )
  GROUP BY ta.task_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_task_assignment_counts(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_task_assignment_counts(uuid[]) TO service_role;
