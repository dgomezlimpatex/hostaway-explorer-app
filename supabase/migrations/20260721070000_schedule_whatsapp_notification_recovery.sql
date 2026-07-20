-- Recupera la programación operativa de WhatsApp que quedó fuera del ledger remoto.
-- No guarda credenciales en Git: service_role configura un secreto cifrado en Vault.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.configure_whatsapp_notification_cron(p_service_role_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  existing_job_id bigint;
  project_url constant text := 'https://qyipyygojlfhdghnraus.supabase.co';
BEGIN
  IF p_service_role_key IS NULL OR length(p_service_role_key) < 20 THEN
    RAISE EXCEPTION 'service role key invalida' USING ERRCODE = '22023';
  END IF;

  DELETE FROM vault.secrets
  WHERE name = 'whatsapp_notification_cron_service_role';

  PERFORM vault.create_secret(
    p_service_role_key,
    'whatsapp_notification_cron_service_role',
    'Service role usada solo por pg_cron para notificaciones WhatsApp'
  );

  FOR existing_job_id IN
    SELECT jobid
    FROM cron.job
    WHERE jobname IN (
      'whatsapp-remind-unapproved',
      'whatsapp-remind-late-start',
      'whatsapp-process-pending'
    )
  LOOP
    PERFORM cron.unschedule(existing_job_id);
  END LOOP;

  PERFORM cron.schedule(
    'whatsapp-remind-unapproved',
    '*/15 * * * *',
    format($command$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            SELECT decrypted_secret
            FROM vault.decrypted_secrets
            WHERE name = 'whatsapp_notification_cron_service_role'
            LIMIT 1
          )
        ),
        body := '{}'::jsonb
      );
    $command$, project_url || '/functions/v1/remind-unapproved-tasks')
  );

  PERFORM cron.schedule(
    'whatsapp-remind-late-start',
    '*/5 * * * *',
    format($command$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            SELECT decrypted_secret
            FROM vault.decrypted_secrets
            WHERE name = 'whatsapp_notification_cron_service_role'
            LIMIT 1
          )
        ),
        body := '{}'::jsonb
      );
    $command$, project_url || '/functions/v1/remind-late-start-tasks')
  );

  PERFORM cron.schedule(
    'whatsapp-process-pending',
    '*/2 * * * *',
    format($command$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            SELECT decrypted_secret
            FROM vault.decrypted_secrets
            WHERE name = 'whatsapp_notification_cron_service_role'
            LIMIT 1
          )
        ),
        body := '{}'::jsonb
      );
    $command$, project_url || '/functions/v1/process-pending-whatsapp-notifications')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.configure_whatsapp_notification_cron(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.configure_whatsapp_notification_cron(text) TO service_role;

CREATE OR REPLACE FUNCTION public.get_whatsapp_notification_cron_status()
RETURNS TABLE(jobname text, schedule text, active boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT job.jobname::text, job.schedule::text, job.active
  FROM cron.job AS job
  WHERE job.jobname IN (
    'whatsapp-remind-unapproved',
    'whatsapp-remind-late-start',
    'whatsapp-process-pending'
  )
  ORDER BY job.jobname;
$$;

REVOKE ALL ON FUNCTION public.get_whatsapp_notification_cron_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_notification_cron_status() TO service_role;
