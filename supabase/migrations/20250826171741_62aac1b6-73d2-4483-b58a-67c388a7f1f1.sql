-- Arreglar problema de seguridad: Restringir acceso a invitaciones de usuarios
-- Eliminar política peligrosa que permite leer todas las invitaciones

-- Primero eliminar la política actual problemática
DROP POLICY IF EXISTS "Users can read invitations sent to their email" ON public.user_invitations;

-- Crear nueva política más segura que solo permite a admins/managers ver invitaciones
CREATE POLICY "Only admins and managers can view invitations" 
ON public.user_invitations 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'manager')
  )
);

-- Permitir que usuarios autenticados verifiquen solo SU invitación específica a través de función
CREATE POLICY "Users can verify their specific invitation" 
ON public.user_invitations 
FOR SELECT 
USING (
  -- Solo si están autenticados y el email coincide exactamente con el suyo
  auth.uid() IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM auth.users au 
    WHERE au.id = auth.uid() 
    AND LOWER(TRIM(au.email)) = LOWER(TRIM(user_invitations.email))
  )
);

-- Asegurar que solo el sistema pueda insertar invitaciones
-- (Esta política probablemente ya existe pero la verificamos)
CREATE POLICY "Only system can create invitations" 
ON public.user_invitations 
FOR INSERT 
WITH CHECK (false); -- Solo funciones del sistema pueden insertar

-- Solo admins/managers pueden actualizar invitaciones
CREATE POLICY "Only admins can update invitations" 
ON public.user_invitations 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'manager')
  )
);