-- Keep the existing route-server guard and all client grants unchanged.
-- This postgres-only function needs the same request context as the route server.
-- PostgreSQL restores function SET configuration on both return and exception.
BEGIN;
ALTER FUNCTION public.complete_scheduled_laundry_bag(uuid,timestamptz)
 SET request.jwt.claim.role = 'service_role';

-- Retry only the known, fully rolled-back integration failure, using all existing
-- task, preparation, route, stock and idempotency checks on the next cron tick.
UPDATE public.laundry_scheduled_completions
 SET status='pending',finished_at=NULL,detail=NULL
 WHERE status='blocked'
 AND detail='Route v2 delivery status can only be changed by the route server'
 AND delivery_date >= (now() AT TIME ZONE 'Europe/Madrid')::date;
COMMIT;
