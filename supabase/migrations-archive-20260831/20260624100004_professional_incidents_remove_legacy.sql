-- Incidencias profesionales: comentarios públicos y retirada del sistema legacy.

-- 1. Permitir todos los eventos que usa el portal de cliente.
ALTER TABLE public.cleaning_incident_events
  DROP CONSTRAINT IF EXISTS cleaning_incident_events_event_type_check;

ALTER TABLE public.cleaning_incident_events
  ADD CONSTRAINT cleaning_incident_events_event_type_check
  CHECK (event_type IN (
    'created',
    'approved',
    'discarded_limpatex',
    'status_change',
    'visibility_change',
    'media_added',
    'responsible_changed',
    'deleted',
    'client_in_progress',
    'client_resolved',
    'client_discarded',
    'client_comment',
    'limpatex_comment'
  ));

-- 2. Comentarios públicos entre Limpatex y cliente.
CREATE TABLE IF NOT EXISTS public.cleaning_incident_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.cleaning_incidents(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(trim(body)) > 0),
  author_kind text NOT NULL CHECK (author_kind IN ('client', 'limpatex')),
  author_user_id uuid,
  author_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cleaning_incident_comments_incident
  ON public.cleaning_incident_comments(incident_id, created_at ASC);

ALTER TABLE public.cleaning_incident_comments ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.cleaning_incident_comments TO anon, authenticated;

DROP POLICY IF EXISTS "Staff read incident comments" ON public.cleaning_incident_comments;
CREATE POLICY "Staff read incident comments"
  ON public.cleaning_incident_comments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.cleaning_incidents i
      WHERE i.id = incident_id
        AND (public.user_has_role('admin'::app_role) OR public.user_can_access_task(i.sede_id))
    )
  );

DROP POLICY IF EXISTS "Staff insert incident comments" ON public.cleaning_incident_comments;
CREATE POLICY "Staff insert incident comments"
  ON public.cleaning_incident_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_kind = 'limpatex'
    AND EXISTS (
      SELECT 1
      FROM public.cleaning_incidents i
      WHERE i.id = incident_id
        AND public.user_is_admin_or_manager()
        AND (public.user_has_role('admin'::app_role) OR public.user_can_access_task(i.sede_id))
    )
  );

DROP POLICY IF EXISTS "Portal anon read public incident comments" ON public.cleaning_incident_comments;
CREATE POLICY "Portal anon read public incident comments"
  ON public.cleaning_incident_comments
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.cleaning_incidents i
      JOIN public.client_portal_access cpa ON cpa.client_id = i.client_id
      WHERE i.id = incident_id
        AND i.visibility = 'public'
        AND i.status IN ('open', 'in_progress', 'resolved', 'discarded')
        AND cpa.is_active = true
    )
  );

-- Inserción de comentarios desde portal cliente. Mantiene el patrón existente del portal.
CREATE OR REPLACE FUNCTION public.client_add_incident_comment(
  _incident_id uuid,
  _body text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_incident record;
  v_comment_id uuid;
BEGIN
  IF _body IS NULL OR length(trim(_body)) = 0 THEN
    RAISE EXCEPTION 'El comentario no puede estar vacío';
  END IF;

  SELECT id, status, client_id, visibility
  INTO v_incident
  FROM public.cleaning_incidents
  WHERE id = _incident_id;

  IF v_incident.id IS NULL THEN
    RAISE EXCEPTION 'Incidencia no encontrada';
  END IF;

  IF v_incident.visibility <> 'public'
     OR v_incident.status NOT IN ('open', 'in_progress', 'resolved', 'discarded') THEN
    RAISE EXCEPTION 'Incidencia no visible para cliente';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.client_portal_access cpa
    WHERE cpa.client_id = v_incident.client_id
      AND cpa.is_active = true
  ) THEN
    RAISE EXCEPTION 'Portal del cliente no activo';
  END IF;

  INSERT INTO public.cleaning_incident_comments (
    incident_id,
    body,
    author_kind,
    author_name
  ) VALUES (
    _incident_id,
    trim(_body),
    'client',
    'Cliente (portal)'
  )
  RETURNING id INTO v_comment_id;

  INSERT INTO public.cleaning_incident_events (
    incident_id,
    event_type,
    to_status,
    note,
    actor_name,
    actor_role
  ) VALUES (
    _incident_id,
    'client_comment',
    v_incident.status,
    trim(_body),
    'Cliente (portal)',
    'client'
  );

  RETURN v_comment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.client_add_incident_comment(uuid, text) TO anon, authenticated;

-- 3. Retirada definitiva del sistema antiguo.
ALTER TABLE public.task_reports
  DROP COLUMN IF EXISTS issues_found;
