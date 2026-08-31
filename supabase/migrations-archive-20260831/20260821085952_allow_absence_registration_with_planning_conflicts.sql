-- An absence is an operational input for coverage planning. It must be
-- possible to register it even when the worker still has assigned tasks.
-- The planning engine will then surface those assignments for replacement.
CREATE OR REPLACE FUNCTION public.guard_worker_absence_planning_write()
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

  -- Do not reject the absence because of existing assignments. Registering
  -- the absence first is required to calculate and approve substitutions.
  RETURN COALESCE(NEW, OLD);
END;
$function$;

REVOKE ALL ON FUNCTION public.guard_worker_absence_planning_write() FROM PUBLIC, anon, authenticated;
