-- Rollback operativo de las guardas globales de Planning 150.
-- Con los flags de Planning v2 apagados, calendario y planificación legacy deben
-- conservar los overrides manuales (avisos en UI, no bloqueos duros en BD).
-- apply_planning_batch mantiene sus validaciones transaccionales internas.

DROP TRIGGER IF EXISTS trg_task_assignments_planning_guard
  ON public.task_assignments;

DROP TRIGGER IF EXISTS trg_tasks_planning_schedule_guard
  ON public.tasks;

COMMENT ON FUNCTION public.guard_task_assignment_planning_write() IS
  'Guarda Planning 150 conservada sin trigger global; no bloquea writers legacy mientras v2 está OFF.';

COMMENT ON FUNCTION public.guard_task_schedule_planning_write() IS
  'Guarda Planning 150 conservada sin trigger global; no bloquea reprogramaciones legacy mientras v2 está OFF.';
