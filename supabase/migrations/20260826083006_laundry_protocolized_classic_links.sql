-- Protocolized classic laundry links.
-- Existing links remain compatible. Only links marked auto_managed use the new
-- server-side reconciliation flow.

ALTER TABLE public.laundry_share_links
  ADD COLUMN IF NOT EXISTS delivery_date DATE,
  ADD COLUMN IF NOT EXISTS auto_managed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manual_excluded_task_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sync_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS sync_error TEXT;

UPDATE public.laundry_share_links
SET delivery_date = CASE
  WHEN (filters ->> 'deliveryDate') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    THEN (filters ->> 'deliveryDate')::date
  ELSE date_end
END
WHERE link_type = 'scheduled'
  AND COALESCE(workflow_version, 'legacy') <> 'route_v2'
  AND delivery_date IS NULL;

ALTER TABLE public.laundry_share_links
  DROP CONSTRAINT IF EXISTS laundry_share_links_sync_status_check;

ALTER TABLE public.laundry_share_links
  ADD CONSTRAINT laundry_share_links_sync_status_check
  CHECK (sync_status IN ('pending', 'ok', 'error'));

CREATE INDEX IF NOT EXISTS idx_laundry_share_links_managed_delivery
  ON public.laundry_share_links(sede_id, delivery_date)
  WHERE auto_managed = true AND is_active = true AND COALESCE(workflow_version, 'legacy') <> 'route_v2';

CREATE UNIQUE INDEX IF NOT EXISTS uq_laundry_share_links_managed_delivery
  ON public.laundry_share_links(sede_id, delivery_date)
  WHERE auto_managed = true AND is_active = true AND COALESCE(workflow_version, 'legacy') <> 'route_v2';

CREATE TABLE IF NOT EXISTS public.laundry_link_sync_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sede_id UUID REFERENCES public.sedes(id) ON DELETE SET NULL,
  share_link_id UUID REFERENCES public.laundry_share_links(id) ON DELETE SET NULL,
  delivery_date DATE NOT NULL,
  trigger TEXT NOT NULL CHECK (trigger IN ('cron', 'manual', 'on_open', 'create')),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('ok', 'error')),
  task_count INTEGER NOT NULL DEFAULT 0,
  added_count INTEGER NOT NULL DEFAULT 0,
  removed_count INTEGER NOT NULL DEFAULT 0,
  excluded_count INTEGER NOT NULL DEFAULT 0,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_laundry_link_sync_runs_lookup
  ON public.laundry_link_sync_runs(sede_id, delivery_date, completed_at DESC);

ALTER TABLE public.laundry_link_sync_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and managers can view laundry link sync runs"
  ON public.laundry_link_sync_runs;
CREATE POLICY "Admins and managers can view laundry link sync runs"
  ON public.laundry_link_sync_runs
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (
      public.has_role(auth.uid(), 'manager'::public.app_role)
      AND (sede_id IS NULL OR public.user_has_sede_access(auth.uid(), sede_id))
    )
  );

GRANT SELECT ON public.laundry_link_sync_runs TO authenticated;
GRANT ALL ON public.laundry_link_sync_runs TO service_role;

-- The owner of the route configuration is deliberately an email allow-list,
-- so being an admin is not enough to change delivery days or route order.
CREATE OR REPLACE FUNCTION public.is_laundry_route_owner()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) = 'dgomezlimpatex@gmail.com';
$$;

REVOKE ALL ON FUNCTION public.is_laundry_route_owner() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_laundry_route_owner() TO authenticated, service_role;

-- Delivery schedule and global route order are configuration, not an admin-
-- wide operational action.
DROP POLICY IF EXISTS "Admins and managers can manage delivery schedule"
  ON public.laundry_delivery_schedule;
CREATE POLICY "Route owner can manage delivery schedule"
  ON public.laundry_delivery_schedule
  FOR ALL
  TO authenticated
  USING (public.is_laundry_route_owner())
  WITH CHECK (public.is_laundry_route_owner());

DROP POLICY IF EXISTS "Admins and managers can manage classic laundry route order"
  ON public.laundry_classic_route_order;
CREATE POLICY "Route owner can manage classic laundry route order"
  ON public.laundry_classic_route_order
  FOR ALL
  TO authenticated
  USING (public.is_laundry_route_owner())
  WITH CHECK (public.is_laundry_route_owner());

-- Existing manually-created links stay editable for compatibility. New
-- auto-managed links can only be changed by the route owner or the service
-- role used by the reconciliation function.
DROP POLICY IF EXISTS "Admin and managers can manage share links"
  ON public.laundry_share_links;
CREATE POLICY "Admins and managers can view share links"
  ON public.laundry_share_links
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (
      public.has_role(auth.uid(), 'manager'::public.app_role)
      AND (sede_id IS NULL OR public.user_has_sede_access(auth.uid(), sede_id))
    )
  );

CREATE POLICY "Admins and managers can manage manual share links"
  ON public.laundry_share_links
  FOR ALL
  TO authenticated
  USING (
    public.is_laundry_route_owner()
    OR (
      (public.has_role(auth.uid(), 'admin'::public.app_role)
       OR public.has_role(auth.uid(), 'manager'::public.app_role))
      AND auto_managed = false
    )
  )
  WITH CHECK (
    public.is_laundry_route_owner()
    OR (
      (public.has_role(auth.uid(), 'admin'::public.app_role)
       OR public.has_role(auth.uid(), 'manager'::public.app_role))
      AND auto_managed = false
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.laundry_share_links TO authenticated;
GRANT ALL ON public.laundry_share_links TO service_role;

COMMENT ON COLUMN public.laundry_share_links.delivery_date IS
  'Fecha real de reparto local del enlace clasico.';
COMMENT ON COLUMN public.laundry_share_links.auto_managed IS
  'Indica que el enlace se reconcilia automaticamente y conserva su token.';
COMMENT ON COLUMN public.laundry_share_links.manual_excluded_task_ids IS
  'Tareas excluidas manualmente que nunca debe reintroducir la sincronizacion.';
COMMENT ON TABLE public.laundry_link_sync_runs IS
  'Auditoria de reconciliaciones automaticas de enlaces clasicos de lavanderia.';

-- Cron protected by Vault. The service role is supplied once by the operator
-- after deployment and is never stored in the repository or in plain text in
-- the cron command.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.configure_laundry_classic_cron(p_service_role_key TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, cron, pg_temp
AS $$
DECLARE
  existing_job_name TEXT;
  project_url CONSTANT TEXT := 'https://qyipyygojlfhdghnraus.supabase.co';
BEGIN
  IF p_service_role_key IS NULL OR length(p_service_role_key) < 20 THEN
    RAISE EXCEPTION 'service role key invalida';
  END IF;

  DELETE FROM vault.secrets
  WHERE name = 'laundry_classic_cron_service_role';

  PERFORM vault.create_secret(
    p_service_role_key,
    'laundry_classic_cron_service_role',
    'Service role usada solo por pg_cron para sincronizar enlaces clasicos'
  );

  FOR existing_job_name IN
    SELECT jobname FROM cron.job
    WHERE jobname = 'laundry-classic-link-sync'
  LOOP
    PERFORM cron.unschedule(existing_job_name);
  END LOOP;

  PERFORM cron.schedule(
    'laundry-classic-link-sync',
    '*/15 * * * *',
    format($command$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            SELECT decrypted_secret
            FROM vault.decrypted_secrets
            WHERE name = 'laundry_classic_cron_service_role'
            LIMIT 1
          )
        ),
        body := '{"action":"reconcile","source":"cron"}'::jsonb
      );
    $command$, project_url || '/functions/v1/manage-laundry-classic-links')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.configure_laundry_classic_cron(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.configure_laundry_classic_cron(TEXT) TO service_role;
