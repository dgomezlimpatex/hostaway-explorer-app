CREATE OR REPLACE FUNCTION public.manage_avantio_cron_job(job_name text, cron_schedule text, function_url text, auth_header text, request_body text, job_timezone text DEFAULT 'Europe/Madrid')
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  result JSONB;
  job_id BIGINT;
  sql_command TEXT;
  parts TEXT[];
  local_minute INT;
  local_hour INT;
  utc_time TIMESTAMPTZ;
  utc_hour INT;
  utc_minute INT;
  utc_cron TEXT;
BEGIN
  BEGIN
    PERFORM cron.unschedule(job_name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  -- Parse cron minute and hour to convert from local timezone to UTC
  parts := string_to_array(cron_schedule, ' ');
  local_minute := parts[1]::INT;
  local_hour := parts[2]::INT;
  
  -- Convert local time to UTC using PostgreSQL timezone handling
  utc_time := (('2026-01-01 ' || local_hour::TEXT || ':' || local_minute::TEXT || ':00')::TIMESTAMP 
               AT TIME ZONE job_timezone) AT TIME ZONE 'UTC';
  utc_hour := EXTRACT(HOUR FROM utc_time);
  utc_minute := EXTRACT(MINUTE FROM utc_time);
  
  utc_cron := utc_minute || ' ' || utc_hour || ' ' || array_to_string(parts[3:], ' ');
  
  sql_command := format(
    $sql$
    SELECT net.http_post(
      url := %L,
      headers := %L::jsonb,
      body := %L::jsonb
    ) as request_id;
    $sql$,
    function_url,
    auth_header,
    request_body
  );
  
  SELECT cron.schedule(job_name, utc_cron, sql_command) INTO job_id;
  
  result := jsonb_build_object(
    'success', true,
    'job_id', job_id,
    'job_name', job_name,
    'schedule', utc_cron,
    'local_schedule', cron_schedule,
    'timezone', job_timezone
  );
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    result := jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'detail', SQLSTATE
    );
    RETURN result;
END;
$function$;