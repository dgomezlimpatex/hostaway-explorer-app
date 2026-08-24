-- Supervisión: limitar la consulta de ocupación a reservas relevantes.
-- Conserva la reserva actualmente activa y las futuras; evita cargar todo el
-- histórico de años anteriores en cada actualización de la agenda.

CREATE OR REPLACE FUNCTION public.get_supervision_property_reservations(
  _property_ids UUID[]
)
RETURNS TABLE (
  property_id UUID,
  check_in_date DATE,
  check_out_date DATE,
  status TEXT,
  source TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH context AS (
    SELECT (timezone('Europe/Madrid', now()))::DATE AS today_madrid
  ),
  allowed_properties AS (
    SELECT DISTINCT p.id
    FROM public.properties p
    JOIN public.property_group_assignments pga ON pga.property_id = p.id
    JOIN public.supervision_building_supervisors a ON a.property_group_id = pga.property_group_id
    WHERE p.id = ANY(COALESCE(_property_ids, ARRAY[]::UUID[]))
      AND (
        (
          public.user_is_admin_or_manager()
          AND public.user_has_sede_access(auth.uid(), p.sede_id)
        )
        OR (
          a.supervisor_user_id = auth.uid()
          AND a.is_active
          AND (a.starts_on IS NULL OR a.starts_on <= CURRENT_DATE)
          AND (a.ends_on IS NULL OR a.ends_on >= CURRENT_DATE)
          AND public.user_has_sede_access(auth.uid(), p.sede_id)
        )
      )
  )
  SELECT r.property_id, r.check_in_date, r.check_out_date, r.status::TEXT, 'client_portal'::TEXT
  FROM public.client_reservations r
  JOIN allowed_properties ap ON ap.id = r.property_id
  CROSS JOIN context c
  WHERE lower(r.status::TEXT) <> 'cancelled'
    AND r.check_out_date >= c.today_madrid
    AND r.check_in_date <= c.today_madrid + 365

  UNION ALL

  SELECT r.property_id, r.arrival_date, r.departure_date, r.status::TEXT, 'avantio'::TEXT
  FROM public.avantio_reservations r
  JOIN allowed_properties ap ON ap.id = r.property_id
  CROSS JOIN context c
  WHERE lower(r.status::TEXT) NOT IN ('cancelled', 'canceled')
    AND r.departure_date >= c.today_madrid
    AND r.arrival_date <= c.today_madrid + 365

  UNION ALL

  SELECT r.property_id, r.arrival_date, r.departure_date, r.status::TEXT, 'hostaway'::TEXT
  FROM public.hostaway_reservations r
  JOIN allowed_properties ap ON ap.id = r.property_id
  CROSS JOIN context c
  WHERE lower(r.status::TEXT) NOT IN ('cancelled', 'canceled')
    AND r.departure_date >= c.today_madrid
    AND r.arrival_date <= c.today_madrid + 365

  UNION ALL

  SELECT r.property_id, r.check_in, r.check_out, r.status::TEXT, 'smoobu'::TEXT
  FROM public.smoobu_reservations r
  JOIN allowed_properties ap ON ap.id = r.property_id
  CROSS JOIN context c
  WHERE lower(r.status::TEXT) NOT IN ('cancelled', 'canceled')
    AND r.check_out >= c.today_madrid
    AND r.check_in <= c.today_madrid + 365;
$$;

REVOKE ALL ON FUNCTION public.get_supervision_property_reservations(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_supervision_property_reservations(UUID[]) TO authenticated;
