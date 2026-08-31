-- Fix RLS policies for task_media to handle virtual task assignments
DROP POLICY IF EXISTS "Limpiadoras pueden subir media a sus reportes" ON task_media;
DROP POLICY IF EXISTS "Usuarios pueden ver media de reportes accesibles" ON task_media;

-- Create new policies that handle both regular and virtual task assignments
CREATE POLICY "Limpiadoras pueden subir media a sus reportes" 
ON task_media 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM task_reports tr
    JOIN cleaners c ON tr.cleaner_id = c.id
    JOIN user_roles ur ON c.user_id = ur.user_id
    WHERE tr.id = task_media.task_report_id 
    AND ur.user_id = auth.uid() 
    AND ur.role = 'cleaner'
  )
);

CREATE POLICY "Usuarios pueden ver media de reportes accesibles" 
ON task_media 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM task_reports tr
    JOIN user_roles ur ON ur.user_id = auth.uid()
    WHERE tr.id = task_media.task_report_id 
    AND (
      ur.role IN ('admin', 'manager', 'supervisor') 
      OR (
        ur.role = 'cleaner' 
        AND tr.cleaner_id IN (
          SELECT id FROM cleaners WHERE user_id = auth.uid()
        )
      )
    )
  )
);

-- Allow admins/managers to delete media
CREATE POLICY "Admins y managers pueden eliminar media" 
ON task_media 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 
    FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'manager')
  )
);