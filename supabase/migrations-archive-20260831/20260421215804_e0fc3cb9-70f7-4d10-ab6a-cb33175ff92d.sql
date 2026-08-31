CREATE OR REPLACE FUNCTION public.get_client_portal_settings(_client_id uuid)
RETURNS TABLE(client_id uuid, allow_reservation_creation boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, allow_reservation_creation
  FROM public.clients
  WHERE id = _client_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_client_portal_settings(uuid) TO anon, authenticated;