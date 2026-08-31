-- Primero verificar que el usuario admin actual tenga su rol asignado
INSERT INTO public.user_roles (user_id, role)
SELECT auth.uid(), 'admin'::app_role
WHERE auth.uid() IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = auth.uid()
)
ON CONFLICT (user_id, role) DO NOTHING;

-- Actualizar las políticas RLS para user_invitations
DROP POLICY IF EXISTS "Admin y managers pueden ver todas las invitaciones" ON public.user_invitations;
DROP POLICY IF EXISTS "Admin y managers pueden crear invitaciones" ON public.user_invitations;
DROP POLICY IF EXISTS "Admin y managers pueden actualizar invitaciones" ON public.user_invitations;

-- Crear nuevas políticas más específicas
CREATE POLICY "Admins y managers pueden ver invitaciones" 
ON public.user_invitations 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'manager')
  )
);

CREATE POLICY "Admins y managers pueden crear invitaciones" 
ON public.user_invitations 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'manager')
  )
);

CREATE POLICY "Admins y managers pueden actualizar invitaciones" 
ON public.user_invitations 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'manager')
  )
);