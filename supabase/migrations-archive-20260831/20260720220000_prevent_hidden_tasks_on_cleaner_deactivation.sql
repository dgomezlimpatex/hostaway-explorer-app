-- Impide que cualquier ruta de UI, integración o script marque como inactiva
-- una trabajadora que todavía conserva tareas futuras pendientes.
-- La RPC canónica de baja desasigna primero y solo entonces actualiza cleaners.

CREATE OR REPLACE FUNCTION public.prevent_cleaner_deactivation_with_future_tasks()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.is_active = true
     AND NEW.is_active = false
     AND EXISTS (
       SELECT 1
       FROM public.tasks t
       WHERE t.date >= (now() AT TIME ZONE 'Europe/Madrid')::date
         AND coalesce(t.status, 'pending') NOT IN ('completed', 'cancelled')
         AND (
           EXISTS (
             SELECT 1
             FROM public.task_assignments ta
             WHERE ta.task_id = t.id
               AND ta.cleaner_id = OLD.id
           )
           OR t.cleaner_id = OLD.id
           OR (
             t.cleaner_id IS NULL
             AND t.cleaner = OLD.name
           )
         )
     ) THEN
    RAISE EXCEPTION 'No se puede desactivar a la trabajadora mientras tenga tareas futuras pendientes. Usa el flujo de baja para desasignarlas.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cleaners_prevent_unsafe_deactivation ON public.cleaners;
CREATE TRIGGER cleaners_prevent_unsafe_deactivation
BEFORE UPDATE OF is_active ON public.cleaners
FOR EACH ROW
EXECUTE FUNCTION public.prevent_cleaner_deactivation_with_future_tasks();

COMMENT ON FUNCTION public.prevent_cleaner_deactivation_with_future_tasks() IS
  'Bloquea bajas directas que dejarían tareas futuras ligadas a una trabajadora inactiva.';
