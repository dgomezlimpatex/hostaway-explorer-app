CREATE OR REPLACE FUNCTION public.get_portal_reservation_dates_by_task_ids(_task_ids uuid[])
RETURNS TABLE (
  task_id uuid,
  arrival_date date,
  departure_date date,
  adults int,
  children int,
  source text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ar.task_id,
    ar.arrival_date,
    ar.departure_date,
    ar.adults,
    ar.children,
    'avantio'::text AS source
  FROM public.avantio_reservations ar
  WHERE ar.task_id = ANY(_task_ids)
    AND ar.status NOT IN ('cancelled', 'CANCELLED', 'Cancelled')
  UNION ALL
  SELECT
    hr.task_id,
    hr.arrival_date,
    hr.departure_date,
    hr.adults,
    NULL::int AS children,
    'hostaway'::text AS source
  FROM public.hostaway_reservations hr
  WHERE hr.task_id = ANY(_task_ids)
    AND hr.status <> 'cancelled';
$$;

GRANT EXECUTE ON FUNCTION public.get_portal_reservation_dates_by_task_ids(uuid[]) TO anon, authenticated;