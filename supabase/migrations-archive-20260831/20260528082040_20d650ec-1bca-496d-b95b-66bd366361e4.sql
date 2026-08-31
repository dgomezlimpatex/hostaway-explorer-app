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
BEGIN
  IF _task_id IS NULL THEN
    RAISE EXCEPTION 'task_id es requerido';
  END IF;

  -- Normalizar input: quitar nulls y duplicados manteniendo orden
  SELECT coalesce(array_agg(id ORDER BY ord), '{}'::uuid[])
    INTO v_ids
    FROM (
      SELECT DISTINCT ON (id) id, ord
      FROM unnest(coalesce(_cleaner_ids, '{}'::uuid[])) WITH ORDINALITY AS t(id, ord)
      WHERE id IS NOT NULL
      ORDER BY id, ord
    ) s;

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
      WHERE c.id = ANY(v_added);
  END IF;

  -- Nombres en el orden recibido
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

GRANT EXECUTE ON FUNCTION public.set_task_assignments(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_task_assignments(uuid, uuid[]) TO service_role;