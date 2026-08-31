-- Habilitar RLS en la tabla user_invitations si no está habilitada
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

-- Crear política para que admins y managers puedan ver todas las invitaciones
CREATE POLICY "Admin and managers can view all invitations"
ON public.user_invitations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager')
  )
);

-- Crear política para que admins y managers puedan crear invitaciones
CREATE POLICY "Admin and managers can create invitations"
ON public.user_invitations
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager')
  )
);

-- Crear política para que admins y managers puedan actualizar invitaciones
CREATE POLICY "Admin and managers can update invitations"
ON public.user_invitations
FOR UPDATE
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

-- Crear política para que admins y managers puedan eliminar invitaciones
CREATE POLICY "Admin and managers can delete invitations"
ON public.user_invitations
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager')
  )
);