-- Nuevo sistema de ruta v2 para lavanderia.
-- Este fichero no modifica la gestion clasica ni sus tablas de seguimiento.

ALTER TABLE public.laundry_bag_preparations
  ADD COLUMN IF NOT EXISTS content_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS snapshot_locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS route_novelty_type TEXT NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS route_novelty_resolved BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS route_delivery_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS route_collection_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by_name TEXT,
  ADD COLUMN IF NOT EXISTS undone_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS undone_by_name TEXT,
  ADD COLUMN IF NOT EXISTS undone_reason TEXT,
  ADD COLUMN IF NOT EXISTS route_last_seen_signature TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'laundry_bag_preparations_route_novelty_type_check'
  ) THEN
    ALTER TABLE public.laundry_bag_preparations
      ADD CONSTRAINT laundry_bag_preparations_route_novelty_type_check
      CHECK (route_novelty_type IN (
        'normal', 'new', 'changed', 'carryover',
        'cancelled_before', 'cancelled_after', 'undone'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'laundry_bag_preparations_route_delivery_status_check'
  ) THEN
    ALTER TABLE public.laundry_bag_preparations
      ADD CONSTRAINT laundry_bag_preparations_route_delivery_status_check
      CHECK (route_delivery_status IN ('pending', 'delivered'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'laundry_bag_preparations_route_collection_status_check'
  ) THEN
    ALTER TABLE public.laundry_bag_preparations
      ADD CONSTRAINT laundry_bag_preparations_route_collection_status_check
      CHECK (route_collection_status IN ('pending', 'collected'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_laundry_bag_preparations_route_novelty
  ON public.laundry_bag_preparations(route_novelty_resolved, route_novelty_type);

CREATE INDEX IF NOT EXISTS idx_laundry_bag_preparations_route_delivery
  ON public.laundry_bag_preparations(route_delivery_status, route_collection_status);

CREATE TABLE IF NOT EXISTS public.laundry_route_v2_bag_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_link_id UUID NOT NULL REFERENCES public.laundry_share_links(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  delivery_date DATE NOT NULL,
  task_signature TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  snapshot_locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT laundry_route_v2_bag_snapshots_link_task_unique UNIQUE (share_link_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_laundry_route_v2_bag_snapshots_link
  ON public.laundry_route_v2_bag_snapshots(share_link_id, delivery_date);

DROP TRIGGER IF EXISTS update_laundry_route_v2_bag_snapshots_updated_at
  ON public.laundry_route_v2_bag_snapshots;

CREATE TRIGGER update_laundry_route_v2_bag_snapshots_updated_at
  BEFORE UPDATE ON public.laundry_route_v2_bag_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.laundry_route_v2_bag_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and managers can view route v2 bag snapshots"
  ON public.laundry_route_v2_bag_snapshots;

CREATE POLICY "Admins and managers can view route v2 bag snapshots"
  ON public.laundry_route_v2_bag_snapshots
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (
      public.has_role(auth.uid(), 'manager'::public.app_role)
      AND EXISTS (
        SELECT 1
        FROM public.laundry_share_links link
        WHERE link.id = share_link_id
          AND (link.sede_id IS NULL OR public.user_has_sede_access(auth.uid(), link.sede_id))
      )
    )
  );

GRANT SELECT ON public.laundry_route_v2_bag_snapshots TO authenticated;
GRANT ALL ON public.laundry_route_v2_bag_snapshots TO service_role;

CREATE TABLE IF NOT EXISTS public.laundry_route_v2_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id UUID REFERENCES public.sedes(id) ON DELETE SET NULL,
  share_link_id UUID REFERENCES public.laundry_share_links(id) ON DELETE SET NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  delivery_date DATE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'route_created', 'route_refreshed', 'task_added', 'task_changed',
    'task_removed', 'task_cancelled', 'bag_prepared', 'bag_issue',
    'bag_undo', 'bag_no_carry', 'critical_block', 'admin_authorized'
  )),
  novelty_type TEXT CHECK (novelty_type IS NULL OR novelty_type IN (
    'normal', 'new', 'changed', 'carryover',
    'cancelled_before', 'cancelled_after', 'undone'
  )),
  property_code TEXT,
  event_key TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT laundry_route_v2_events_event_key_unique UNIQUE (event_key)
);

CREATE INDEX IF NOT EXISTS idx_laundry_route_v2_events_route
  ON public.laundry_route_v2_events(share_link_id, delivery_date, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_laundry_route_v2_events_unresolved
  ON public.laundry_route_v2_events(sede_id, event_type, created_at DESC);

ALTER TABLE public.laundry_route_v2_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and managers can view route v2 events"
  ON public.laundry_route_v2_events;

CREATE POLICY "Admins and managers can view route v2 events"
  ON public.laundry_route_v2_events
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (
      public.has_role(auth.uid(), 'manager'::public.app_role)
      AND (sede_id IS NULL OR public.user_has_sede_access(auth.uid(), sede_id))
    )
  );

GRANT SELECT ON public.laundry_route_v2_events TO authenticated;
GRANT ALL ON public.laundry_route_v2_events TO service_role;

CREATE TABLE IF NOT EXISTS public.laundry_route_v2_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id UUID REFERENCES public.sedes(id) ON DELETE SET NULL,
  share_link_id UUID REFERENCES public.laundry_share_links(id) ON DELETE SET NULL,
  delivery_date DATE NOT NULL,
  reason TEXT NOT NULL CHECK (length(trim(reason)) >= 3),
  affected_task_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_laundry_route_v2_authorizations_route
  ON public.laundry_route_v2_authorizations(share_link_id, delivery_date, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_laundry_route_v2_active_link
  ON public.laundry_share_links(sede_id, delivery_date)
  WHERE auto_managed = true
    AND is_active = true
    AND workflow_version = 'route_v2';

ALTER TABLE public.laundry_route_v2_authorizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and managers can view route v2 authorizations"
  ON public.laundry_route_v2_authorizations;

CREATE POLICY "Admins and managers can view route v2 authorizations"
  ON public.laundry_route_v2_authorizations
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (
      public.has_role(auth.uid(), 'manager'::public.app_role)
      AND (sede_id IS NULL OR public.user_has_sede_access(auth.uid(), sede_id))
    )
  );

GRANT SELECT ON public.laundry_route_v2_authorizations TO authenticated;
GRANT ALL ON public.laundry_route_v2_authorizations TO service_role;

-- El cron v2 se configura de forma explicita despues de revisar y desplegar.
-- Nunca toca el cron de enlaces clasicos.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.configure_laundry_route_v2_cron(p_service_role_key TEXT)
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
  WHERE name = 'laundry_route_v2_cron_service_role';

  PERFORM vault.create_secret(
    p_service_role_key,
    'laundry_route_v2_cron_service_role',
    'Service role usada solo por pg_cron para sincronizar el nuevo sistema de ruta'
  );

  FOR existing_job_name IN
    SELECT jobname FROM cron.job
    WHERE jobname = 'laundry-route-v2-sync'
  LOOP
    PERFORM cron.unschedule(existing_job_name);
  END LOOP;

  PERFORM cron.schedule(
    'laundry-route-v2-sync',
    '*/15 * * * *',
    format($command$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            SELECT decrypted_secret
            FROM vault.decrypted_secrets
            WHERE name = 'laundry_route_v2_cron_service_role'
            LIMIT 1
          )
        ),
        body := '{"action":"reconcile","source":"cron"}'::jsonb
      );
    $command$, project_url || '/functions/v1/manage-laundry-route-v2-links')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.configure_laundry_route_v2_cron(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.configure_laundry_route_v2_cron(TEXT) TO service_role;

COMMENT ON TABLE public.laundry_route_v2_bag_snapshots IS
  'Contenido congelado de cada bolsa del nuevo sistema de ruta.';
COMMENT ON TABLE public.laundry_route_v2_events IS
  'Novedades y auditoria del nuevo sistema de ruta, separado del enlace clasico.';
COMMENT ON TABLE public.laundry_route_v2_authorizations IS
  'Autorizaciones auditadas para continuar una ruta v2 incompleta.';
