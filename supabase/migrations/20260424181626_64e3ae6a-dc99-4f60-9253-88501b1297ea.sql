UPDATE public.avantio_sync_logs
SET status = 'failed',
    sync_completed_at = now(),
    errors = COALESCE(errors, ARRAY[]::text[]) || ARRAY['CPU Time exceeded — cerrado tras optimización de caché de reservas']
WHERE status = 'running';