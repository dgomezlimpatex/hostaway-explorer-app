-- Split an existing availability restriction into independently editable days.
-- Invoker permissions and existing table RLS, audit and conflict triggers apply.
CREATE OR REPLACE FUNCTION public.replace_worker_schedule_days(p_id uuid, p_entries jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE original public.worker_maintenance_cleanings%ROWTYPE;
  entry jsonb; selected_days integer[] := '{}'; day_value integer; position integer := 0;
BEGIN
  IF p_entries IS NULL OR jsonb_typeof(p_entries) <> 'array' OR jsonb_array_length(p_entries) NOT BETWEEN 1 AND 7 THEN
    RAISE EXCEPTION 'INVALID_SCHEDULE_DAYS';
  END IF;
  SELECT * INTO original FROM public.worker_maintenance_cleanings WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR original.schedule_type <> 'unavailability' THEN RAISE EXCEPTION 'SCHEDULE_NOT_EDITABLE'; END IF;
  FOR entry IN SELECT value FROM jsonb_array_elements(p_entries) LOOP
    IF jsonb_array_length(entry->'days_of_week') IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'INVALID_SCHEDULE_DAYS'; END IF;
    day_value := (entry->'days_of_week'->>0)::integer;
    IF day_value IS NULL OR day_value NOT BETWEEN 0 AND 6 OR day_value = ANY(selected_days) THEN RAISE EXCEPTION 'INVALID_SCHEDULE_DAYS'; END IF;
    selected_days := array_append(selected_days, day_value);
    IF position = 0 THEN
      UPDATE public.worker_maintenance_cleanings SET days_of_week=ARRAY[day_value],
        start_time=(entry->>'start_time')::time, end_time=(entry->>'end_time')::time,
        location_name=entry->>'location_name', notes=entry->>'notes'
      WHERE id=p_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'SCHEDULE_NOT_EDITABLE'; END IF;
    ELSE
      INSERT INTO public.worker_maintenance_cleanings(cleaner_id,days_of_week,start_time,end_time,location_name,notes,is_active,schedule_type,created_by)
      VALUES(original.cleaner_id,ARRAY[day_value],(entry->>'start_time')::time,(entry->>'end_time')::time,
        entry->>'location_name',entry->>'notes',original.is_active,'unavailability',auth.uid());
    END IF;
    position := position + 1;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.replace_worker_schedule_days(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replace_worker_schedule_days(uuid,jsonb) TO authenticated;
