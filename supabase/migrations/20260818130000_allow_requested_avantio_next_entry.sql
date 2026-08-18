-- Keep Avantio entries marked REQUESTED visible in the admin next-entry card.
-- The card is informational and must not hide a future arrival already present
-- in the reservation feed; this does not create tasks or change sync behavior.

CREATE OR REPLACE FUNCTION public.get_admin_next_client_entry(
  _property_id uuid,
  _from_date date
)
RETURNS TABLE (
  check_in_date date,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL
     OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only administrators can view the next client entry'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH candidate_entries AS (
    SELECT
      reservation.check_in_date,
      reservation.updated_at
    FROM public.client_reservations AS reservation
    WHERE reservation.property_id = _property_id
      AND reservation.check_in_date >= _from_date
      AND lower(reservation.status) NOT IN ('cancelled', 'canceled')

    UNION ALL

    SELECT
      reservation.arrival_date AS check_in_date,
      reservation.updated_at
    FROM public.avantio_reservations AS reservation
    WHERE reservation.property_id = _property_id
      AND reservation.arrival_date >= _from_date
      AND reservation.cancellation_date IS NULL
      AND lower(reservation.status) NOT IN (
        'cancelled',
        'canceled',
        'unavailable',
        'unavaliable',
        'pending',
        'tentative'
      )
  )
  SELECT
    candidate.check_in_date,
    candidate.updated_at
  FROM candidate_entries AS candidate
  ORDER BY candidate.check_in_date ASC, candidate.updated_at DESC
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_next_client_entry(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_next_client_entry(uuid, date) TO authenticated;
