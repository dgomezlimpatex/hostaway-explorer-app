
-- Allow anonymous portal users to read public incidents of clients with active portal
CREATE POLICY "Portal anon read public incidents"
ON public.cleaning_incidents
FOR SELECT
USING (
  visibility = 'public'
  AND status IN ('open', 'in_progress', 'resolved', 'discarded')
  AND EXISTS (
    SELECT 1 FROM public.client_portal_access cpa
    WHERE cpa.client_id = cleaning_incidents.client_id
    AND cpa.is_active = true
  )
);

CREATE POLICY "Portal anon read public incident media"
ON public.cleaning_incident_media
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.cleaning_incidents i
    JOIN public.client_portal_access cpa ON cpa.client_id = i.client_id
    WHERE i.id = cleaning_incident_media.incident_id
    AND i.visibility = 'public'
    AND i.status IN ('open', 'in_progress', 'resolved', 'discarded')
    AND cpa.is_active = true
  )
);

CREATE POLICY "Portal anon read public incident events"
ON public.cleaning_incident_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.cleaning_incidents i
    JOIN public.client_portal_access cpa ON cpa.client_id = i.client_id
    WHERE i.id = cleaning_incident_events.incident_id
    AND i.visibility = 'public'
    AND i.status IN ('open', 'in_progress', 'resolved', 'discarded')
    AND cpa.is_active = true
  )
);

-- RPC for the portal client (anon) to acknowledge/discard or mark as resolved an incident
CREATE OR REPLACE FUNCTION public.client_update_incident_status(
  _incident_id uuid,
  _to_status text,
  _note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_incident RECORD;
BEGIN
  IF _to_status NOT IN ('resolved', 'discarded', 'in_progress') THEN
    RAISE EXCEPTION 'Estado no permitido para cliente: %', _to_status;
  END IF;

  SELECT id, status, client_id, visibility
  INTO v_incident
  FROM public.cleaning_incidents
  WHERE id = _incident_id;

  IF v_incident.id IS NULL THEN
    RAISE EXCEPTION 'Incidencia no encontrada';
  END IF;

  IF v_incident.visibility <> 'public' THEN
    RAISE EXCEPTION 'Incidencia no visible para cliente';
  END IF;

  IF v_incident.status NOT IN ('open', 'in_progress') THEN
    RAISE EXCEPTION 'La incidencia no puede modificarse en su estado actual';
  END IF;

  -- Ensure client portal is active
  IF NOT EXISTS (
    SELECT 1 FROM public.client_portal_access cpa
    WHERE cpa.client_id = v_incident.client_id
    AND cpa.is_active = true
  ) THEN
    RAISE EXCEPTION 'Portal del cliente no activo';
  END IF;

  UPDATE public.cleaning_incidents
  SET
    status = _to_status::incident_status,
    resolved_at = CASE WHEN _to_status = 'resolved' THEN now() ELSE resolved_at END,
    resolution_note = CASE WHEN _to_status = 'resolved' AND _note IS NOT NULL THEN _note ELSE resolution_note END,
    client_discard_reason = CASE WHEN _to_status = 'discarded' AND _note IS NOT NULL THEN _note ELSE client_discard_reason END,
    updated_at = now()
  WHERE id = _incident_id;

  INSERT INTO public.cleaning_incident_events (
    incident_id, event_type, from_status, to_status, note,
    actor_user_id, actor_name, actor_role
  ) VALUES (
    _incident_id,
    CASE WHEN _to_status = 'resolved' THEN 'client_resolved'
         WHEN _to_status = 'discarded' THEN 'client_discarded'
         ELSE 'client_in_progress' END,
    v_incident.status,
    _to_status::incident_status,
    _note,
    NULL,
    'Cliente (portal)',
    'client'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.client_update_incident_status(uuid, text, text) TO anon, authenticated;
