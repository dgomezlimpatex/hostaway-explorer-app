-- SOLUCIÓN CRÍTICA: Crear accesos de sede para usuarios existentes

-- 1. Dar acceso a todas las sedes activas para los usuarios admin
INSERT INTO public.user_sede_access (user_id, sede_id, can_access)
SELECT DISTINCT ur.user_id, s.id, true
FROM public.user_roles ur
CROSS JOIN public.sedes s
WHERE ur.role = 'admin'
  AND s.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM public.user_sede_access usa 
    WHERE usa.user_id = ur.user_id 
    AND usa.sede_id = s.id
  );

-- 2. Dar acceso a su sede específica para todos los limpiadores existentes
INSERT INTO public.user_sede_access (user_id, sede_id, can_access)
SELECT DISTINCT c.user_id, c.sede_id, true
FROM public.cleaners c
WHERE c.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.user_sede_access usa 
    WHERE usa.user_id = c.user_id 
    AND usa.sede_id = c.sede_id
  );

-- 3. Dar acceso a todas las sedes para managers
INSERT INTO public.user_sede_access (user_id, sede_id, can_access)
SELECT DISTINCT ur.user_id, s.id, true
FROM public.user_roles ur
CROSS JOIN public.sedes s
WHERE ur.role = 'manager'
  AND s.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM public.user_sede_access usa 
    WHERE usa.user_id = ur.user_id 
    AND usa.sede_id = s.id
  );

-- 4. Crear función trigger para asignar automáticamente acceso de sede cuando se cre un cleaner
CREATE OR REPLACE FUNCTION public.handle_new_cleaner()
RETURNS TRIGGER AS $$
BEGIN
  -- Si el cleaner tiene user_id y sede_id, crear acceso automáticamente
  IF NEW.user_id IS NOT NULL AND NEW.sede_id IS NOT NULL THEN
    INSERT INTO public.user_sede_access (user_id, sede_id, can_access)
    VALUES (NEW.user_id, NEW.sede_id, true)
    ON CONFLICT (user_id, sede_id) DO UPDATE SET
      can_access = true,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Crear trigger para ejecutar la función
DROP TRIGGER IF EXISTS trigger_handle_new_cleaner ON public.cleaners;
CREATE TRIGGER trigger_handle_new_cleaner
  AFTER INSERT OR UPDATE ON public.cleaners
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_cleaner();

-- 6. Mejorar la función RLS para que los cleaners puedan ver sus tareas sin importar RLS de sede
CREATE OR REPLACE FUNCTION public.user_can_access_task(task_sede_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    -- Admin puede ver todas las tareas
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'::app_role
    ) THEN true
    -- Manager puede ver todas las tareas
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'manager'::app_role
    ) THEN true
    -- Cleaner puede ver tareas de su sede (basado en su registro en cleaners)
    WHEN EXISTS (
      SELECT 1 FROM public.cleaners 
      WHERE user_id = auth.uid() AND sede_id = task_sede_id
    ) THEN true
    -- Para otros roles, verificar acceso explícito en user_sede_access
    ELSE EXISTS (
      SELECT 1 FROM public.user_sede_access 
      WHERE user_id = auth.uid() 
      AND sede_id = task_sede_id 
      AND can_access = true
    )
  END;
$$;