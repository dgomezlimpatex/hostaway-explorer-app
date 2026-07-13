-- Show the nearest client-portal check-in in task details, exclusively to admins.
-- SECURITY DEFINER is required so the RPC owns the read path, but the explicit
-- role check prevents cleaners, managers and anonymous portal users from using it.

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
  SELECT
    reservation.check_in_date,
    reservation.updated_at
  FROM public.client_reservations AS reservation
  WHERE reservation.property_id = _property_id
    AND reservation.check_in_date >= _from_date
    AND reservation.status <> 'cancelled'
  ORDER BY reservation.check_in_date ASC, reservation.updated_at DESC
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_next_client_entry(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_next_client_entry(uuid, date) TO authenticated;

-- The legacy SELECT policy exposed every client reservation to every signed-in
-- role, including cleaners. Preserve the operational access used by planning
-- roles while removing direct access for cleaners and client accounts.
DROP POLICY IF EXISTS "Users can view all reservations" ON public.client_reservations;

CREATE POLICY "Operational roles can view client reservations"
ON public.client_reservations
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
  OR public.has_role(auth.uid(), 'supervisor'::public.app_role)
);
