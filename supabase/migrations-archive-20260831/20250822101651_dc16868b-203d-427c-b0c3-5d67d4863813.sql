-- Actualizar la política RLS para que los cleaners puedan ver propiedades de sus tareas
-- sin importar si están autenticados o no (para el caso de Daniel patata)
DROP POLICY IF EXISTS "Cleaners can view properties for their tasks in assigned sedes" ON public.properties;

CREATE POLICY "Cleaners can view properties for their tasks" 
ON public.properties 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM cleaners c
    JOIN tasks t ON (t.cleaner_id = c.id)
    WHERE t.propiedad_id = properties.id 
    AND (
      -- Si el cleaner tiene user_id, debe coincidir con el usuario autenticado
      (c.user_id IS NOT NULL AND c.user_id = auth.uid())
      OR 
      -- Si el cleaner no tiene user_id, permitir acceso por nombre (compatibilidad)
      (c.user_id IS NULL)
    )
  )
);