
-- 1. Drop the over-permissive anonymous SELECT policy
DROP POLICY IF EXISTS "Anonymous can verify portal token" ON public.client_portal_access;

-- 2. Lookup by short_code (returns only client name, no credentials)
CREATE OR REPLACE FUNCTION public.portal_lookup_by_short_code(_short_code text)
RETURNS TABLE(client_id uuid, client_name text, short_code text, is_active boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cpa.client_id, c.nombre::text, cpa.short_code, cpa.is_active
  FROM public.client_portal_access cpa
  JOIN public.clients c ON c.id = cpa.client_id
  WHERE cpa.short_code = _short_code
    AND cpa.is_active = true
  LIMIT 1
$$;

-- 3. Legacy lookup by portal_token
CREATE OR REPLACE FUNCTION public.portal_lookup_by_token(_portal_token uuid)
RETURNS TABLE(client_id uuid, client_name text, short_code text, is_active boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cpa.client_id, c.nombre::text, cpa.short_code, cpa.is_active
  FROM public.client_portal_access cpa
  JOIN public.clients c ON c.id = cpa.client_id
  WHERE cpa.portal_token = _portal_token
    AND cpa.is_active = true
  LIMIT 1
$$;

-- 4. Authenticate with PIN (constant-time-ish: only returns row if PIN matches)
CREATE OR REPLACE FUNCTION public.portal_authenticate_with_pin(_identifier text, _pin text)
RETURNS TABLE(client_id uuid, client_name text, portal_token uuid, short_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec RECORD;
  v_short text;
BEGIN
  IF _identifier IS NULL OR _pin IS NULL THEN
    RETURN;
  END IF;

  -- Extract short_code (last segment after last '-' if 8 chars, else whole)
  v_short := _identifier;
  IF position('-' in _identifier) > 0 THEN
    v_short := split_part(_identifier, '-', array_length(string_to_array(_identifier, '-'), 1));
  END IF;

  -- Try short_code match first
  SELECT cpa.id, cpa.client_id, cpa.portal_token, cpa.short_code, c.nombre AS client_name
  INTO v_rec
  FROM public.client_portal_access cpa
  JOIN public.clients c ON c.id = cpa.client_id
  WHERE cpa.short_code = v_short
    AND cpa.access_pin = _pin
    AND cpa.is_active = true
  LIMIT 1;

  -- Fallback to legacy portal_token match (only if identifier looks like a UUID)
  IF v_rec.id IS NULL AND _identifier ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT cpa.id, cpa.client_id, cpa.portal_token, cpa.short_code, c.nombre AS client_name
    INTO v_rec
    FROM public.client_portal_access cpa
    JOIN public.clients c ON c.id = cpa.client_id
    WHERE cpa.portal_token = _identifier::uuid
      AND cpa.access_pin = _pin
      AND cpa.is_active = true
    LIMIT 1;
  END IF;

  IF v_rec.id IS NULL THEN
    RETURN;
  END IF;

  -- Update last_access_at
  UPDATE public.client_portal_access
  SET last_access_at = now()
  WHERE id = v_rec.id;

  client_id := v_rec.client_id;
  client_name := v_rec.client_name::text;
  portal_token := v_rec.portal_token;
  short_code := v_rec.short_code;
  RETURN NEXT;
END;
$$;

-- 5. Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION public.portal_lookup_by_short_code(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_lookup_by_token(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_authenticate_with_pin(text, text) TO anon, authenticated;
