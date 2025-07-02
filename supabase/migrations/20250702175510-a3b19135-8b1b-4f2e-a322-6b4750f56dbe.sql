-- Corregir las políticas RLS de tasks para trabajadores
-- La política actual compara cleaner_id con auth.uid() incorrectamente
-- Necesitamos verificar a través de la tabla cleaners

-- Eliminar las políticas existentes
DROP POLICY IF EXISTS "Users can view tasks based on role" ON public.tasks;
DROP POLICY IF EXISTS "Users can update tasks based on role" ON public.tasks;

-- Crear nuevas políticas correctas
CREATE POLICY "Users can view tasks based on role" 
ON public.tasks 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'supervisor'::app_role) OR 
  (has_role(auth.uid(), 'cleaner'::app_role) AND 
   cleaner_id IN (
     SELECT id FROM public.cleaners WHERE user_id = auth.uid()
   ))
);

CREATE POLICY "Users can update tasks based on role" 
ON public.tasks 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'supervisor'::app_role) OR 
  (has_role(auth.uid(), 'cleaner'::app_role) AND 
   cleaner_id IN (
     SELECT id FROM public.cleaners WHERE user_id = auth.uid()
   ))
);