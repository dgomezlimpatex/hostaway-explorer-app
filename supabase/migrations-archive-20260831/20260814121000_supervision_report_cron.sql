-- Configuración segura del cron de informes de supervisión.
-- Se ejecuta cada 15 minutos para respetar el horario Europe/Madrid y el DST;
-- la Edge Function solo envía durante la ventana de las 19:00.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.configure_supervision_report_cron(p_service_role_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, cron, pg_temp
AS $$
DECLARE
  existing_job_id bigint;
  project_url constant text := 'https://qyipyygojlfhdghnraus.supabase.co';
BEGIN
  IF p_service_role_key IS NULL OR length(p_service_role_key) < 20 THEN
    RAISE EXCEPTION 'service role key invalida';
  END IF;

  DELETE FROM vault.secrets WHERE name = 'supervision_report_cron_service_role';
  PERFORM vault.create_secret(p_service_role_key, 'supervision_report_cron_service_role', 'Service role usada solo por el cron de informes de supervisión');

  FOR existing_job_id IN SELECT jobid FROM cron.job WHERE jobname = 'supervision-daily-report' LOOP
    PERFORM cron.unschedule(existing_job_id);
  END LOOP;

  PERFORM cron.schedule(
    'supervision-daily-report',
    '*/15 * * * *',
    format($command$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supervision_report_cron_service_role' LIMIT 1)
        ),
        body := '{}'::jsonb
      );
    $command$, project_url || '/functions/v1/send-supervision-daily-report')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.configure_supervision_report_cron(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.configure_supervision_report_cron(text) TO service_role;
