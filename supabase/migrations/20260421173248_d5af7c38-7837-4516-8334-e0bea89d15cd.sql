UPDATE public.avantio_sync_logs
SET status = 'failed',
    sync_completed_at = now(),
    errors = COALESCE(errors, ARRAY[]::text[]) || ARRAY['Cerrado retroactivamente: WORKER_RESOURCE_LIMIT']
WHERE status = 'running'
  AND sync_started_at < now() - interval '5 minutes';