-- Activation ONLY after production authorization and deployment of laundry-receipts.
-- Provision vault secret laundry_receipts_recovery_service_role separately, without
-- putting the value in this file, terminal output or Git. No historical cron changed.
DO $$
DECLARE job bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name='laundry_receipts_recovery_service_role' AND length(decrypted_secret)>20) THEN
    RAISE EXCEPTION 'Configura primero el secreto privado de recuperación en Vault';
  END IF;
  FOR job IN SELECT jobid FROM cron.job WHERE jobname='laundry-receipt-email-recovery' LOOP
    PERFORM cron.unschedule(job);
  END LOOP;
  PERFORM cron.schedule('laundry-receipt-email-recovery','*/5 * * * *',$command$
    SELECT net.http_post(
      url:='https://qyipyygojlfhdghnraus.supabase.co/functions/v1/laundry-receipts',
      headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='laundry_receipts_recovery_service_role' LIMIT 1)),
      body:='{"action":"drain"}'::jsonb
    );
  $command$);
END $$;
