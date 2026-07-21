-- Writers canónicos: cada operación de negocio se confirma o revierte en una sola transacción.

CREATE OR REPLACE FUNCTION public.writer_actor_can_access_sede(
  _actor_id uuid,
  _sede_id uuid,
  _allowed_roles public.app_role[]
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT _actor_id IS NOT NULL
    AND _sede_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = _actor_id AND ur.role = ANY(_allowed_roles)
    )
    AND public.user_has_sede_access(_actor_id, _sede_id);
$$;

REVOKE ALL ON FUNCTION public.writer_actor_can_access_sede(uuid, uuid, public.app_role[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.writer_actor_can_access_sede(uuid, uuid, public.app_role[]) TO service_role;

CREATE TABLE IF NOT EXISTS public.batch_task_creation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid NOT NULL, sede_id uuid NOT NULL,
  idempotency_key text NOT NULL, payload_hash text NOT NULL,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed')),
  result jsonb, created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
  UNIQUE (actor_id, idempotency_key)
);
CREATE TABLE IF NOT EXISTS public.batch_task_email_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.batch_task_creation_requests(id) ON DELETE CASCADE,
  cleaner_id uuid NOT NULL, recipient text NOT NULL, idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  provider_message_id text, last_error text, attempts integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (request_id, cleaner_id)
);
ALTER TABLE public.batch_task_creation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_task_email_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.batch_task_creation_requests, public.batch_task_email_deliveries FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.batch_task_creation_requests, public.batch_task_email_deliveries TO service_role;

CREATE OR REPLACE FUNCTION public.batch_create_tasks_transactional(
  _actor_id uuid,
  _sede_id uuid,
  _tasks jsonb,
  _idempotency_key text,
  _payload_hash text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item jsonb;
  v_index integer := 0;
  v_property public.properties%ROWTYPE;
  v_task public.tasks%ROWTYPE;
  v_cleaner_ids uuid[];
  v_all_cleaner_ids uuid[];
  v_valid_count integer;
  v_task_ids uuid[] := '{}'::uuid[];
  v_email_batches jsonb;
  v_request public.batch_task_creation_requests%ROWTYPE;
  v_result jsonb;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' OR _actor_id IS NULL THEN
    RAISE EXCEPTION 'Esta RPC solo puede ser invocada por el writer autenticado'
      USING ERRCODE = '42501';
  END IF;
  IF NOT public.writer_actor_can_access_sede(
    _actor_id, _sede_id, ARRAY['admin', 'manager', 'supervisor']::public.app_role[]
  ) THEN
    RAISE EXCEPTION 'No autorizado para crear tareas en esta sede' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(_tasks) <> 'array' OR jsonb_array_length(_tasks) < 1 OR jsonb_array_length(_tasks) > 50 THEN
    RAISE EXCEPTION 'tasks debe contener entre 1 y 50 elementos' USING ERRCODE = '22023';
  END IF;
  IF nullif(trim(_idempotency_key), '') IS NULL OR length(_idempotency_key) > 200
     OR _payload_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Idempotency key/hash inválidos' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.batch_task_creation_requests(actor_id, sede_id, idempotency_key, payload_hash)
  VALUES (_actor_id, _sede_id, _idempotency_key, _payload_hash)
  ON CONFLICT (actor_id, idempotency_key) DO NOTHING;
  SELECT * INTO v_request FROM public.batch_task_creation_requests r
  WHERE r.actor_id = _actor_id AND r.idempotency_key = _idempotency_key FOR UPDATE;
  IF v_request.payload_hash IS DISTINCT FROM _payload_hash OR v_request.sede_id IS DISTINCT FROM _sede_id THEN
    RAISE EXCEPTION 'Idempotency key reutilizada con payload distinto' USING ERRCODE = '23505';
  END IF;
  IF v_request.status = 'completed' AND v_request.result IS NOT NULL THEN
    RETURN v_request.result || jsonb_build_object('idempotentReplay', true);
  END IF;

  -- Estas tasks aún no existen: bloquea todos los cleaners y después todas las
  -- properties por UUID antes de procesar el lote.
  SELECT coalesce(array_agg(DISTINCT raw::uuid ORDER BY raw::uuid), '{}'::uuid[])
  INTO v_all_cleaner_ids
  FROM jsonb_array_elements(_tasks) item
  CROSS JOIN LATERAL jsonb_array_elements_text(coalesce(item->'cleanerIds', '[]'::jsonb)) raw
  WHERE nullif(trim(raw), '') IS NOT NULL;
  PERFORM c.id FROM public.cleaners c
  WHERE c.id = ANY(v_all_cleaner_ids)
  ORDER BY c.id
  FOR KEY SHARE;
  PERFORM p.id FROM public.properties p
  JOIN (
    SELECT DISTINCT nullif(item->>'propertyId', '')::uuid AS property_id
    FROM jsonb_array_elements(_tasks) item
  ) ids ON ids.property_id = p.id
  ORDER BY p.id
  FOR KEY SHARE OF p;

  FOR v_item IN SELECT value FROM jsonb_array_elements(_tasks)
  LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN
      RAISE EXCEPTION 'Elemento de tarea inválido en índice %', v_index USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_property
    FROM public.properties p
    WHERE p.id = nullif(v_item->>'propertyId', '')::uuid;
    IF NOT FOUND OR v_property.sede_id IS DISTINCT FROM _sede_id OR v_property.is_active = false THEN
      RAISE EXCEPTION 'Propiedad inválida o fuera de sede en índice %', v_index USING ERRCODE = '22023';
    END IF;

    SELECT coalesce(array_agg(id ORDER BY ord), '{}'::uuid[]) INTO v_cleaner_ids
    FROM (
      SELECT DISTINCT ON (id) id, ord
      FROM jsonb_array_elements_text(coalesce(v_item->'cleanerIds', '[]'::jsonb)) WITH ORDINALITY x(raw, ord)
      CROSS JOIN LATERAL (SELECT nullif(trim(raw), '')::uuid AS id) parsed
      WHERE id IS NOT NULL
      ORDER BY id, ord
    ) deduped;

    SELECT count(*) INTO v_valid_count
    FROM public.cleaners c
    WHERE c.id = ANY(v_cleaner_ids)
      AND c.is_active = true
      AND c.sede_id = _sede_id;
    IF v_valid_count <> cardinality(v_cleaner_ids) THEN
      RAISE EXCEPTION 'Trabajador inválido, inactivo o fuera de sede en índice %', v_index USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.tasks (
      property, address, date, start_time, end_time, type, status,
      check_in, check_out, cliente_id, propiedad_id, duracion, coste,
      metodo_pago, supervisor, sede_id
    ) VALUES (
      v_property.nombre,
      v_property.direccion,
      (v_item->>'date')::date,
      (v_item->>'startTime')::time,
      (v_item->>'endTime')::time,
      coalesce(nullif(v_item->>'type', ''), 'limpieza-turistica'),
      coalesce(nullif(v_item->>'status', ''), 'pending'),
      coalesce(nullif(v_item->>'checkIn', '')::time, v_property.check_in_predeterminado),
      coalesce(nullif(v_item->>'checkOut', '')::time, v_property.check_out_predeterminado),
      v_property.cliente_id,
      v_property.id,
      coalesce(nullif(v_item->>'duration', '')::integer, v_property.duracion_servicio),
      coalesce(nullif(v_item->>'cost', '')::numeric, v_property.coste_servicio),
      nullif(v_item->>'paymentMethod', ''),
      nullif(v_item->>'supervisor', ''),
      _sede_id
    ) RETURNING * INTO v_task;

    IF v_task.end_time <= v_task.start_time THEN
      RAISE EXCEPTION 'Horario inválido en índice %', v_index USING ERRCODE = '22023';
    END IF;

    IF cardinality(v_cleaner_ids) > 0 THEN
      INSERT INTO public.task_assignments(task_id, cleaner_id, cleaner_name, assigned_by)
      SELECT v_task.id, c.id, c.name, _actor_id
      FROM unnest(v_cleaner_ids) WITH ORDINALITY ids(id, ord)
      JOIN public.cleaners c ON c.id = ids.id
      ORDER BY ids.ord;

      UPDATE public.tasks t SET
        cleaner_id = v_cleaner_ids[1],
        cleaner = (
          SELECT string_agg(c.name, ', ' ORDER BY ids.ord)
          FROM unnest(v_cleaner_ids) WITH ORDINALITY ids(id, ord)
          JOIN public.cleaners c ON c.id = ids.id
        ),
        updated_at = now()
      WHERE t.id = v_task.id;
      -- El trigger de task_assignments crea el notification_events/outbox en esta transacción.
    END IF;

    v_task_ids := array_append(v_task_ids, v_task.id);
    v_index := v_index + 1;
  END LOOP;

  SELECT coalesce(jsonb_agg(batch ORDER BY batch->>'cleanerId'), '[]'::jsonb)
  INTO v_email_batches
  FROM (
    SELECT jsonb_build_object(
      'cleanerId', c.id,
      'cleanerName', c.name,
      'email', c.email,
      'tasks', jsonb_agg(jsonb_build_object(
        'taskId', t.id,
        'property', t.property,
        'address', t.address,
        'date', t.date,
        'startTime', t.start_time,
        'endTime', t.end_time
      ) ORDER BY t.date, t.start_time, t.id)
    ) AS batch
    FROM public.task_assignments ta
    JOIN public.tasks t ON t.id = ta.task_id
    JOIN public.cleaners c ON c.id = ta.cleaner_id
    WHERE ta.task_id = ANY(v_task_ids) AND nullif(trim(c.email), '') IS NOT NULL
    GROUP BY c.id, c.name, c.email
  ) batches;

  v_result := jsonb_build_object(
    'success', true,
    'created', cardinality(v_task_ids),
    'taskIds', to_jsonb(v_task_ids),
    'emailBatches', v_email_batches,
    'requestId', v_request.id,
    'idempotentReplay', false
  );
  INSERT INTO public.batch_task_email_deliveries(request_id, cleaner_id, recipient, idempotency_key)
  SELECT v_request.id, (batch->>'cleanerId')::uuid, batch->>'email',
         'batch-task-email/' || v_request.id::text || '/' || (batch->>'cleanerId')
  FROM jsonb_array_elements(v_email_batches) batch
  ON CONFLICT (request_id, cleaner_id) DO NOTHING;
  UPDATE public.batch_task_creation_requests
  SET status = 'completed', result = v_result, completed_at = now() WHERE id = v_request.id;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.batch_create_tasks_transactional(uuid, uuid, jsonb, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.batch_create_tasks_transactional(uuid, uuid, jsonb, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.apply_ai_actions_transactional(
  _proposal_id uuid,
  _actor_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_proposal public.ai_action_proposals%ROWTYPE;
  v_action jsonb;
  v_type text;
  v_task public.tasks%ROWTYPE;
  v_property public.properties%ROWTYPE;
  v_cleaner_ids uuid[];
  v_all_cleaner_ids uuid[];
  v_valid_count integer;
  v_results jsonb := '[]'::jsonb;
  v_start time;
  v_end time;
  v_minutes integer;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' OR _actor_id IS NULL THEN
    RAISE EXCEPTION 'Esta RPC solo puede ser invocada por el writer autenticado'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_proposal
  FROM public.ai_action_proposals p
  WHERE p.id = _proposal_id
  FOR UPDATE;
  IF NOT FOUND OR v_proposal.owner_user_id <> _actor_id THEN
    RAISE EXCEPTION 'Propuesta no encontrada' USING ERRCODE = 'P0002';
  END IF;
  IF v_proposal.status = 'applied' THEN
    RETURN jsonb_build_object('success', true, 'status', 'already_applied', 'result', v_proposal.result);
  END IF;
  IF v_proposal.status <> 'pending' THEN
    RAISE EXCEPTION 'La propuesta ya no está pendiente' USING ERRCODE = '40001';
  END IF;
  IF NOT public.ai_is_allowed_user() AND NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _actor_id AND lower(p.email) = 'dgomezlimpatex@gmail.com'
  ) THEN
    RAISE EXCEPTION 'AI copilot no habilitado para este usuario' USING ERRCODE = '42501';
  END IF;
  IF v_proposal.sede_id IS NOT NULL AND NOT public.writer_actor_can_access_sede(
    _actor_id, v_proposal.sede_id, ARRAY['admin', 'manager', 'supervisor']::public.app_role[]
  ) THEN
    RAISE EXCEPTION 'No autorizado para aplicar la propuesta en esta sede' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(v_proposal.actions) <> 'array' THEN
    RAISE EXCEPTION 'Acciones inválidas' USING ERRCODE = '22023';
  END IF;

  -- Bloqueo global previo: dos propuestas A→B/B→A adquieren siempre las tareas por UUID.
  PERFORM t.id
  FROM public.tasks t
  JOIN (
    SELECT DISTINCT nullif(action->>'taskId', '')::uuid AS task_id
    FROM jsonb_array_elements(v_proposal.actions) action
    WHERE action->>'type' = 'assign_task'
  ) ids ON ids.task_id = t.id
  ORDER BY ids.task_id
  FOR UPDATE OF t;

  -- Segundo nivel global: todos los cleaners de todas las acciones por UUID.
  SELECT coalesce(array_agg(DISTINCT raw::uuid ORDER BY raw::uuid), '{}'::uuid[])
  INTO v_all_cleaner_ids
  FROM jsonb_array_elements(v_proposal.actions) action
  CROSS JOIN LATERAL jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(action->'cleanerIds') = 'array' THEN action->'cleanerIds'
    WHEN nullif(action->>'cleanerId', '') IS NOT NULL THEN jsonb_build_array(action->>'cleanerId')
    ELSE '[]'::jsonb END
  ) raw
  WHERE nullif(trim(raw), '') IS NOT NULL;
  PERFORM c.id FROM public.cleaners c
  WHERE c.id = ANY(v_all_cleaner_ids)
  ORDER BY c.id
  FOR KEY SHARE;

  -- Tercer nivel global: properties usadas por create_task, por UUID.
  PERFORM p.id FROM public.properties p
  JOIN (
    SELECT DISTINCT nullif(action->>'propertyId', '')::uuid AS property_id
    FROM jsonb_array_elements(v_proposal.actions) action
    WHERE action->>'type' = 'create_task'
  ) ids ON ids.property_id = p.id
  ORDER BY p.id
  FOR KEY SHARE OF p;

  FOR v_action IN SELECT value FROM jsonb_array_elements(v_proposal.actions)
  LOOP
    v_type := nullif(trim(v_action->>'type'), '');
    IF v_type NOT IN ('assign_task', 'create_task') THEN
      RAISE EXCEPTION 'Tipo de acción no permitido: %', coalesce(v_type, '<vacío>') USING ERRCODE = '22023';
    END IF;

    SELECT coalesce(array_agg(id ORDER BY ord), '{}'::uuid[]) INTO v_cleaner_ids
    FROM (
      SELECT DISTINCT ON (id) id, ord
      FROM jsonb_array_elements_text(
        CASE WHEN jsonb_typeof(v_action->'cleanerIds') = 'array' THEN v_action->'cleanerIds'
        WHEN nullif(v_action->>'cleanerId', '') IS NOT NULL THEN jsonb_build_array(v_action->>'cleanerId')
        ELSE '[]'::jsonb END
      ) WITH ORDINALITY x(raw, ord)
      CROSS JOIN LATERAL (SELECT nullif(trim(raw), '')::uuid AS id) parsed
      WHERE id IS NOT NULL
      ORDER BY id, ord
    ) deduped;

    IF v_type = 'assign_task' THEN
      SELECT * INTO v_task FROM public.tasks t
      WHERE t.id = nullif(v_action->>'taskId', '')::uuid
      FOR UPDATE;
      IF NOT FOUND OR v_task.status IN ('completed', 'cancelled') THEN
        RAISE EXCEPTION 'Tarea no encontrada o cerrada' USING ERRCODE = '22023';
      END IF;
      IF NOT public.writer_actor_can_access_sede(
        _actor_id, v_task.sede_id, ARRAY['admin', 'manager', 'supervisor']::public.app_role[]
      ) THEN
        RAISE EXCEPTION 'No autorizado para la sede de la tarea' USING ERRCODE = '42501';
      END IF;

      SELECT count(*) INTO v_valid_count FROM public.cleaners c
      WHERE c.id = ANY(v_cleaner_ids) AND c.is_active = true AND c.sede_id = v_task.sede_id;
      IF cardinality(v_cleaner_ids) = 0 OR v_valid_count <> cardinality(v_cleaner_ids) THEN
        RAISE EXCEPTION 'Trabajadores inválidos para assign_task' USING ERRCODE = '22023';
      END IF;

      PERFORM public.set_task_assignments(v_task.id, v_cleaner_ids);
      UPDATE public.tasks SET
        start_time = coalesce(nullif(v_action->>'startTime', '')::time, start_time),
        end_time = coalesce(nullif(v_action->>'endTime', '')::time, end_time),
        updated_at = now()
      WHERE id = v_task.id
      RETURNING * INTO v_task;
      IF v_task.end_time <= v_task.start_time THEN
        RAISE EXCEPTION 'Horario inválido para assign_task' USING ERRCODE = '22023';
      END IF;

    ELSE
      SELECT * INTO v_property FROM public.properties p
      WHERE p.id = nullif(v_action->>'propertyId', '')::uuid;
      IF NOT FOUND OR v_property.is_active = false THEN
        RAISE EXCEPTION 'Propiedad no encontrada o inactiva' USING ERRCODE = '22023';
      END IF;
      IF NOT public.writer_actor_can_access_sede(
        _actor_id, v_property.sede_id, ARRAY['admin', 'manager', 'supervisor']::public.app_role[]
      ) THEN
        RAISE EXCEPTION 'No autorizado para la sede de la propiedad' USING ERRCODE = '42501';
      END IF;
      SELECT count(*) INTO v_valid_count FROM public.cleaners c
      WHERE c.id = ANY(v_cleaner_ids) AND c.is_active = true AND c.sede_id = v_property.sede_id;
      IF v_valid_count <> cardinality(v_cleaner_ids) THEN
        RAISE EXCEPTION 'Trabajadores inválidos para create_task' USING ERRCODE = '22023';
      END IF;

      v_start := coalesce(nullif(v_action->>'startTime', '')::time, '10:00'::time);
      v_minutes := greatest(1, coalesce(nullif(v_action->>'duration', '')::integer, v_property.duracion_servicio, 60));
      v_end := v_start + make_interval(mins => v_minutes);
      INSERT INTO public.tasks(
        property, address, date, start_time, end_time, type, status,
        check_in, check_out, cliente_id, propiedad_id, sede_id, duracion, coste
      ) VALUES (
        v_property.nombre, v_property.direccion, (v_action->>'date')::date,
        v_start, v_end, coalesce(nullif(v_action->>'taskType', ''), 'limpieza-turistica'), 'pending',
        v_property.check_in_predeterminado, v_property.check_out_predeterminado,
        v_property.cliente_id, v_property.id, v_property.sede_id, v_minutes, v_property.coste_servicio
      ) RETURNING * INTO v_task;
      IF cardinality(v_cleaner_ids) > 0 THEN
        PERFORM public.set_task_assignments(v_task.id, v_cleaner_ids);
      END IF;
    END IF;

    INSERT INTO public.ai_action_audit_logs(
      proposal_id, owner_user_id, owner_email, action_type, status, payload, result
    ) VALUES (
      v_proposal.id, v_proposal.owner_user_id, v_proposal.owner_email,
      v_type, 'success', v_action, jsonb_build_object('taskId', v_task.id)
    );
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'type', v_type, 'status', 'success', 'taskId', v_task.id, 'cleanerIds', to_jsonb(v_cleaner_ids)
    ));
  END LOOP;

  UPDATE public.ai_action_proposals SET
    status = 'applied',
    result = jsonb_build_object('results', v_results, 'failures', 0),
    updated_at = now()
  WHERE id = v_proposal.id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conflicto al finalizar la propuesta' USING ERRCODE = '40001';
  END IF;

  RETURN jsonb_build_object('success', true, 'status', 'applied', 'results', v_results, 'failures', 0);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_ai_actions_transactional(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_ai_actions_transactional(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.auto_assign_task_transactional(
  _task_id uuid,
  _actor_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_task public.tasks%ROWTYPE;
  v_property public.properties%ROWTYPE;
  v_group public.property_groups%ROWTYPE;
  v_group_id uuid;
  v_locked_group_id uuid;
  v_candidate record;
  v_cleaner public.cleaners%ROWTYPE;
  v_day integer;
  v_count integer;
  v_reason text;
  v_score numeric;
BEGIN
  IF coalesce(auth.role(), '') NOT IN ('service_role', 'authenticated') THEN
    RAISE EXCEPTION 'Usuario no autenticado' USING ERRCODE = '42501';
  END IF;
  IF coalesce(auth.role(), '') = 'authenticated' AND _actor_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Actor inválido' USING ERRCODE = '42501';
  END IF;

  -- Orden global compartido con IA: task antes de cualquier cleaner.
  SELECT * INTO v_task FROM public.tasks WHERE id = _task_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarea no encontrada' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.writer_actor_can_access_sede(
    _actor_id, v_task.sede_id, ARRAY['admin', 'manager', 'supervisor']::public.app_role[]
  ) THEN
    RAISE EXCEPTION 'No autorizado para autoasignar en esta sede' USING ERRCODE = '42501';
  END IF;

  SELECT pga.property_group_id INTO v_group_id
  FROM public.property_group_assignments pga
  WHERE pga.property_id = v_task.propiedad_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Property not in enabled auto-assignment group');
  END IF;

  -- Segundo nivel: cleaners candidatos ordenados. Serializa la capacidad.
  PERFORM c.id
  FROM public.cleaner_group_assignments cga
  JOIN public.cleaners c ON c.id = cga.cleaner_id
  WHERE cga.property_group_id = v_group_id AND cga.is_active = true
  ORDER BY c.id
  FOR UPDATE OF c;

  -- Tercer nivel: property → property_group_assignment → property_group.
  SELECT * INTO v_property FROM public.properties p
  WHERE p.id = v_task.propiedad_id
  FOR KEY SHARE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Auto-assignment configuration changed; retry');
  END IF;
  SELECT pga.property_group_id INTO v_locked_group_id
  FROM public.property_group_assignments pga
  WHERE pga.property_id = v_property.id
  FOR UPDATE;
  IF NOT FOUND OR v_locked_group_id IS DISTINCT FROM v_group_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Auto-assignment configuration changed; retry');
  END IF;
  SELECT * INTO v_group FROM public.property_groups pg
  WHERE pg.id = v_locked_group_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Auto-assignment configuration changed; retry');
  END IF;

  -- Revalidación autoritativa después de adquirir todos los locks.
  IF v_task.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'No se puede autoasignar una tarea cerrada' USING ERRCODE = '22023';
  END IF;
  IF v_task.cleaner_id IS NOT NULL OR EXISTS (
    SELECT 1 FROM public.task_assignments ta WHERE ta.task_id = v_task.id
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Task already assigned');
  END IF;
  IF NOT v_property.is_active OR NOT v_group.is_active OR NOT v_group.auto_assign_enabled
     OR v_task.sede_id IS DISTINCT FROM v_property.sede_id THEN
    RAISE EXCEPTION 'La tarea cambió de propiedad/sede' USING ERRCODE = '40001';
  END IF;
  IF NOT public.writer_actor_can_access_sede(
    _actor_id, v_task.sede_id, ARRAY['admin', 'manager', 'supervisor']::public.app_role[]
  ) THEN
    RAISE EXCEPTION 'El acceso a la sede cambió durante la autoasignación' USING ERRCODE = '42501';
  END IF;

  v_day := extract(dow FROM v_task.date)::integer;
  FOR v_candidate IN
    SELECT cga.cleaner_id, cga.priority, cga.max_tasks_per_day,
           coalesce(cga.estimated_travel_time_minutes, 0) AS travel
    FROM public.cleaner_group_assignments cga
    WHERE cga.property_group_id = v_group.id AND cga.is_active = true
    ORDER BY cga.priority, cga.cleaner_id
  LOOP
    SELECT * INTO v_cleaner FROM public.cleaners c WHERE c.id = v_candidate.cleaner_id;
    CONTINUE WHEN NOT FOUND OR NOT v_cleaner.is_active OR v_cleaner.sede_id IS DISTINCT FROM v_task.sede_id;

    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.cleaner_availability ca
      WHERE ca.cleaner_id = v_cleaner.id AND ca.day_of_week = v_day
        AND (NOT ca.is_available OR ca.start_time > v_task.start_time OR ca.end_time < v_task.end_time)
    );
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.worker_absences wa
      WHERE wa.cleaner_id = v_cleaner.id
        AND v_task.date BETWEEN wa.start_date AND wa.end_date
        AND (wa.start_time IS NULL OR (wa.start_time < v_task.end_time AND wa.end_time > v_task.start_time))
    );
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.worker_fixed_days_off wd
      WHERE wd.cleaner_id = v_cleaner.id AND wd.day_of_week = v_day AND wd.is_active
    );
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.worker_maintenance_cleanings wm
      WHERE wm.cleaner_id = v_cleaner.id AND wm.is_active AND v_day = ANY(wm.days_of_week)
        AND wm.start_time < v_task.end_time AND wm.end_time > v_task.start_time
    );

    WITH assigned_existing AS (
      SELECT ta.task_id FROM public.task_assignments ta WHERE ta.cleaner_id = v_cleaner.id
      UNION
      SELECT existing.id FROM public.tasks existing
      WHERE NOT EXISTS (SELECT 1 FROM public.task_assignments any_ta WHERE any_ta.task_id = existing.id)
        AND (existing.cleaner_id = v_cleaner.id OR (
          existing.cleaner_id IS NULL AND v_cleaner.name = ANY(regexp_split_to_array(coalesce(existing.cleaner, ''), '\s*,\s*'))
        ))
    )
    SELECT count(DISTINCT assigned.task_id) INTO v_count
    FROM assigned_existing assigned
    JOIN public.tasks existing ON existing.id = assigned.task_id
    WHERE true
      AND existing.date = v_task.date
      AND existing.id <> v_task.id
      AND coalesce(existing.status, 'pending') NOT IN ('completed', 'cancelled');
    CONTINUE WHEN v_count >= coalesce(v_candidate.max_tasks_per_day, 8);

    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.tasks existing
      WHERE (
        EXISTS (SELECT 1 FROM public.task_assignments ta WHERE ta.task_id = existing.id AND ta.cleaner_id = v_cleaner.id)
        OR (NOT EXISTS (SELECT 1 FROM public.task_assignments any_ta WHERE any_ta.task_id = existing.id)
          AND (existing.cleaner_id = v_cleaner.id OR (
            existing.cleaner_id IS NULL AND v_cleaner.name = ANY(regexp_split_to_array(coalesce(existing.cleaner, ''), '\s*,\s*'))
          )))
      )
        AND existing.date = v_task.date
        AND existing.id <> v_task.id
        AND coalesce(existing.status, 'pending') NOT IN ('completed', 'cancelled')
        AND existing.start_time < (v_task.end_time + make_interval(mins => v_candidate.travel))::time
        AND (existing.end_time + make_interval(mins => v_candidate.travel))::time > v_task.start_time
    );

    v_score := 1000 - (v_candidate.priority * 100) + (coalesce(v_candidate.max_tasks_per_day, 8) - v_count);
    v_reason := format('priority-saturation: prioridad %s, carga %s/%s',
      v_candidate.priority, v_count, coalesce(v_candidate.max_tasks_per_day, 8));

    PERFORM public.set_task_assignments(v_task.id, ARRAY[v_cleaner.id]);
    UPDATE public.tasks SET auto_assigned = true, assignment_confidence = v_score, updated_at = now()
    WHERE id = v_task.id;
    INSERT INTO public.auto_assignment_logs(
      task_id, property_group_id, assigned_cleaner_id, algorithm_used,
      assignment_reason, confidence_score, was_manual_override
    ) VALUES (
      v_task.id, v_group.id, v_cleaner.id, 'priority-saturation-transactional-v5',
      v_reason, v_score, false
    );

    RETURN jsonb_build_object(
      'success', true, 'taskId', v_task.id, 'cleanerId', v_cleaner.id,
      'cleanerName', v_cleaner.name, 'confidence', v_score,
      'reason', v_reason, 'algorithm', 'priority-saturation-transactional-v5'
    );
  END LOOP;

  RETURN jsonb_build_object('success', false, 'taskId', v_task.id, 'reason', 'No available cleaners');
END;
$$;

REVOKE ALL ON FUNCTION public.auto_assign_task_transactional(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auto_assign_task_transactional(uuid, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.batch_create_tasks_transactional(uuid, uuid, jsonb, text, text) IS
  'Crea el lote exactamente una vez por actor/key/payload, con asignaciones, outbox y estado durable de email en una transacción.';
COMMENT ON FUNCTION public.apply_ai_actions_transactional(uuid, uuid) IS
  'CAS por fila de propuesta y aplica todas las acciones/auditoría/estado en una transacción.';
COMMENT ON FUNCTION public.auto_assign_task_transactional(uuid, uuid) IS
  'Bloquea task, cleaners y configuración en orden global, revalida disponibilidad completa y escribe asignación, metadata y log atómicamente.';
