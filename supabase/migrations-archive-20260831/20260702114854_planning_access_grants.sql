REVOKE ALL ON public.planning_settings FROM anon;
REVOKE ALL ON public.planning_runs FROM anon;
REVOKE ALL ON public.planning_run_items FROM anon;
REVOKE ALL ON public.planning_conflicts FROM anon;
REVOKE ALL ON public.planning_notification_batches FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning_settings TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning_runs TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning_run_items TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning_conflicts TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning_notification_batches TO authenticated, service_role;
