
-- Fix: portal anon RLS broken since client_portal_access lost anon SELECT.
-- Replace EXISTS subselects with SECURITY DEFINER helper.

CREATE OR REPLACE FUNCTION public.has_active_portal_access(_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_portal_access
    WHERE client_id = _client_id AND is_active = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_active_portal_access(uuid) TO anon, authenticated;

-- ============ tasks ============
DROP POLICY IF EXISTS "Anonymous can view tasks via client portal" ON public.tasks;
CREATE POLICY "Anonymous can view tasks via client portal"
  ON public.tasks FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.laundry_share_links lsl
      WHERE lsl.is_active = true
        AND (lsl.expires_at IS NULL OR lsl.expires_at > now())
        AND tasks.date >= lsl.date_start
        AND tasks.date <= lsl.date_end
    )
    OR (tasks.cliente_id IS NOT NULL AND public.has_active_portal_access(tasks.cliente_id))
  );

DROP POLICY IF EXISTS "Client portal can view their tasks" ON public.tasks;
CREATE POLICY "Client portal can view their tasks"
  ON public.tasks FOR SELECT TO anon, authenticated
  USING (cliente_id IS NOT NULL AND public.has_active_portal_access(cliente_id));

DROP POLICY IF EXISTS "Portal users can create tasks via client portal" ON public.tasks;
CREATE POLICY "Portal users can create tasks via client portal"
  ON public.tasks FOR INSERT TO anon, authenticated
  WITH CHECK (cliente_id IS NOT NULL AND public.has_active_portal_access(cliente_id));

DROP POLICY IF EXISTS "Portal users can update tasks via client portal" ON public.tasks;
CREATE POLICY "Portal users can update tasks via client portal"
  ON public.tasks FOR UPDATE TO anon, authenticated
  USING (cliente_id IS NOT NULL AND public.has_active_portal_access(cliente_id))
  WITH CHECK (cliente_id IS NOT NULL AND public.has_active_portal_access(cliente_id));

DROP POLICY IF EXISTS "Portal users can delete tasks via client portal" ON public.tasks;
CREATE POLICY "Portal users can delete tasks via client portal"
  ON public.tasks FOR DELETE TO anon, authenticated
  USING (cliente_id IS NOT NULL AND public.has_active_portal_access(cliente_id));

-- ============ properties ============
DROP POLICY IF EXISTS "Anonymous can view properties via client portal" ON public.properties;
CREATE POLICY "Anonymous can view properties via client portal"
  ON public.properties FOR SELECT TO anon
  USING (cliente_id IS NOT NULL AND public.has_active_portal_access(cliente_id));

-- ============ client_reservations ============
DROP POLICY IF EXISTS "Anonymous can view reservations via portal" ON public.client_reservations;
CREATE POLICY "Anonymous can view reservations via portal"
  ON public.client_reservations FOR SELECT TO anon
  USING (public.has_active_portal_access(client_id));

DROP POLICY IF EXISTS "Anonymous can create reservations via portal" ON public.client_reservations;
CREATE POLICY "Anonymous can create reservations via portal"
  ON public.client_reservations FOR INSERT TO anon
  WITH CHECK (public.has_active_portal_access(client_id));

DROP POLICY IF EXISTS "Anonymous can update reservations via portal" ON public.client_reservations;
CREATE POLICY "Anonymous can update reservations via portal"
  ON public.client_reservations FOR UPDATE TO anon
  USING (public.has_active_portal_access(client_id))
  WITH CHECK (public.has_active_portal_access(client_id));

-- ============ client_reservation_logs ============
DROP POLICY IF EXISTS "Anonymous can create logs via portal" ON public.client_reservation_logs;
CREATE POLICY "Anonymous can create logs via portal"
  ON public.client_reservation_logs FOR INSERT TO anon
  WITH CHECK (public.has_active_portal_access(client_id));
