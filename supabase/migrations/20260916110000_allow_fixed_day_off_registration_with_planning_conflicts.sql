-- A fixed day off is an operational planning constraint. Register it even
-- when existing assignments still fall on that weekday so the planning UI can
-- surface and resolve those assignments instead of hiding the rule.
CREATE OR REPLACE FUNCTION public.guard_worker_fixed_day_off_planning_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  pairs jsonb := '[]';
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    pairs := pairs || jsonb_build_array(jsonb_build_object('cleaner_id', OLD.cleaner_id));
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    pairs := pairs || jsonb_build_array(jsonb_build_object('cleaner_id', NEW.cleaner_id));
  END IF;

  PERFORM public.planning_lock_worker_dates(pairs);

  -- Do not reject the fixed day off because of existing assignments. The
  -- constraint must be recorded first so planning can resolve those tasks.
  RETURN COALESCE(NEW, OLD);
END;
$function$;

REVOKE ALL ON FUNCTION public.guard_worker_fixed_day_off_planning_write() FROM PUBLIC, anon, authenticated;
