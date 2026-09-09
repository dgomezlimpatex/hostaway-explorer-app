-- Read the existing server-side PIN audit; no client clock or new write path.
CREATE OR REPLACE FUNCTION public.laundry_preparation_timings(p_sede_id uuid, p_day date)
RETURNS TABLE (
  event_id uuid, worker_id uuid, worker_name text, task_id uuid,
  property_name text, prepared_at timestamptz, previous_prepared_at timestamptz,
  elapsed_seconds numeric
)
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_laundry_route_owner() THEN
    RAISE EXCEPTION 'Solo el propietario puede consultar los tiempos' USING ERRCODE = '42501';
  END IF;
  IF p_day IS NULL OR p_sede_id IS NULL THEN
    RAISE EXCEPTION 'Fecha y sede obligatorias' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH unique_bags AS (
    -- Retries/double taps on the same bag do not create another interval.
    SELECT DISTINCT ON (e.route_worker_id, e.task_id)
      e.id, e.route_worker_id, e.worker_name, e.task_id, e.created_at
    FROM public.laundry_route_worker_events e
    JOIN public.laundry_share_links l ON l.id = e.share_link_id
    WHERE e.action = 'prepare' AND e.route_worker_id IS NOT NULL
      AND e.task_id IS NOT NULL AND l.workflow_version = 'route_v2'
      AND l.sede_id = p_sede_id
      AND e.created_at >= (p_day::timestamp AT TIME ZONE 'Europe/Madrid')
      AND e.created_at < ((p_day + 1)::timestamp AT TIME ZONE 'Europe/Madrid')
    ORDER BY e.route_worker_id, e.task_id, e.created_at, e.id
  ), intervals AS (
    SELECT b.*, lag(b.created_at) OVER (
      PARTITION BY b.route_worker_id ORDER BY b.created_at, b.id
    ) AS previous_at
    FROM unique_bags b
  )
  SELECT i.id, i.route_worker_id, i.worker_name, i.task_id,
    coalesce(t.property, 'Bolsa sin propiedad'), i.created_at, i.previous_at,
    extract(epoch FROM i.created_at - i.previous_at)
  FROM intervals i
  LEFT JOIN public.tasks t ON t.id = i.task_id
  ORDER BY i.created_at DESC, i.id;
END;
$$;

REVOKE ALL ON FUNCTION public.laundry_preparation_timings(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.laundry_preparation_timings(uuid, date) TO authenticated;
COMMENT ON FUNCTION public.laundry_preparation_timings(uuid, date) IS
  'Owner-only intervals between distinct bags per PIN worker and Madrid calendar day. Includes breaks; first bag has no duration.';
