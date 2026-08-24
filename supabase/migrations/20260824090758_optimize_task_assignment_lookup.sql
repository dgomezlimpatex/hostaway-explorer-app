-- The assignment guard validates overlaps by cleaner. The existing unique
-- index starts with task_id, which is ideal for task reads but forces a scan
-- when checking all active tasks for one cleaner.
CREATE INDEX IF NOT EXISTS idx_task_assignments_cleaner_task
  ON public.task_assignments (cleaner_id, task_id);

-- Keep the legacy task-level assignment fallback fast when the planning guard
-- checks a worker's active schedule for a date and time window.
CREATE INDEX IF NOT EXISTS idx_tasks_cleaner_date_active_time
  ON public.tasks (cleaner_id, date, start_time, end_time)
  WHERE status NOT IN ('completed', 'cancelled')
    AND cleaner_id IS NOT NULL;
