-- Fix all tasks that have completed reports but task status is not 'completed'
UPDATE tasks 
SET status = 'completed', updated_at = now()
WHERE id IN (
  SELECT t.id 
  FROM tasks t 
  JOIN task_reports tr ON tr.task_id = t.id 
  WHERE tr.overall_status = 'completed' AND t.status != 'completed'
);