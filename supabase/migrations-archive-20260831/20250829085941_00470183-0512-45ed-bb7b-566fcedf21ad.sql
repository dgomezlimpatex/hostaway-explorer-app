-- Eliminar todas las políticas existentes de user_invitations
DROP POLICY IF EXISTS "Admin and managers can view all invitations" ON public.user_invitations;
DROP POLICY IF EXISTS "Admin and managers can create invitations" ON public.user_invitations;
DROP POLICY IF EXISTS "Admin and managers can update invitations" ON public.user_invitations;
DROP POLICY IF EXISTS "Admin and managers can delete invitations" ON public.user_invitations;
DROP POLICY IF EXISTS "Admins and managers can create invitations" ON public.user_invitations;
DROP POLICY IF EXISTS "Admins and managers can update invitations" ON public.user_invitations;
DROP POLICY IF EXISTS "Admins and managers can view all invitations" ON public.user_invitations;
DROP POLICY IF EXISTS "Only admins and managers can view invitations" ON public.user_invitations;
DROP POLICY IF EXISTS "Only admins can update invitations" ON public.user_invitations;
DROP POLICY IF EXISTS "Only system can create invitations" ON public.user_invitations;
DROP POLICY IF EXISTS "Users can verify their specific invitation" ON public.user_invitations;

-- Crear políticas limpias y correctas
CREATE POLICY "Admins and managers can manage invitations"
ON public.user_invitations
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager')
  )
);

-- Permitir que el sistema inserte invitaciones (para funciones automatizadas)
CREATE POLICY "System can insert invitations"
ON public.user_invitations
FOR INSERT
TO service_role
WITH CHECK (true);