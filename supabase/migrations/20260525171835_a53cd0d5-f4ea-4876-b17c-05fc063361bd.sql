CREATE OR REPLACE FUNCTION public.create_extraordinary_request_with_task(_client_id uuid, _property_id uuid, _request_type_id uuid, _service_date date, _service_time time without time zone DEFAULT NULL::time without time zone, _guest_name text DEFAULT NULL::text, _notes text DEFAULT NULL::text, _reservation_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_client RECORD;
  v_property RECORD;
  v_type RECORD;
  v_portal_active boolean;
  v_today_count int;
  v_start_time time;
  v_end_time time;
  v_duration_min int;
  v_task_id uuid;
  v_request_id uuid;
  v_notes_full text;
  v_property_label text;
BEGIN
  IF _client_id IS NULL OR _property_id IS NULL OR _request_type_id IS NULL OR _service_date IS NULL THEN
    RAISE EXCEPTION 'Faltan campos requeridos';
  END IF;

  IF _service_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'La fecha del servicio no puede ser anterior a hoy';
  END IF;

  IF _service_date > CURRENT_DATE + INTERVAL '90 days' THEN
    RAISE EXCEPTION 'La fecha del servicio no puede superar 90 días';
  END IF;

  SELECT id, nombre, allow_extraordinary_requests, sede_id
  INTO v_client
  FROM public.clients
  WHERE id = _client_id;

  IF v_client.id IS NULL THEN
    RAISE EXCEPTION 'Cliente no encontrado';
  END IF;

  IF v_client.allow_extraordinary_requests IS NOT TRUE THEN
    RAISE EXCEPTION 'Este cliente no tiene activadas las solicitudes extraordinarias';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.client_portal_access
    WHERE client_id = _client_id AND is_active = true
  ) INTO v_portal_active;

  IF NOT v_portal_active THEN
    RAISE EXCEPTION 'El portal del cliente no está activo';
  END IF;

  SELECT id, nombre, codigo, direccion, sede_id
  INTO v_property
  FROM public.properties
  WHERE id = _property_id;

  IF v_property.id IS NULL THEN
    RAISE EXCEPTION 'Propiedad no encontrada';
  END IF;

  SELECT id, label, default_cost, default_duration_minutes, requires_time, is_active
  INTO v_type
  FROM public.extraordinary_request_types
  WHERE id = _request_type_id;

  IF v_type.id IS NULL OR v_type.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Tipo de solicitud no disponible';
  END IF;

  IF v_type.requires_time = true AND _service_time IS NULL THEN
    RAISE EXCEPTION 'Este servicio requiere una hora';
  END IF;

  SELECT COUNT(*) INTO v_today_count
  FROM public.client_extraordinary_requests
  WHERE client_id = _client_id
    AND created_at >= (CURRENT_DATE::timestamp);

  IF v_today_count >= 10 THEN
    RAISE EXCEPTION 'Has alcanzado el máximo de solicitudes diarias (10)';
  END IF;

  v_duration_min := COALESCE(v_type.default_duration_minutes, 15);
  IF v_duration_min < 15 THEN v_duration_min := 15; END IF;

  v_start_time := COALESCE(_service_time, TIME '09:00');
  v_end_time := (v_start_time + (v_duration_min || ' minutes')::interval)::time;

  v_notes_full := '[SOLICITUD CLIENTE - ' || v_type.label || ']';
  IF _guest_name IS NOT NULL AND length(trim(_guest_name)) > 0 THEN
    v_notes_full := v_notes_full || ' Huésped: ' || _guest_name || '.';
  END IF;
  IF _notes IS NOT NULL AND length(trim(_notes)) > 0 THEN
    v_notes_full := v_notes_full || ' ' || _notes;
  END IF;

  -- Etiqueta de la propiedad en la tarea: "Tipo - Código - Nombre"
  v_property_label := v_type.label
    || COALESCE(' - ' || NULLIF(v_property.codigo, ''), '')
    || ' - ' || v_property.nombre;

  INSERT INTO public.tasks (
    property, address, start_time, end_time, type, status,
    check_in, check_out, date, cliente_id, propiedad_id,
    duracion, coste, notes, sede_id
  ) VALUES (
    v_property_label,
    COALESCE(v_property.direccion, ''),
    v_start_time,
    v_end_time,
    'trabajo-extraordinario',
    'pending',
    v_start_time,
    v_end_time,
    _service_date,
    _client_id,
    _property_id,
    v_duration_min,
    COALESCE(v_type.default_cost, 0),
    v_notes_full,
    v_property.sede_id
  )
  RETURNING id INTO v_task_id;

  INSERT INTO public.client_extraordinary_requests (
    client_id, property_id, reservation_id, request_type_id,
    request_type_label_snapshot, service_date, service_time,
    guest_name, notes, cost_snapshot, status, task_id, sede_id
  ) VALUES (
    _client_id, _property_id, _reservation_id, _request_type_id,
    v_type.label, _service_date, _service_time,
    _guest_name, _notes, COALESCE(v_type.default_cost, 0), 'active',
    v_task_id, v_property.sede_id
  )
  RETURNING id INTO v_request_id;

  RETURN jsonb_build_object(
    'request_id', v_request_id,
    'task_id', v_task_id,
    'cost', COALESCE(v_type.default_cost, 0),
    'label', v_type.label
  );
END;
$function$;