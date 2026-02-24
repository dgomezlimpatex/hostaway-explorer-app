
-- Fix tasks that have reports but were never marked as completed (dates before today)
UPDATE public.tasks 
SET status = 'completed', updated_at = now()
WHERE status != 'completed'
AND date < '2026-02-24'
AND EXISTS (SELECT 1 FROM public.task_reports tr WHERE tr.task_id = tasks.id);

-- Also fix the report status to match
UPDATE public.task_reports 
SET overall_status = 'completed', updated_at = now()
WHERE overall_status != 'completed'
AND EXISTS (
  SELECT 1 FROM public.tasks t 
  WHERE t.id = task_reports.task_id 
  AND t.date < '2026-02-24'
);
