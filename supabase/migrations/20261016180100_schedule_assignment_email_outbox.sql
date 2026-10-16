-- Programa el envío de la cola de correos de asignación cada minuto.
-- Mismo mecanismo y secreto que los procesos de WhatsApp. Se aplica solo
-- después de desplegar y probar `process-assignment-email-outbox`.
SELECT cron.schedule(
  'assignment-email-outbox-process',
  '* * * * *',
  $cron$
    SELECT net.http_post(
      url := 'https://qyipyygojlfhdghnraus.supabase.co/functions/v1/process-assignment-email-outbox',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'whatsapp_notification_cron_service_role'
          LIMIT 1
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 55000
    );
  $cron$
);
