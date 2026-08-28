-- PIN access for the route_v2 laundry workflow only.
-- The PIN remains sourced from REGISTRO through cleaners.pin. Route access
-- stores a one-way hash and never exposes it through the Data API.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE public.laundry_route_workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id UUID NOT NULL UNIQUE REFERENCES public.cleaners(id) ON DELETE CASCADE,
  sede_id UUID NOT NULL REFERENCES public.sedes(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'repartidor' CHECK (role = 'repartidor'),
  pin_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  source TEXT NOT NULL DEFAULT 'registro' CHECK (source = 'registro'),
  last_access_at TIMESTAMPTZ,
  pin_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_laundry_route_workers_sede_active
  ON public.laundry_route_workers(sede_id, is_active);

CREATE TABLE public.laundry_route_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_worker_id UUID NOT NULL REFERENCES public.laundry_route_workers(id) ON DELETE CASCADE,
  share_link_id UUID NOT NULL REFERENCES public.laundry_share_links(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_laundry_route_sessions_lookup
  ON public.laundry_route_sessions(token_hash, share_link_id)
  WHERE revoked_at IS NULL;

CREATE INDEX idx_laundry_route_sessions_worker
  ON public.laundry_route_sessions(route_worker_id, expires_at);

CREATE TABLE public.laundry_route_access_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_link_id UUID REFERENCES public.laundry_share_links(id) ON DELETE SET NULL,
  route_worker_id UUID REFERENCES public.laundry_route_workers(id) ON DELETE SET NULL,
  ip_fingerprint TEXT,
  successful BOOLEAN NOT NULL DEFAULT false,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_laundry_route_access_attempts_rate_limit
  ON public.laundry_route_access_attempts(share_link_id, ip_fingerprint, attempted_at DESC);

CREATE TABLE public.laundry_route_worker_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_link_id UUID REFERENCES public.laundry_share_links(id) ON DELETE SET NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  route_worker_id UUID REFERENCES public.laundry_route_workers(id) ON DELETE SET NULL,
  worker_name TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('login', 'logout', 'prepare', 'issue', 'collect', 'deliver')),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_laundry_route_worker_events_link_created
  ON public.laundry_route_worker_events(share_link_id, created_at DESC);

ALTER TABLE public.laundry_bag_preparations
  ADD COLUMN IF NOT EXISTS prepared_by_worker_id UUID REFERENCES public.cleaners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS issue_by_worker_id UUID REFERENCES public.cleaners(id) ON DELETE SET NULL;

ALTER TABLE public.laundry_delivery_tracking
  ADD COLUMN IF NOT EXISTS collected_by_worker_id UUID REFERENCES public.cleaners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivered_by_worker_id UUID REFERENCES public.cleaners(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.hash_laundry_route_worker_pin()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  source_pin TEXT;
BEGIN
  SELECT NULLIF(trim(c.pin), '') INTO source_pin
  FROM public.cleaners c
  WHERE c.id = NEW.cleaner_id;

  IF source_pin IS NULL THEN
    RAISE EXCEPTION 'ROUTE_WORKER_REQUIRES_REGISTRO_PIN';
  END IF;

  NEW.pin_hash := extensions.crypt(source_pin, extensions.gen_salt('bf', 10));
  NEW.pin_synced_at := now();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER hash_laundry_route_worker_pin_before_write
  BEFORE INSERT OR UPDATE OF cleaner_id ON public.laundry_route_workers
  FOR EACH ROW EXECUTE FUNCTION public.hash_laundry_route_worker_pin();

CREATE OR REPLACE FUNCTION public.touch_laundry_route_worker_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER touch_laundry_route_worker_updated_at_before_update
  BEFORE UPDATE ON public.laundry_route_workers
  FOR EACH ROW EXECUTE FUNCTION public.touch_laundry_route_worker_updated_at();

CREATE OR REPLACE FUNCTION public.sync_laundry_route_worker_pin_from_cleaner()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.pin IS NOT DISTINCT FROM OLD.pin
     AND NEW.is_active IS NOT DISTINCT FROM OLD.is_active THEN
    RETURN NEW;
  END IF;

  IF NEW.is_active = false OR NULLIF(trim(NEW.pin), '') IS NULL THEN
    UPDATE public.laundry_route_workers
    SET is_active = false,
        updated_at = now()
    WHERE cleaner_id = NEW.id;
  ELSIF NEW.pin IS DISTINCT FROM OLD.pin THEN
    UPDATE public.laundry_route_workers
    SET pin_hash = extensions.crypt(trim(NEW.pin), extensions.gen_salt('bf', 10)),
        pin_synced_at = now(),
        updated_at = now()
    WHERE cleaner_id = NEW.id;
  END IF;

  UPDATE public.laundry_route_sessions s
  SET revoked_at = now()
  FROM public.laundry_route_workers rw
  WHERE rw.cleaner_id = NEW.id
    AND s.route_worker_id = rw.id
    AND s.revoked_at IS NULL;

  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_laundry_route_worker_pin_after_cleaner_update
  AFTER UPDATE OF pin, is_active ON public.cleaners
  FOR EACH ROW EXECUTE FUNCTION public.sync_laundry_route_worker_pin_from_cleaner();

CREATE OR REPLACE FUNCTION public.verify_laundry_route_worker_pin(
  _route_worker_id UUID,
  _pin TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.laundry_route_workers rw
    WHERE rw.id = _route_worker_id
      AND rw.is_active = true
      AND rw.pin_hash = extensions.crypt(trim(_pin), rw.pin_hash)
  );
$$;

REVOKE ALL ON FUNCTION public.verify_laundry_route_worker_pin(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_laundry_route_worker_pin(UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.verify_laundry_route_worker_pin(UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.verify_laundry_route_worker_pin(UUID, TEXT) TO service_role;

ALTER TABLE public.laundry_route_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laundry_route_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laundry_route_access_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laundry_route_worker_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can view route worker events"
  ON public.laundry_route_worker_events FOR SELECT TO authenticated
  USING (public.user_is_admin_or_manager());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.laundry_route_workers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.laundry_route_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.laundry_route_access_attempts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.laundry_route_worker_events TO service_role;
GRANT SELECT ON public.laundry_route_worker_events TO authenticated;

COMMENT ON TABLE public.laundry_route_workers IS
  'REGISTRO workers explicitly enabled as route_v2 repartidores.';
COMMENT ON COLUMN public.laundry_route_workers.pin_hash IS
  'One-way hash derived from cleaners.pin. The source PIN remains REGISTRO.';
COMMENT ON TABLE public.laundry_route_sessions IS
  'Short-lived access sessions scoped to one route_v2 share link.';
