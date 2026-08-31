-- Actualizar la política RLS para permitir que los limpiadores vean tareas asignadas múltiplemente
DROP POLICY "Users can view tasks based on role" ON public.tasks;

CREATE POLICY "Users can view tasks based on role" ON public.tasks
FOR SELECT
TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'supervisor'::app_role) OR 
  (
    has_role(auth.uid(), 'cleaner'::app_role) AND 
    (
      -- Tarea asignada directamente al limpiador
      cleaner_id IN ( 
        SELECT cleaners.id 
        FROM cleaners 
        WHERE cleaners.user_id = auth.uid()
      ) OR
      -- Tarea asignada al limpiador mediante task_assignments
      id IN (
        SELECT ta.task_id 
        FROM task_assignments ta
        INNER JOIN cleaners c ON ta.cleaner_id = c.id
        WHERE c.user_id = auth.uid()
      )
    )
  )
);

-- Actualizar también la política de UPDATE para mantener consistencia
DROP POLICY "Users can update tasks based on role" ON public.tasks;

CREATE POLICY "Users can update tasks based on role" ON public.tasks
FOR UPDATE
TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'supervisor'::app_role) OR 
  (
    has_role(auth.uid(), 'cleaner'::app_role) AND 
    (
      -- Tarea asignada directamente al limpiador
      cleaner_id IN ( 
        SELECT cleaners.id 
        FROM cleaners 
        WHERE cleaners.user_id = auth.uid()
      ) OR
      -- Tarea asignada al limpiador mediante task_assignments
      id IN (
        SELECT ta.task_id 
        FROM task_assignments ta
        INNER JOIN cleaners c ON ta.cleaner_id = c.id
        WHERE c.user_id = auth.uid()
      )
    )
  )
);