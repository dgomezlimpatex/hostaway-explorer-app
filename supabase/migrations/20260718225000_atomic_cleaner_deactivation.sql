-- Desactiva operarios y retira sus tareas futuras en una única transacción.
-- También endurece la RPC canónica de asignación para impedir asignar operarios
-- que hayan quedado inactivos durante una operación concurrente.

CREATE OR REPLACE FUNCTION public.set_task_assignments(
  _task_id uuid,
  _cleaner_ids uuid[]
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_current uuid[];
  v_added uuid[];
  v_removed uuid[];
  v_names text;
  v_primary uuid;
  v_ids uuid[];
  v_valid_cleaner_count integer;
BEGIN
  IF _task_id IS NULL THEN
    RAISE EXCEPTION 'task_id es requerido';
  END IF;

  SELECT coalesce(array_agg(id ORDER BY ord), '{}'::uuid[])
    INTO v_ids
    FROM (
      SELECT DISTINCT ON (id) id, ord
      FROM unnest(coalesce(_cleaner_ids, '{}'::uuid[])) WITH ORDINALITY AS t(id, ord)
      WHERE id IS NOT NULL
      ORDER BY id, ord
    ) s;

  -- Bloquea primero las fichas de los operarios. Si una baja está en curso,
  -- esta lectura espera y la validación posterior ve el estado ya confirmado.
  PERFORM c.id
  FROM public.cleaners c
  WHERE c.id = ANY(v_ids)
  ORDER BY c.id
  FOR KEY SHARE;

  SELECT count(*)
    INTO v_valid_cleaner_count
    FROM public.cleaners c
    WHERE c.id = ANY(v_ids)
      AND c.is_active = true;

  IF v_valid_cleaner_count <> cardinality(v_ids) THEN
    RAISE EXCEPTION 'No se puede asignar un trabajador inexistente o inactivo';
  END IF;

  -- Serializa todas las sustituciones de la lista completa de esta tarea.
  PERFORM 1
  FROM public.tasks
  WHERE id = _task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarea no encontrada';
  END IF;

  SELECT coalesce(array_agg(cleaner_id), '{}'::uuid[])
    INTO v_current
    FROM public.task_assignments
    WHERE task_id = _task_id;

  SELECT coalesce(array_agg(x), '{}'::uuid[]) INTO v_added
    FROM (SELECT unnest(v_ids) EXCEPT SELECT unnest(v_current)) AS t(x);

  SELECT coalesce(array_agg(x), '{}'::uuid[]) INTO v_removed
    FROM (SELECT unnest(v_current) EXCEPT SELECT unnest(v_ids)) AS t(x);

  IF array_length(v_removed, 1) > 0 THEN
    DELETE FROM public.task_assignments
      WHERE task_id = _task_id AND cleaner_id = ANY(v_removed);
  END IF;

  IF array_length(v_added, 1) > 0 THEN
    INSERT INTO public.task_assignments (task_id, cleaner_id, cleaner_name, assigned_by)
      SELECT _task_id, c.id, c.name, auth.uid()
      FROM public.cleaners c
      WHERE c.id = ANY(v_added)
        AND c.is_active = true;
  END IF;

  SELECT string_agg(c.name, ', ' ORDER BY arr.ord)
    INTO v_names
    FROM unnest(v_ids) WITH ORDINALITY AS arr(id, ord)
    JOIN public.cleaners c ON c.id = arr.id;

  v_primary := v_ids[1];

  UPDATE public.tasks
    SET cleaner = NULLIF(v_names, ''),
        cleaner_id = v_primary,
        updated_at = now()
    WHERE id = _task_id;

  RETURN jsonb_build_object(
    'added', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'email', c.email)), '[]'::jsonb)
      FROM public.cleaners c WHERE c.id = ANY(v_added)
    ),
    'removed', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'email', c.email)), '[]'::jsonb)
      FROM public.cleaners c WHERE c.id = ANY(v_removed)
    ),
    'final', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) ORDER BY arr.ord), '[]'::jsonb)
      FROM unnest(v_ids) WITH ORDINALITY AS arr(id, ord)
      JOIN public.cleaners c ON c.id = arr.id
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_future_pending_tasks_for_cleaner(
  _cleaner_id uuid
) RETURNS TABLE (
  id uuid,
  date date,
  start_time time without time zone,
  end_time time without time zone,
  property text,
  status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT
    t.id,
    t.date,
    t.start_time,
    t.end_time,
    t.property,
    t.status
  FROM public.tasks t
  JOIN public.cleaners c ON c.id = _cleaner_id
  WHERE t.date >= (now() AT TIME ZONE 'Europe/Madrid')::date
    AND coalesce(t.status, 'pending') NOT IN ('completed', 'cancelled')
    AND (
      EXISTS (
        SELECT 1
        FROM public.task_assignments ta
        WHERE ta.task_id = t.id
          AND ta.cleaner_id = _cleaner_id
      )
      OR t.cleaner_id = _cleaner_id
      OR (
        t.cleaner_id IS NULL
        AND t.cleaner = c.name
      )
    )
  ORDER BY t.date, t.start_time NULLS LAST, t.id;
$$;

CREATE OR REPLACE FUNCTION public.deactivate_cleaner_with_future_assignments(
  _cleaner_id uuid,
  _unassign_future_tasks boolean DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cleaner public.cleaners%ROWTYPE;
  v_task record;
  v_remaining_names text;
  v_remaining_primary uuid;
  v_unassigned_count integer := 0;
  v_had_modern_assignment boolean;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role'
     AND NOT public.user_is_admin_or_manager() THEN
    RAISE EXCEPTION 'No autorizado para desactivar trabajadores'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
    INTO v_cleaner
    FROM public.cleaners
    WHERE id = _cleaner_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trabajador no encontrado';
  END IF;

  IF v_cleaner.is_active = false THEN
    RETURN jsonb_build_object('unassignedCount', 0, 'alreadyInactive', true);
  END IF;

  IF _unassign_future_tasks THEN
    FOR v_task IN
      SELECT t.id, t.sede_id
      FROM public.tasks t
      WHERE t.date >= (now() AT TIME ZONE 'Europe/Madrid')::date
        AND coalesce(t.status, 'pending') NOT IN ('completed', 'cancelled')
        AND (
          EXISTS (
            SELECT 1
            FROM public.task_assignments ta
            WHERE ta.task_id = t.id
              AND ta.cleaner_id = _cleaner_id
          )
          OR t.cleaner_id = _cleaner_id
          OR (
            t.cleaner_id IS NULL
            AND t.cleaner = v_cleaner.name
          )
        )
      ORDER BY t.id
      FOR UPDATE OF t
    LOOP
      SELECT EXISTS (
        SELECT 1
        FROM public.task_assignments ta
        WHERE ta.task_id = v_task.id
          AND ta.cleaner_id = _cleaner_id
      ) INTO v_had_modern_assignment;

      IF v_had_modern_assignment THEN
        -- El trigger canónico genera task_cancelled dentro de esta transacción.
        DELETE FROM public.task_assignments
        WHERE task_id = v_task.id
          AND cleaner_id = _cleaner_id;
      ELSE
        -- Compatibilidad con tareas antiguas sin fila en task_assignments.
        INSERT INTO public.notification_events (
          event_type,
          entity_type,
          entity_id,
          task_id,
          cleaner_id,
          sede_id,
          payload,
          dedupe_key,
          status
        ) VALUES (
          'task_cancelled',
          'tasks',
          v_task.id,
          v_task.id,
          _cleaner_id,
          v_task.sede_id,
          jsonb_build_object('source', 'deactivate_cleaner_legacy_assignment'),
          concat('task_cancelled:', v_task.id::text, ':', _cleaner_id::text, ':legacy-deactivation'),
          'pending'
        )
        ON CONFLICT (dedupe_key) DO NOTHING;
      END IF;

      SELECT
        string_agg(c.name, ', ' ORDER BY ta.assigned_at, ta.id),
        (array_agg(c.id ORDER BY ta.assigned_at, ta.id))[1]
      INTO v_remaining_names, v_remaining_primary
      FROM public.task_assignments ta
      JOIN public.cleaners c ON c.id = ta.cleaner_id
      WHERE ta.task_id = v_task.id;

      UPDATE public.tasks
      SET cleaner = v_remaining_names,
          cleaner_id = v_remaining_primary,
          updated_at = now()
      WHERE id = v_task.id;

      v_unassigned_count := v_unassigned_count + 1;
    END LOOP;
  END IF;

  UPDATE public.cleaners
  SET is_active = false,
      updated_at = now()
  WHERE id = _cleaner_id;

  RETURN jsonb_build_object(
    'unassignedCount', v_unassigned_count,
    'alreadyInactive', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_future_pending_tasks_for_cleaner(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.deactivate_cleaner_with_future_assignments(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_future_pending_tasks_for_cleaner(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.deactivate_cleaner_with_future_assignments(uuid, boolean) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_future_pending_tasks_for_cleaner(uuid) IS
  'Lista tareas futuras pendientes modernas o legadas para el diálogo de desactivación.';
COMMENT ON FUNCTION public.deactivate_cleaner_with_future_assignments(uuid, boolean) IS
  'Desactiva un trabajador y retira sus tareas futuras de forma atómica, preservando asignaciones compartidas.';
