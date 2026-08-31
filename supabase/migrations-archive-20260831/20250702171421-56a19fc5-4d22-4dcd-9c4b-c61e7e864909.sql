-- Primero eliminar todas las políticas existentes en user_invitations
DROP POLICY IF EXISTS "Admins y managers pueden ver invitaciones" ON public.user_invitations;
DROP POLICY IF EXISTS "Admins y managers pueden crear invitaciones" ON public.user_invitations;
DROP POLICY IF EXISTS "Admins y managers pueden actualizar invitaciones" ON public.user_invitations;
DROP POLICY IF EXISTS "Usuarios pueden leer invitaciones dirigidas a su email" ON public.user_invitations;

-- Crear nuevas políticas con mejor sintaxis y depuración
CREATE POLICY "Allow admins and managers to view invitations" 
ON public.user_invitations 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'manager')
  )
);

CREATE POLICY "Allow admins and managers to create invitations" 
ON public.user_invitations 
FOR INSERT 
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'manager')
  )
);

CREATE POLICY "Allow admins and managers to update invitations" 
ON public.user_invitations 
FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'manager')
  )
);

CREATE POLICY "Allow users to read invitations sent to their email" 
ON public.user_invitations 
FOR SELECT 
TO authenticated
USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- Verificar que el usuario actual tenga el rol de admin
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = '4e13cf15-9e1e-4b0a-a20d-c9037f3a4bd8' 
    AND role = 'admin'
  ) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES ('4e13cf15-9e1e-4b0a-a20d-c9037f3a4bd8', 'admin');
  END IF;
END $$;