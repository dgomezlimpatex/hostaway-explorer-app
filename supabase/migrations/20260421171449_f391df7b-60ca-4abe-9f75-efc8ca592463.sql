UPDATE public.avantio_sync_logs
SET status = 'failed',
    sync_completed_at = now(),
    errors = ARRAY['Cerrado retroactivamente: Edge Function agotó CPU antes de finalizar']
WHERE status = 'running'
  AND sync_started_at < now() - interval '5 minutes';