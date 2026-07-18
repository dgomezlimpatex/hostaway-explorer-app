-- Hostaway is currently a dormant integration.
-- Preserve its tables, data and implementation, but prevent accidental execution.

UPDATE public.hostaway_sync_schedules
SET
  is_active = false,
  updated_at = now()
WHERE is_active IS DISTINCT FROM false;

DO $$
DECLARE
  hostaway_job RECORD;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_extension
    WHERE extname = 'pg_cron'
  ) THEN
    FOR hostaway_job IN
      SELECT jobid
      FROM cron.job
      WHERE jobname ILIKE 'hostaway%'
         OR command ILIKE '%/hostaway-%'
         OR command ILIKE '%hostaway_sync%'
    LOOP
      PERFORM cron.unschedule(hostaway_job.jobid);
    END LOOP;
  END IF;
END;
$$;

-- Keep the schedule archive readable, but prevent API roles from reactivating it.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.hostaway_sync_schedules
  FROM PUBLIC, anon, authenticated, service_role;

-- Keep the RPC implementations archived, but make them unavailable to API roles.
REVOKE ALL ON FUNCTION public.manage_hostaway_cron_job(text, text, text, text, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.list_hostaway_cron_jobs()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.delete_hostaway_cron_job(text)
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON TABLE public.hostaway_sync_schedules IS
  'Dormant Hostaway integration. Preserved for possible future clients; schedules must remain inactive until an explicit reactivation project.';
