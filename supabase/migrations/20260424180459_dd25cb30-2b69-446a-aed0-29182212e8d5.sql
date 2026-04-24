UPDATE public.avantio_sync_logs
SET status = 'failed',
    sync_completed_at = now(),
    errors = COALESCE(errors, ARRAY[]::text[]) || ARRAY['CPU Time exceeded — worker matado por consumo de CPU']
WHERE status = 'running';