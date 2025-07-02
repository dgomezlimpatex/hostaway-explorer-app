-- Crear función security definer para verificar roles
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.user_roles 
  WHERE user_id = auth.uid() 
  ORDER BY 
    CASE role
      WHEN 'admin' THEN 1
      WHEN 'manager' THEN 2
      WHEN 'supervisor' THEN 3
      WHEN 'cleaner' THEN 4
      WHEN 'client' THEN 5
    END
  LIMIT 1
$$;

-- Función para verificar si el usuario tiene un rol específico
CREATE OR REPLACE FUNCTION public.user_has_role(check_role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = check_role
  )
$$;

-- Función para verificar si el usuario es admin o manager
CREATE OR REPLACE FUNCTION public.user_is_admin_or_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'manager')
  )
$$;

-- Recrear políticas usando las funciones security definer
DROP POLICY IF EXISTS "Allow admins and managers to view invitations" ON public.user_invitations;
DROP POLICY IF EXISTS "Allow admins and managers to create invitations" ON public.user_invitations;
DROP POLICY IF EXISTS "Allow admins and managers to update invitations" ON public.user_invitations;
DROP POLICY IF EXISTS "Allow users to read invitations sent to their email" ON public.user_invitations;

CREATE POLICY "Allow admins and managers to view invitations" 
ON public.user_invitations 
FOR SELECT 
TO authenticated
USING (public.user_is_admin_or_manager());

CREATE POLICY "Allow admins and managers to create invitations" 
ON public.user_invitations 
FOR INSERT 
TO authenticated
WITH CHECK (public.user_is_admin_or_manager());

CREATE POLICY "Allow admins and managers to update invitations" 
ON public.user_invitations 
FOR UPDATE 
TO authenticated
USING (public.user_is_admin_or_manager());

CREATE POLICY "Allow users to read their own invitations" 
ON public.user_invitations 
FOR SELECT 
TO authenticated
USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
);