-- Explicit internal database context, without changing Supabase JWT parameters.
-- PostgreSQL restores this function-local setting on return and exception.
BEGIN;
ALTER FUNCTION public.complete_scheduled_laundry_bag(uuid,timestamptz)
 SET laundry.scheduled_completion = 'on';

CREATE OR REPLACE FUNCTION public.guard_route_v2_tracking_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE route_v2_action boolean;
BEGIN
 SELECT EXISTS(SELECT 1 FROM public.laundry_share_links link
  WHERE link.id=NEW.share_link_id AND link.workflow_version='route_v2') INTO route_v2_action;
 IF TG_OP='UPDATE' THEN
  route_v2_action:=route_v2_action OR EXISTS(SELECT 1 FROM public.laundry_share_links link
   WHERE link.id=OLD.share_link_id AND link.workflow_version='route_v2');
 END IF;
 IF route_v2_action AND auth.role() IS DISTINCT FROM 'service_role'
 AND NOT (session_user='postgres'
  AND coalesce(current_setting('laundry.scheduled_completion',true),'')='on') THEN
  RAISE EXCEPTION 'Route v2 delivery status can only be changed by the route server';
 END IF;
 RETURN NEW;
END $$;
-- session_user is the database connection identity, not the SECURITY DEFINER
-- owner. API clients cannot gain access by setting the marker themselves.

-- Retry only the known, fully rolled-back integration failure, using all existing
-- task, preparation, route, stock and idempotency checks on the next cron tick.
UPDATE public.laundry_scheduled_completions
 SET status='pending',finished_at=NULL,detail=NULL
 WHERE status='blocked'
 AND detail='Route v2 delivery status can only be changed by the route server'
 AND delivery_date >= (now() AT TIME ZONE 'Europe/Madrid')::date;
COMMIT;
