CREATE OR REPLACE FUNCTION public.manage_avirato_cron_job(
  job_name text,
  cron_schedule text,
  function_url text,
  auth_header text,
  request_body text,
  job_timezone text DEFAULT 'Europe/Madrid'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  job_id bigint;
  utc_cron text;
  parts text[];
  local_hour int;
  summer_hour int;
  winter_hour int;
  hour_expression text;
BEGIN
  PERFORM cron.unschedule(jobname)
  FROM cron.job
  WHERE jobname = job_name;

  parts := string_to_array(cron_schedule, ' ');
  IF array_length(parts, 1) >= 2 AND job_timezone = 'Europe/Madrid' THEN
    local_hour := parts[2]::int;
    summer_hour := (local_hour + 22) % 24;
    winter_hour := (local_hour + 23) % 24;

    IF summer_hour = winter_hour THEN
      hour_expression := summer_hour::text;
    ELSIF summer_hour < winter_hour THEN
      hour_expression := summer_hour::text || ',' || winter_hour::text;
    ELSE
      hour_expression := winter_hour::text || ',' || summer_hour::text;
    END IF;

    parts[2] := hour_expression;
    utc_cron := array_to_string(parts, ' ');
  ELSE
    utc_cron := cron_schedule;
  END IF;

  SELECT cron.schedule(
    job_name,
    utc_cron,
    format(
      'SELECT net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb);',
      function_url,
      auth_header,
      request_body
    )
  )
  INTO job_id;

  RETURN jsonb_build_object(
    'success', true,
    'job_id', job_id,
    'job_name', job_name,
    'local_schedule', cron_schedule,
    'utc_schedule', utc_cron,
    'timezone', job_timezone
  );
END;
$function$;

DO $$
DECLARE
  existing_job record;
BEGIN
  FOR existing_job IN
    SELECT jobname FROM cron.job WHERE jobname LIKE 'avirato_sync_%'
  LOOP
    PERFORM cron.unschedule(existing_job.jobname);
  END LOOP;
END $$;

UPDATE public.avirato_sync_schedules
SET is_active = false
WHERE name LIKE 'Sincronizacion Avirato%';

DELETE FROM public.avirato_sync_schedules
WHERE name = 'Sincronizacion Avirato piloto'
  AND is_active = false;

INSERT INTO public.avirato_sync_schedules (name, hour, minute, timezone, is_active)
SELECT 'Sincronizacion Avirato 09:00', 9, 0, 'Europe/Madrid', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.avirato_sync_schedules WHERE name = 'Sincronizacion Avirato 09:00'
);

INSERT INTO public.avirato_sync_schedules (name, hour, minute, timezone, is_active)
SELECT 'Sincronizacion Avirato 14:00', 14, 0, 'Europe/Madrid', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.avirato_sync_schedules WHERE name = 'Sincronizacion Avirato 14:00'
);

INSERT INTO public.avirato_sync_schedules (name, hour, minute, timezone, is_active)
SELECT 'Sincronizacion Avirato 20:00', 20, 0, 'Europe/Madrid', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.avirato_sync_schedules WHERE name = 'Sincronizacion Avirato 20:00'
);

UPDATE public.avirato_sync_schedules
SET hour = 9, minute = 0, timezone = 'Europe/Madrid', is_active = true
WHERE name = 'Sincronizacion Avirato 09:00';

UPDATE public.avirato_sync_schedules
SET hour = 14, minute = 0, timezone = 'Europe/Madrid', is_active = true
WHERE name = 'Sincronizacion Avirato 14:00';

UPDATE public.avirato_sync_schedules
SET hour = 20, minute = 0, timezone = 'Europe/Madrid', is_active = true
WHERE name = 'Sincronizacion Avirato 20:00';
