-- ============================================================
-- Auditoría de cambios en reservas del portal del cliente
-- ============================================================
-- Amplía la tabla client_reservation_logs para registrar quién
-- realizó cada cambio (cliente o administrador), añade índices
-- y restringe la lectura del histórico a administradores.
-- ============================================================

-- 1. Nuevas columnas para identificar al actor del cambio
ALTER TABLE public.client_reservation_logs
  ADD COLUMN IF NOT EXISTS actor_type TEXT
    CHECK (actor_type IN ('client', 'admin', 'manager', 'system')),
  ADD COLUMN IF NOT EXISTS actor_user_id UUID,
  ADD COLUMN IF NOT EXISTS actor_name TEXT,
  ADD COLUMN IF NOT EXISTS actor_email TEXT,
  ADD COLUMN IF NOT EXISTS property_id UUID,
  ADD COLUMN IF NOT EXISTS property_name TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. Índices para acelerar la consulta del historial por cliente y fecha
CREATE INDEX IF NOT EXISTS idx_client_reservation_logs_client_created
  ON public.client_reservation_logs (client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_reservation_logs_reservation
  ON public.client_reservation_logs (reservation_id);

-- 3. Reforzar las políticas RLS:
--    - Solo admin / manager pueden ver el histórico autenticado.
--    - El portal anónimo (vía PIN) sigue pudiendo INSERTAR logs cuando
--      el portal del cliente está activo, pero NO puede leerlos.
--    - Se elimina la política permisiva "Users can view all logs"
--      que dejaba los logs visibles para cualquier usuario autenticado.

DROP POLICY IF EXISTS "Users can view all logs" ON public.client_reservation_logs;
DROP POLICY IF EXISTS "Anonymous can view logs via portal" ON public.client_reservation_logs;
DROP POLICY IF EXISTS "Admins and managers can view reservation logs"
  ON public.client_reservation_logs;
DROP POLICY IF EXISTS "Admins and managers can update reservation logs"
  ON public.client_reservation_logs;
DROP POLICY IF EXISTS "Admins and managers can delete reservation logs"
  ON public.client_reservation_logs;

CREATE POLICY "Admins and managers can view reservation logs"
  ON public.client_reservation_logs
  FOR SELECT
  TO authenticated
  USING (public.user_is_admin_or_manager());

-- Bloquear UPDATE / DELETE: el histórico es inmutable.
CREATE POLICY "Reservation logs are immutable (no updates)"
  ON public.client_reservation_logs
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Reservation logs are immutable (no deletes)"
  ON public.client_reservation_logs
  FOR DELETE
  TO authenticated
  USING (false);

-- 4. Comentarios descriptivos (útiles en el dashboard de Supabase)
COMMENT ON TABLE public.client_reservation_logs IS
  'Histórico inmutable de cambios sobre reservas del portal del cliente. Solo visible para admins/managers.';
COMMENT ON COLUMN public.client_reservation_logs.actor_type IS
  'Origen del cambio: client (PIN del portal), admin / manager (panel interno) o system.';
COMMENT ON COLUMN public.client_reservation_logs.actor_user_id IS
  'auth.uid() del usuario interno que realizó el cambio. NULL para acciones del cliente vía PIN.';
COMMENT ON COLUMN public.client_reservation_logs.actor_name IS
  'Nombre legible del actor (cliente o usuario admin) para mostrar en el histórico.';

-- 5. RPC para que el admin obtenga el histórico ya enriquecido
--    (evita N+1 al pedir nombre de propiedad / cliente desde el frontend).
CREATE OR REPLACE FUNCTION public.get_client_reservation_history(
  _client_id UUID,
  _limit INT DEFAULT 200,
  _offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  reservation_id UUID,
  client_id UUID,
  client_name TEXT,
  property_id UUID,
  property_name TEXT,
  property_code TEXT,
  action TEXT,
  actor_type TEXT,
  actor_user_id UUID,
  actor_name TEXT,
  actor_email TEXT,
  old_data JSONB,
  new_data JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Solo admin / manager pueden acceder al histórico
  IF NOT public.user_is_admin_or_manager() THEN
    RAISE EXCEPTION 'No tienes permisos para consultar el histórico de reservas';
  END IF;

  IF _client_id IS NULL THEN
    RAISE EXCEPTION 'client_id es requerido';
  END IF;

  RETURN QUERY
  SELECT
    l.id,
    l.reservation_id,
    l.client_id,
    c.nombre AS client_name,
    COALESCE(l.property_id, r.property_id, NULLIF((l.new_data->>'propertyId'),'')::uuid, NULLIF((l.old_data->>'propertyId'),'')::uuid) AS property_id,
    COALESCE(
      l.property_name,
      p.nombre,
      l.new_data->>'propertyName',
      l.old_data->>'propertyName'
    ) AS property_name,
    p.codigo AS property_code,
    l.action,
    l.actor_type,
    l.actor_user_id,
    l.actor_name,
    l.actor_email,
    l.old_data,
    l.new_data,
    l.notes,
    l.created_at
  FROM public.client_reservation_logs l
  LEFT JOIN public.clients c ON c.id = l.client_id
  LEFT JOIN public.client_reservations r ON r.id = l.reservation_id
  LEFT JOIN public.properties p
    ON p.id = COALESCE(
        l.property_id,
        r.property_id,
        NULLIF((l.new_data->>'propertyId'),'')::uuid,
        NULLIF((l.old_data->>'propertyId'),'')::uuid
      )
  WHERE l.client_id = _client_id
  ORDER BY l.created_at DESC
  LIMIT GREATEST(_limit, 1)
  OFFSET GREATEST(_offset, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.get_client_reservation_history(UUID, INT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_client_reservation_history(UUID, INT, INT) TO authenticated;