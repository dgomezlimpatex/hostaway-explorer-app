-- Keep the cron payload explicit. The edge function also accepts a legacy
-- source-only payload for backwards compatibility, but new schedules should
-- state the reconciliation action directly.

CREATE OR REPLACE FUNCTION public.configure_laundry_classic_cron(p_service_role_key TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, cron, pg_temp
AS $function$
DECLARE
  existing_job_name TEXT;
  project_url CONSTANT TEXT := 'https://qyipyygojlfhdghnraus.supabase.co';
BEGIN
  IF p_service_role_key IS NULL OR length(p_service_role_key) < 20 THEN
    RAISE EXCEPTION 'service role key invalida';
  END IF;

  DELETE FROM vault.secrets
  WHERE name = 'laundry_classic_cron_service_role';

  PERFORM vault.create_secret(
    p_service_role_key,
    'laundry_classic_cron_service_role',
    'Service role usada solo por pg_cron para sincronizar enlaces clasicos'
  );

  FOR existing_job_name IN
    SELECT jobname FROM cron.job
    WHERE jobname = 'laundry-classic-link-sync'
  LOOP
    PERFORM cron.unschedule(existing_job_name);
  END LOOP;

  PERFORM cron.schedule(
    'laundry-classic-link-sync',
    '*/15 * * * *',
    format($command$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            SELECT decrypted_secret
            FROM vault.decrypted_secrets
            WHERE name = 'laundry_classic_cron_service_role'
            LIMIT 1
          )
        ),
        body := '{"action":"reconcile","source":"cron"}'::jsonb
      );
    $command$, project_url || '/functions/v1/manage-laundry-classic-links')
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.configure_laundry_classic_cron(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.configure_laundry_classic_cron(TEXT) TO service_role;
