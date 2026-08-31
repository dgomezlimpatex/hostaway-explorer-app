-- Arreglar la función get_user_accessible_sedes para administradores
CREATE OR REPLACE FUNCTION public.get_user_accessible_sedes()
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'::app_role
    ) THEN (
      SELECT array_agg(id) FROM public.sedes WHERE is_active = true
    )
    ELSE (
      SELECT array_agg(usa.sede_id) 
      FROM public.user_sede_access usa
      JOIN public.sedes s ON s.id = usa.sede_id
      WHERE usa.user_id = auth.uid() 
      AND usa.can_access = true 
      AND s.is_active = true
    )
  END;
$$;