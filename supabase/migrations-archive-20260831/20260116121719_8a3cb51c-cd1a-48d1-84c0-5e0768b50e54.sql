
-- Actualizar tareas de LAURA YANETH URIBE ARCILA para vincular el cleaner_id correcto
UPDATE tasks 
SET cleaner_id = '8f67b412-3d94-4bda-ba1f-e0d60795646b',
    updated_at = now()
WHERE cleaner ILIKE '%LAURA YANETH%' 
  AND cleaner_id IS NULL;

-- También crear los task_assignments correspondientes si no existen
INSERT INTO task_assignments (task_id, cleaner_id, cleaner_name, assigned_at)
SELECT 
  t.id,
  '8f67b412-3d94-4bda-ba1f-e0d60795646b',
  'LAURA YANETH URIBE ARCILA',
  now()
FROM tasks t
WHERE t.cleaner ILIKE '%LAURA YANETH%'
  AND NOT EXISTS (
    SELECT 1 FROM task_assignments ta 
    WHERE ta.task_id = t.id 
      AND ta.cleaner_id = '8f67b412-3d94-4bda-ba1f-e0d60795646b'
  );
