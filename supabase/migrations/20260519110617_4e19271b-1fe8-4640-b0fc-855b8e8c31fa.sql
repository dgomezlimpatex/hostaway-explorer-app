
-- Soporte multi-habitación y reservas sin habitación asignada
ALTER TABLE public.lh_reservations
  ADD COLUMN IF NOT EXISTS rooms text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS needs_room_assignment boolean NOT NULL DEFAULT false;

-- Backfill rooms desde room (excluyendo "-" y formato concatenado viejo)
UPDATE public.lh_reservations
SET rooms = CASE
  WHEN room IS NULL OR room = '' OR room = '-' THEN '{}'::text[]
  WHEN room ~ 'Habitación.*Habitación' OR room ILIKE '%(+%Más%' THEN '{}'::text[]
  ELSE ARRAY[room]
END,
needs_room_assignment = (room IS NULL OR room = '' OR room = '-' OR room ~ 'Habitación.*Habitación' OR room ILIKE '%(+%Más%')
WHERE TRUE;

CREATE INDEX IF NOT EXISTS idx_lh_reservations_rooms ON public.lh_reservations USING GIN (rooms);
CREATE INDEX IF NOT EXISTS idx_lh_reservations_needs_assignment ON public.lh_reservations (needs_room_assignment) WHERE needs_room_assignment = true;

-- lh_reservation_tasks: añadir lh_room y nuevo unique compuesto
ALTER TABLE public.lh_reservation_tasks
  ADD COLUMN IF NOT EXISTS lh_room text NOT NULL DEFAULT '';

-- Drop old unique constraint if present, recreate including lh_room
DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c
  FROM pg_constraint
  WHERE conrelid = 'public.lh_reservation_tasks'::regclass
    AND contype = 'u'
    AND pg_get_constraintdef(oid) ILIKE '%(reservation_id, service_kind, task_date)%';
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.lh_reservation_tasks DROP CONSTRAINT %I', c);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.lh_reservation_tasks'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) ILIKE '%(reservation_id, lh_room, service_kind, task_date)%'
  ) THEN
    ALTER TABLE public.lh_reservation_tasks
      ADD CONSTRAINT lh_reservation_tasks_unique_per_room
      UNIQUE (reservation_id, lh_room, service_kind, task_date);
  END IF;
END$$;
