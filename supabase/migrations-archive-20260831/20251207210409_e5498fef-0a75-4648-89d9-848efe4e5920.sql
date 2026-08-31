-- Delete all hostaway cron jobs
DO $$
BEGIN
  -- Unschedule all hostaway sync cron jobs by jobid
  PERFORM cron.unschedule(48);
  PERFORM cron.unschedule(49);
  PERFORM cron.unschedule(50);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Some jobs may already be deleted: %', SQLERRM;
END;
$$;