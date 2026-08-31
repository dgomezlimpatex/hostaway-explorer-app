
-- Tabla de log de accesos al portal del cliente
CREATE TABLE IF NOT EXISTS public.client_portal_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  portal_access_id UUID REFERENCES public.client_portal_access(id) ON DELETE SET NULL,
  access_type TEXT NOT NULL CHECK (access_type IN ('client_pin', 'admin_bypass')),
  actor_user_id UUID,
  actor_name TEXT,
  actor_email TEXT,
  user_agent TEXT,
  ip_address TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_portal_access_logs_client_id_created_at
  ON public.client_portal_access_logs (client_id, created_at DESC);

ALTER TABLE public.client_portal_access_logs ENABLE ROW LEVEL SECURITY;

-- Solo admin/manager pueden leer
CREATE POLICY "Admins/managers can view portal access logs"
  ON public.client_portal_access_logs
  FOR SELECT
  TO authenticated
  USING (public.user_is_admin_or_manager());

-- Inserts solo desde service_role (edge functions). Bloqueamos clients/anon.
CREATE POLICY "Service role can insert portal access logs"
  ON public.client_portal_access_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Permitir insertar desde el portal del cliente (anon) usando RPC dedicada
-- Mantenemos el INSERT cerrado y lo hacemos vía función SECURITY DEFINER.

-- RPC para registrar acceso (callable desde anon para PIN, y desde authenticated para admin)
CREATE OR REPLACE FUNCTION public.log_client_portal_access(
  _client_id UUID,
  _portal_access_id UUID,
  _access_type TEXT,
  _actor_user_id UUID DEFAULT NULL,
  _actor_name TEXT DEFAULT NULL,
  _actor_email TEXT DEFAULT NULL,
  _user_agent TEXT DEFAULT NULL,
  _metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id UUID;
BEGIN
  IF _client_id IS NULL THEN
    RAISE EXCEPTION 'client_id es requerido';
  END IF;
  IF _access_type NOT IN ('client_pin', 'admin_bypass') THEN
    RAISE EXCEPTION 'access_type inválido';
  END IF;

  INSERT INTO public.client_portal_access_logs (
    client_id, portal_access_id, access_type,
    actor_user_id, actor_name, actor_email,
    user_agent, ip_address, metadata
  ) VALUES (
    _client_id, _portal_access_id, _access_type,
    _actor_user_id, _actor_name, _actor_email,
    _user_agent, inet_client_addr()::text, COALESCE(_metadata, '{}'::jsonb)
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_client_portal_access(UUID, UUID, TEXT, UUID, TEXT, TEXT, TEXT, JSONB)
  TO anon, authenticated, service_role;

-- RPC para leer historial de accesos (solo admin/manager)
CREATE OR REPLACE FUNCTION public.get_client_portal_access_history(
  _client_id UUID,
  _limit INTEGER DEFAULT 200,
  _offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  client_id UUID,
  portal_access_id UUID,
  access_type TEXT,
  actor_user_id UUID,
  actor_name TEXT,
  actor_email TEXT,
  user_agent TEXT,
  ip_address TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.user_is_admin_or_manager() THEN
    RAISE EXCEPTION 'No tienes permisos para consultar el histórico de accesos';
  END IF;

  IF _client_id IS NULL THEN
    RAISE EXCEPTION 'client_id es requerido';
  END IF;

  RETURN QUERY
  SELECT
    l.id,
    l.client_id,
    l.portal_access_id,
    l.access_type::text,
    l.actor_user_id,
    l.actor_name::text,
    l.actor_email::text,
    l.user_agent::text,
    l.ip_address::text,
    l.metadata,
    l.created_at
  FROM public.client_portal_access_logs l
  WHERE l.client_id = _client_id
  ORDER BY l.created_at DESC
  LIMIT GREATEST(_limit, 1)
  OFFSET GREATEST(_offset, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_client_portal_access_history(UUID, INTEGER, INTEGER)
  TO authenticated;
