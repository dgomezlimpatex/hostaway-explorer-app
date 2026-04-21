
-- Helper: check if a task is accessible from an active client portal with photos enabled
CREATE OR REPLACE FUNCTION public.is_task_visible_to_client_portal(_task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tasks t
    JOIN public.clients c ON c.id = t.cliente_id
    JOIN public.client_portal_access cpa ON cpa.client_id = c.id
    WHERE t.id = _task_id
      AND c.photos_visible_to_client = true
      AND cpa.is_active = true
  );
$$;

-- Replace task_reports portal SELECT policy with one that uses the SECURITY DEFINER helper
DROP POLICY IF EXISTS "Client portal can view completed task reports" ON public.task_reports;
CREATE POLICY "Client portal can view completed task reports"
ON public.task_reports
FOR SELECT
USING (
  overall_status = 'completed'::report_status
  AND public.is_task_visible_to_client_portal(task_id)
);

-- Replace task_media portal SELECT policy with the same helper
DROP POLICY IF EXISTS "Client portal can view task media of completed reports" ON public.task_media;
CREATE POLICY "Client portal can view task media of completed reports"
ON public.task_media
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.task_reports tr
    WHERE tr.id = task_media.task_report_id
      AND tr.overall_status = 'completed'::report_status
      AND public.is_task_visible_to_client_portal(tr.task_id)
  )
);
