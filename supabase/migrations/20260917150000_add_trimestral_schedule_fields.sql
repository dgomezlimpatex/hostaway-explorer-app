-- Campos opcionales de horario para pases no diarios y con horizonte propio.
-- days_of_week NULL = todos los días (comportamiento de los pases actuales).
-- days_ahead / task_horizon_days NULL = usar el default del código (30 días).
ALTER TABLE public.avantio_sync_schedules
  ADD COLUMN IF NOT EXISTS days_of_week text,
  ADD COLUMN IF NOT EXISTS days_ahead integer,
  ADD COLUMN IF NOT EXISTS task_horizon_days integer;

ALTER TABLE public.avantio_sync_schedules
  DROP CONSTRAINT IF EXISTS avantio_sync_schedules_days_of_week_check;
ALTER TABLE public.avantio_sync_schedules
  ADD CONSTRAINT avantio_sync_schedules_days_of_week_check
  CHECK (days_of_week IS NULL OR days_of_week ~ '^[0-6](,[0-6])*$');

ALTER TABLE public.avantio_sync_schedules
  DROP CONSTRAINT IF EXISTS avantio_sync_schedules_days_ahead_check;
ALTER TABLE public.avantio_sync_schedules
  ADD CONSTRAINT avantio_sync_schedules_days_ahead_check
  CHECK (days_ahead IS NULL OR days_ahead BETWEEN 1 AND 400);

ALTER TABLE public.avantio_sync_schedules
  DROP CONSTRAINT IF EXISTS avantio_sync_schedules_task_horizon_days_check;
ALTER TABLE public.avantio_sync_schedules
  ADD CONSTRAINT avantio_sync_schedules_task_horizon_days_check
  CHECK (task_horizon_days IS NULL OR task_horizon_days BETWEEN 1 AND 400);

-- Pase trimestral: lunes(1), miércoles(3) y viernes(5) a las 09:05 Madrid.
-- 92 días = 3 meses, tanto de lectura como de creación de la tarea de check-out.
-- El minuto 5 evita arrancar en el mismo minuto que el pase diario de las 08:00
-- UTC, cuya guarda de concurrencia rechazaría una segunda sincronización.
INSERT INTO public.avantio_sync_schedules
  (name, hour, minute, timezone, is_active, days_of_week, days_ahead, task_horizon_days)
SELECT 'Trimestral L/X/V 09:00', 9, 5, 'Europe/Madrid', true, '1,3,5', 92, 92
WHERE NOT EXISTS (
  SELECT 1 FROM public.avantio_sync_schedules WHERE name = 'Trimestral L/X/V 09:00'
);
