
CREATE OR REPLACE FUNCTION public.report_cleaning_incident(
  _task_id uuid,
  _category_id uuid,
  _description text,
  _media_urls text[],
  _location text DEFAULT NULL,
  _visibility public.incident_visibility DEFAULT 'public',
  _create_as_open boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role app_role;
  v_is_admin_or_manager boolean;
  v_task record;
  v_client record;
  v_cleaner_id uuid;
  v_reporter_kind text;
  v_initial_status public.incident_status;
  v_incident_id uuid;
  v_url text;
  v_full_name text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF _task_id IS NULL OR _category_id IS NULL THEN
    RAISE EXCEPTION 'Faltan campos obligatorios';
  END IF;

  IF _description IS NULL OR length(trim(_description)) = 0 THEN
    RAISE EXCEPTION 'La descripción es obligatoria';
  END IF;

  IF _media_urls IS NULL OR array_length(_media_urls, 1) IS NULL OR array_length(_media_urls, 1) < 2 THEN
    RAISE EXCEPTION 'Debes adjuntar al menos 2 archivos (fotos o vídeo)';
  END IF;

  SELECT t.id, t.status, t.cliente_id, t.propiedad_id, t.sede_id, t.cleaner_id
  INTO v_task
  FROM public.tasks t
  WHERE t.id = _task_id;

  IF v_task.id IS NULL THEN
    RAISE EXCEPTION 'Tarea no encontrada';
  END IF;

  IF v_task.cliente_id IS NULL OR v_task.sede_id IS NULL THEN
    RAISE EXCEPTION 'La tarea no tiene cliente o sede asignada';
  END IF;

  -- Validar permisos / detectar tipo de reporter
  v_role := public.get_current_user_role();
  v_is_admin_or_manager := v_role IN ('admin','manager');

  SELECT id INTO v_cleaner_id FROM public.cleaners WHERE user_id = v_uid LIMIT 1;

  IF v_is_admin_or_manager THEN
    v_reporter_kind := 'limpatex_admin';
  ELSIF v_cleaner_id IS NOT NULL THEN
    v_reporter_kind := 'cleaner';
    -- El cleaner debe estar asignado a la tarea
    IF v_task.cleaner_id IS DISTINCT FROM v_cleaner_id
       AND NOT EXISTS (
         SELECT 1 FROM public.task_assignments ta
         WHERE ta.task_id = _task_id AND ta.cleaner_id = v_cleaner_id
       )
    THEN
      RAISE EXCEPTION 'No estás asignada a esta tarea';
    END IF;
    -- La tarea debe estar en curso
    IF v_task.status <> 'in-progress' THEN
      RAISE EXCEPTION 'Solo puedes reportar incidencias mientras la tarea está en curso';
    END IF;
  ELSE
    RAISE EXCEPTION 'No tienes permisos para reportar incidencias';
  END IF;

  -- Cliente debe tener incidencias activadas
  SELECT id, allow_incidents INTO v_client FROM public.clients WHERE id = v_task.cliente_id;
  IF v_client.allow_incidents IS NOT TRUE THEN
    RAISE EXCEPTION 'Este cliente no tiene activado el módulo de incidencias';
  END IF;

  -- Estado inicial
  IF v_is_admin_or_manager AND _create_as_open THEN
    v_initial_status := 'open';
  ELSE
    v_initial_status := 'pending_limpatex';
  END IF;

  -- Visibility coherente
  IF NOT v_is_admin_or_manager THEN
    _visibility := 'public';
  END IF;

  -- Crear la incidencia
  INSERT INTO public.cleaning_incidents (
    task_id, property_id, client_id, sede_id,
    reporter_cleaner_id, reporter_user_id, reporter_kind,
    category_id, location, description,
    status, visibility,
    approved_at, approved_by
  ) VALUES (
    _task_id, v_task.propiedad_id, v_task.cliente_id, v_task.sede_id,
    v_cleaner_id, v_uid, v_reporter_kind,
    _category_id, NULLIF(trim(_location),''), trim(_description),
    v_initial_status, _visibility,
    CASE WHEN v_initial_status='open' THEN now() END,
    CASE WHEN v_initial_status='open' THEN v_uid END
  )
  RETURNING id INTO v_incident_id;

  -- Adjuntos
  FOREACH v_url IN ARRAY _media_urls LOOP
    INSERT INTO public.cleaning_incident_media (incident_id, url, kind, uploaded_by, uploaded_by_role)
    VALUES (
      v_incident_id, v_url,
      CASE WHEN v_url ILIKE '%.mp4' OR v_url ILIKE '%.mov' OR v_url ILIKE '%.webm' THEN 'video' ELSE 'photo' END,
      v_uid, v_role::text
    );
  END LOOP;

  -- Resolver nombre legible
  SELECT COALESCE(p.full_name, p.email)
  INTO v_full_name
  FROM public.profiles p
  WHERE p.id = v_uid;

  -- Evento inicial
  INSERT INTO public.cleaning_incident_events (
    incident_id, event_type, to_status, actor_user_id, actor_name, actor_role,
    metadata
  ) VALUES (
    v_incident_id, 'created', v_initial_status, v_uid, v_full_name, v_role::text,
    jsonb_build_object('reporter_kind', v_reporter_kind, 'media_count', array_length(_media_urls,1))
  );

  RETURN v_incident_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_cleaning_incident(uuid, uuid, text, text[], text, public.incident_visibility, boolean) TO authenticated;
