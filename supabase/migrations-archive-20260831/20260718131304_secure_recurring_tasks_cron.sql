-- Sustituye el cron histórico por autenticación de menor privilegio.
-- Precondiciones operativas, configuradas fuera del repositorio:
--   1. Vault `recurring_tasks_cron_bearer`: JWT anon vigente del proyecto.
--   2. Vault `recurring_tasks_cron_secret`: secreto aleatorio dedicado.
--   3. Edge secret `RECURRING_TASKS_CRON_SECRET`: mismo valor dedicado.
--
-- Si falta cualquier secreto de Vault, la migración aborta antes de retirar
-- el job anterior. El valor descifrado se consulta en cada ejecución y nunca
-- queda incrustado en cron.job ni en esta migración.

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM vault.decrypted_secrets
    WHERE name = 'recurring_tasks_cron_bearer'
      AND decrypted_secret IS NOT NULL
      AND decrypted_secret <> ''
  ) THEN
    RAISE EXCEPTION 'Missing Vault secret: recurring_tasks_cron_bearer';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM vault.decrypted_secrets
    WHERE name = 'recurring_tasks_cron_secret'
      AND decrypted_secret IS NOT NULL
      AND decrypted_secret <> ''
  ) THEN
    RAISE EXCEPTION 'Missing Vault secret: recurring_tasks_cron_secret';
  END IF;

  FOR v_job_id IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'process-recurring-tasks-daily'
  LOOP
    PERFORM cron.unschedule(v_job_id);
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'process-recurring-tasks-daily',
  '0 6 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://qyipyygojlfhdghnraus.supabase.co/functions/v1/process-recurring-tasks',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'recurring_tasks_cron_bearer'
        LIMIT 1
      ),
      'X-Cron-Secret', (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'recurring_tasks_cron_secret'
        LIMIT 1
      )
    ),
    body := '{"source":"cron"}'::jsonb
  );
  $cron$
);
