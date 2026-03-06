-- Fix existing tasks that have multiple assignments but only show one cleaner name
UPDATE tasks t
SET cleaner = sub.all_names
FROM (
  SELECT task_id, string_agg(cleaner_name, ', ' ORDER BY created_at) as all_names
  FROM task_assignments
  GROUP BY task_id
  HAVING count(*) > 1
) sub
WHERE t.id = sub.task_id
AND t.cleaner != sub.all_names;