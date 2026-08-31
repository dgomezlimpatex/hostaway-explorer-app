
-- 1. Add photos_visible_to_client to clients table (default false, opt-in)
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS photos_visible_to_client BOOLEAN NOT NULL DEFAULT false;

-- 2. Add last_admin_access_at to client_portal_access for audit
ALTER TABLE public.client_portal_access
ADD COLUMN IF NOT EXISTS last_admin_access_at TIMESTAMP WITH TIME ZONE;

-- 3. RLS policy: anonymous read of task_reports for client portal
-- Conditions: portal active for the client + task belongs to client + report completed + photos enabled
DROP POLICY IF EXISTS "Client portal can view completed task reports" ON public.task_reports;
CREATE POLICY "Client portal can view completed task reports"
ON public.task_reports
FOR SELECT
TO anon, authenticated
USING (
  overall_status = 'completed'
  AND EXISTS (
    SELECT 1
    FROM public.tasks t
    JOIN public.clients c ON c.id = t.cliente_id
    JOIN public.client_portal_access cpa ON cpa.client_id = c.id
    WHERE t.id = task_reports.task_id
      AND c.photos_visible_to_client = true
      AND cpa.is_active = true
  )
);

-- 4. RLS policy: anonymous read of task_media via valid task_report
DROP POLICY IF EXISTS "Client portal can view task media of completed reports" ON public.task_media;
CREATE POLICY "Client portal can view task media of completed reports"
ON public.task_media
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.task_reports tr
    JOIN public.tasks t ON t.id = tr.task_id
    JOIN public.clients c ON c.id = t.cliente_id
    JOIN public.client_portal_access cpa ON cpa.client_id = c.id
    WHERE tr.id = task_media.task_report_id
      AND tr.overall_status = 'completed'
      AND c.photos_visible_to_client = true
      AND cpa.is_active = true
  )
);

-- 5. RLS policy: anonymous read of tasks for client portal
-- Allows the portal to fetch external tasks (Avantio/Hostaway/recurring/batch) belonging to client properties
DROP POLICY IF EXISTS "Client portal can view their tasks" ON public.tasks;
CREATE POLICY "Client portal can view their tasks"
ON public.tasks
FOR SELECT
TO anon, authenticated
USING (
  cliente_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.client_portal_access cpa
    WHERE cpa.client_id = tasks.cliente_id
      AND cpa.is_active = true
  )
);
