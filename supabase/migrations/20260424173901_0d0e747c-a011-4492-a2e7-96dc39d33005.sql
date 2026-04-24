
-- 1) Marcar como failed los syncs colgados actuales (>30 min running)
UPDATE public.avantio_sync_logs
SET 
  status = 'failed',
  sync_completed_at = now(),
  errors = COALESCE(errors, ARRAY[]::text[]) || ARRAY['Cerrado automáticamente: sync sin actividad por más de 30 minutos (probable interrupción del worker)']
WHERE status = 'running'
  AND sync_started_at < now() - interval '30 minutes';

-- 2) Función watchdog para cerrar syncs colgados periódicamente
CREATE OR REPLACE FUNCTION public.close_stale_avantio_syncs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.avantio_sync_logs
  SET 
    status = 'failed',
    sync_completed_at = now(),
    errors = COALESCE(errors, ARRAY[]::text[]) || ARRAY['Cerrado automáticamente por watchdog: sync sin actividad por más de 30 minutos']
  WHERE status = 'running'
    AND sync_started_at < now() - interval '30 minutes';
END;
$$;

-- 3) Programar watchdog cada 15 minutos
SELECT cron.unschedule('avantio_sync_watchdog') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'avantio_sync_watchdog');

SELECT cron.schedule(
  'avantio_sync_watchdog',
  '*/15 * * * *',
  $$ SELECT public.close_stale_avantio_syncs(); $$
);
