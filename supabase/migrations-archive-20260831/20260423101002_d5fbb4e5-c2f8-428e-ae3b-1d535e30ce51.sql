CREATE OR REPLACE FUNCTION public.get_client_reservation_history(_client_id uuid, _limit integer DEFAULT 200, _offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, reservation_id uuid, client_id uuid, client_name text, property_id uuid, property_name text, property_code text, action text, actor_type text, actor_user_id uuid, actor_name text, actor_email text, old_data jsonb, new_data jsonb, notes text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.user_is_admin_or_manager() THEN
    RAISE EXCEPTION 'No tienes permisos para consultar el histórico de reservas';
  END IF;

  IF _client_id IS NULL THEN
    RAISE EXCEPTION 'client_id es requerido';
  END IF;

  RETURN QUERY
  SELECT
    l.id,
    l.reservation_id,
    l.client_id,
    c.nombre::text AS client_name,
    COALESCE(l.property_id, r.property_id, NULLIF((l.new_data->>'propertyId'),'')::uuid, NULLIF((l.old_data->>'propertyId'),'')::uuid) AS property_id,
    COALESCE(
      l.property_name,
      p.nombre,
      l.new_data->>'propertyName',
      l.old_data->>'propertyName'
    )::text AS property_name,
    p.codigo::text AS property_code,
    l.action::text AS action,
    l.actor_type::text AS actor_type,
    l.actor_user_id,
    l.actor_name::text AS actor_name,
    l.actor_email::text AS actor_email,
    l.old_data,
    l.new_data,
    l.notes::text AS notes,
    l.created_at
  FROM public.client_reservation_logs l
  LEFT JOIN public.clients c ON c.id = l.client_id
  LEFT JOIN public.client_reservations r ON r.id = l.reservation_id
  LEFT JOIN public.properties p
    ON p.id = COALESCE(
        l.property_id,
        r.property_id,
        NULLIF((l.new_data->>'propertyId'),'')::uuid,
        NULLIF((l.old_data->>'propertyId'),'')::uuid
      )
  WHERE l.client_id = _client_id
  ORDER BY l.created_at DESC
  LIMIT GREATEST(_limit, 1)
  OFFSET GREATEST(_offset, 0);
END;
$function$;