-- Corregir search_path en las funciones de cron para evitar warnings de seguridad

-- Recrear manage_hostaway_cron_job con search_path seguro
CREATE OR REPLACE FUNCTION public.manage_hostaway_cron_job(
  job_name text,
  cron_schedule text,
  function_url text,
  auth_header text,
  request_body text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result jsonb;
  job_id bigint;
BEGIN
  -- Primero, intentar desactivar el job si ya existe
  BEGIN
    PERFORM cron.unschedule(job_name);
    RAISE NOTICE 'Unscheduled existing job: %', job_name;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'No existing job to unschedule: %', job_name;
  END;
  
  -- Crear el nuevo cron job
  SELECT cron.schedule(
    job_name,
    cron_schedule,
    format(
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
    )
  ) INTO job_id;
  
  result := jsonb_build_object(
    'success', true,
    'job_id', job_id,
    'job_name', job_name,
    'schedule', cron_schedule
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
$$;

-- Recrear list_hostaway_cron_jobs con search_path seguro
CREATE OR REPLACE FUNCTION public.list_hostaway_cron_jobs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  jobs jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'jobid', jobid,
      'schedule', schedule,
      'command', command,
      'jobname', jobname,
      'active', active
    )
  )
  INTO jobs
  FROM cron.job
  WHERE jobname LIKE 'hostaway_sync_%';
  
  RETURN COALESCE(jobs, '[]'::jsonb);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Recrear delete_hostaway_cron_job con search_path seguro
CREATE OR REPLACE FUNCTION public.delete_hostaway_cron_job(job_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result jsonb;
BEGIN
  PERFORM cron.unschedule(job_name);
  
  result := jsonb_build_object(
    'success', true,
    'job_name', job_name,
    'message', 'Job unscheduled successfully'
  );
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    result := jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
    RETURN result;
END;
$$;