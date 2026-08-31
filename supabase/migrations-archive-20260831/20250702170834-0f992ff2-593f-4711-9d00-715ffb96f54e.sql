-- Agregar política para permitir que usuarios lean invitaciones dirigidas a su email
CREATE POLICY "Usuarios pueden leer invitaciones dirigidas a su email" 
ON public.user_invitations 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND email = (
    SELECT email FROM auth.users WHERE id = auth.uid()
  )
);