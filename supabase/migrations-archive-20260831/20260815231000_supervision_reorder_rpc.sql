-- Reordenación atómica de paradas de supervisión.
-- La autorización y el bloqueo de ruta se comprueban dentro de la misma transacción.

CREATE OR REPLACE FUNCTION public.reorder_supervision_stop(
  _stop_id UUID,
  _neighbor_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_stop public.supervision_route_stops;
  neighbor_stop public.supervision_route_stops;
  route_sede UUID;
  route_status public.supervision_route_status;
  temporary_sequence INTEGER;
BEGIN
  PERFORM 1
  FROM public.supervision_route_stops
  WHERE id IN (_stop_id, _neighbor_id)
  ORDER BY id
  FOR UPDATE;

  SELECT s.*
  INTO current_stop
  FROM public.supervision_route_stops s
  WHERE s.id = _stop_id;

  SELECT r.sede_id, r.status
  INTO route_sede, route_status
  FROM public.supervision_routes r
  WHERE r.id = current_stop.route_id;

  SELECT s.*
  INTO neighbor_stop
  FROM public.supervision_route_stops s
  WHERE s.id = _neighbor_id;

  IF current_stop.id IS NULL OR neighbor_stop.id IS NULL THEN
    RAISE EXCEPTION 'supervision stop not found';
  END IF;
  IF current_stop.route_id IS DISTINCT FROM neighbor_stop.route_id THEN
    RAISE EXCEPTION 'supervision stops must belong to the same route';
  END IF;
  IF route_status = 'completed' THEN
    RAISE EXCEPTION 'supervision route is completed and read-only';
  END IF;
  IF NOT public.supervision_user_can_access_sede(route_sede) THEN
    RAISE EXCEPTION 'supervision route access denied';
  END IF;

  SELECT COALESCE(MIN(sequence), 0) - 1
  INTO temporary_sequence
  FROM public.supervision_route_stops
  WHERE route_id = current_stop.route_id;

  UPDATE public.supervision_route_stops
  SET sequence = temporary_sequence
  WHERE id = current_stop.id;

  UPDATE public.supervision_route_stops
  SET sequence = current_stop.sequence
  WHERE id = neighbor_stop.id;

  UPDATE public.supervision_route_stops
  SET sequence = neighbor_stop.sequence
  WHERE id = current_stop.id;
END;
$$;

REVOKE ALL ON FUNCTION public.reorder_supervision_stop(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reorder_supervision_stop(UUID, UUID) TO authenticated;
