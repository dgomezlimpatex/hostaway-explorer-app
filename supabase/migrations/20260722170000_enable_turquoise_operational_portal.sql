-- Portal operativo diario: activación opt-in por cliente.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS operational_portal_enabled boolean NOT NULL DEFAULT false;

-- Turquoise Apartments SL: primer cliente piloto.
UPDATE public.clients
SET operational_portal_enabled = true
WHERE id = '669948a6-e5c3-4a73-a151-6ccca5c82adf';

DROP FUNCTION IF EXISTS public.get_client_portal_settings(uuid);

CREATE FUNCTION public.get_client_portal_settings(_client_id uuid)
RETURNS TABLE(
  client_id uuid,
  allow_reservation_creation boolean,
  allow_extraordinary_requests boolean,
  allow_incidents boolean,
  operational_portal_enabled boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    id,
    allow_reservation_creation,
    allow_extraordinary_requests,
    allow_incidents,
    operational_portal_enabled
  FROM public.clients
  WHERE id = _client_id;
$function$;

REVOKE ALL ON FUNCTION public.get_client_portal_settings(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_client_portal_settings(uuid) TO anon, authenticated;
