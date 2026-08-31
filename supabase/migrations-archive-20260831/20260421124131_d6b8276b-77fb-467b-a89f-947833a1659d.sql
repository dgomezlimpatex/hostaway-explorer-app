-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anon portal can read client photo visibility" ON public.clients;

-- Create a SECURITY DEFINER function that only exposes the photos_visible_to_client flag
-- This is the secure pattern: no PII leak, only the flag the portal needs
CREATE OR REPLACE FUNCTION public.get_client_photos_visibility(_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(photos_visible_to_client, false)
  FROM public.clients
  WHERE id = _client_id
$$;

-- Allow anonymous (portal) and authenticated to call this function
GRANT EXECUTE ON FUNCTION public.get_client_photos_visibility(uuid) TO anon, authenticated;