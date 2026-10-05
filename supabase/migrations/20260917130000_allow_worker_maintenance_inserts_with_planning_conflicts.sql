-- Allow creating a new weekly maintenance block even when assigned tasks overlap.
-- Availability restrictions (unavailability) and all other guards remain.
CREATE OR REPLACE FUNCTION public.guard_worker_maintenance_planning_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  pairs jsonb := '[]';
BEGIN
  -- Preserve the existing classification-only exception: changing only
  -- schedule_type does not change anyone's availability.
  IF TG_OP = 'UPDATE' AND
     (to_jsonb(NEW) - 'schedule_type' - 'updated_at') IS NOT DISTINCT FROM
     (to_jsonb(OLD) - 'schedule_type' - 'updated_at')
  THEN
    RETURN NEW;
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    pairs := pairs || jsonb_build_array(jsonb_build_object('cleaner_id', OLD.cleaner_id));
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    pairs := pairs || jsonb_build_array(jsonb_build_object('cleaner_id', NEW.cleaner_id));
  END IF;
  PERFORM public.planning_lock_worker_dates(pairs);

  -- Creating a new maintenance block is explicitly allowed even when assigned
  -- tasks overlap the weekly window. Availability restrictions stay guarded.
  IF TG_OP = 'INSERT' AND NEW.schedule_type = 'maintenance' THEN
    RETURN NEW;
  END IF;

  -- Editing an existing maintenance block is explicitly allowed. The form does
  -- not change cleaner_id; direct owner changes and inactive blocks stay guarded.
  IF TG_OP = 'UPDATE'
     AND NEW.cleaner_id = OLD.cleaner_id
     AND OLD.schedule_type = 'maintenance'
     AND NEW.schedule_type = 'maintenance'
     AND OLD.is_active
  THEN
    RETURN NEW;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.is_active AND EXISTS(
    SELECT 1
    FROM public.task_assignments ta
    JOIN public.tasks t ON t.id = ta.task_id
    WHERE ta.cleaner_id = NEW.cleaner_id
      AND t.status NOT IN ('completed', 'cancelled')
      AND t.date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Madrid')::date
      AND extract(dow FROM t.date)::int = ANY(NEW.days_of_week)
      AND t.start_time < NEW.end_time
      AND NEW.start_time < t.end_time
  ) THEN
    RAISE EXCEPTION 'PLANNING_MAINTENANCE_CONFLICT' USING ERRCODE = '23514';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;
