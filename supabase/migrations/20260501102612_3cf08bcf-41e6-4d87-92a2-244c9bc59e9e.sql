
DROP FUNCTION IF EXISTS public.get_client_portal_settings(uuid);

CREATE OR REPLACE FUNCTION public.get_client_portal_settings(_client_id uuid)
RETURNS TABLE(
  client_id uuid,
  allow_reservation_creation boolean,
  allow_extraordinary_requests boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id, allow_reservation_creation, allow_extraordinary_requests
  FROM public.clients
  WHERE id = _client_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_client_portal_settings(uuid) TO anon, authenticated;
