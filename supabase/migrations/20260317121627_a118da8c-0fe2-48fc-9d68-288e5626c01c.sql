-- Update manage_avantio_cron_job to support timezone
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
BEGIN
  BEGIN
    PERFORM cron.unschedule(job_name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
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
  
  SELECT cron.schedule(job_name, cron_schedule, sql_command) INTO job_id;
  
  -- Apply timezone to the job
  UPDATE cron.job SET nodename = job_timezone WHERE jobname = job_name;
  
  result := jsonb_build_object(
    'success', true,
    'job_id', job_id,
    'job_name', job_name,
    'schedule', cron_schedule,
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