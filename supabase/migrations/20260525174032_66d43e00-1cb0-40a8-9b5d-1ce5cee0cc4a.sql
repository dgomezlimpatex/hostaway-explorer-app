CREATE OR REPLACE FUNCTION public.update_extraordinary_request(
  _request_id uuid,
  _service_date date,
  _service_time time without time zone DEFAULT NULL,
  _guest_name text DEFAULT NULL,
  _notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_req RECORD;
  v_type RECORD;
  v_start_time time;
  v_end_time time;
  v_duration_min int;
  v_notes_full text;
BEGIN
  IF _request_id IS NULL OR _service_date IS NULL THEN
    RAISE EXCEPTION 'Faltan campos requeridos';
  END IF;

  IF _service_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'La fecha del servicio no puede ser anterior a hoy';
  END IF;

  IF _service_date > CURRENT_DATE + INTERVAL '90 days' THEN
    RAISE EXCEPTION 'La fecha del servicio no puede superar 90 días';
  END IF;

  SELECT * INTO v_req FROM public.client_extraordinary_requests WHERE id = _request_id;
  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'Solicitud no encontrada';
  END IF;

  IF v_req.status <> 'active' THEN
    RAISE EXCEPTION 'Solo se pueden editar solicitudes activas';
  END IF;

  SELECT id, label, default_duration_minutes, requires_time
  INTO v_type
  FROM public.extraordinary_request_types
  WHERE id = v_req.request_type_id;

  IF v_type.id IS NOT NULL AND v_type.requires_time = true AND _service_time IS NULL THEN
    RAISE EXCEPTION 'Este servicio requiere una hora';
  END IF;

  v_duration_min := COALESCE(v_type.default_duration_minutes, 15);
  IF v_duration_min < 15 THEN v_duration_min := 15; END IF;

  v_start_time := COALESCE(_service_time, TIME '09:00');
  v_end_time := (v_start_time + (v_duration_min || ' minutes')::interval)::time;

  v_notes_full := '[SOLICITUD CLIENTE - ' || v_req.request_type_label_snapshot || ']';
  IF _guest_name IS NOT NULL AND length(trim(_guest_name)) > 0 THEN
    v_notes_full := v_notes_full || ' Huésped: ' || _guest_name || '.';
  END IF;
  IF _notes IS NOT NULL AND length(trim(_notes)) > 0 THEN
    v_notes_full := v_notes_full || ' ' || _notes;
  END IF;

  UPDATE public.client_extraordinary_requests
  SET service_date = _service_date,
      service_time = _service_time,
      guest_name = _guest_name,
      notes = _notes,
      updated_at = now()
  WHERE id = _request_id;

  IF v_req.task_id IS NOT NULL THEN
    UPDATE public.tasks
    SET date = _service_date,
        start_time = v_start_time,
        end_time = v_end_time,
        check_in = v_start_time,
        check_out = v_end_time,
        notes = v_notes_full,
        updated_at = now()
    WHERE id = v_req.task_id;
  END IF;

  RETURN jsonb_build_object('request_id', _request_id, 'task_id', v_req.task_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.update_extraordinary_request(uuid, date, time, text, text) TO anon, authenticated;