-- Include same-day arrivals in the admin task reservation summary.
-- A checkout cleaning can coincide with the next guest's arrival date.
CREATE OR REPLACE FUNCTION public.get_admin_next_client_entry(
  _property_id uuid,
  _from_date date
)
RETURNS TABLE(check_in_date date, updated_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL
     OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only administrators can view the next client entry'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH candidate_entries AS (
    SELECT reservation.check_in_date, reservation.updated_at
    FROM public.client_reservations AS reservation
    WHERE reservation.property_id = _property_id
      AND reservation.check_in_date >= _from_date
      AND lower(reservation.status) NOT IN ('cancelled', 'canceled')

    UNION ALL

    SELECT reservation.arrival_date AS check_in_date, reservation.updated_at
    FROM public.avantio_reservations AS reservation
    WHERE reservation.property_id = _property_id
      AND reservation.arrival_date >= _from_date
      AND reservation.cancellation_date IS NULL
      -- REQUESTED/provisional entries are not real future stays.
      AND lower(reservation.status) IN ('confirmed', 'modified')
  )
  SELECT candidate.check_in_date, candidate.updated_at
  FROM candidate_entries AS candidate
  ORDER BY candidate.check_in_date ASC, candidate.updated_at DESC
  LIMIT 1;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_admin_next_client_entry(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_next_client_entry(uuid, date) TO authenticated;
