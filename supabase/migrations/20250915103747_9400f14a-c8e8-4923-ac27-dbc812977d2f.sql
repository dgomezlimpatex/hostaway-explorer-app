-- Modificar función para que admins solo vean sus sedes asignadas, no todas
CREATE OR REPLACE FUNCTION public.get_user_accessible_sedes()
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT array_agg(usa.sede_id) 
     FROM public.user_sede_access usa
     JOIN public.sedes s ON s.id = usa.sede_id
     WHERE usa.user_id = auth.uid() 
     AND usa.can_access = true 
     AND s.is_active = true),
    ARRAY[]::uuid[]
  );
$$;