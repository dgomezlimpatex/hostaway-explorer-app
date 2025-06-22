
-- Eliminar la constraint única del email
ALTER TABLE public.user_invitations DROP CONSTRAINT IF EXISTS user_invitations_email_key;

-- Crear una constraint única compuesta que solo permita una invitación pendiente por email
CREATE UNIQUE INDEX user_invitations_email_pending_unique 
ON public.user_invitations (email) 
WHERE status = 'pending';
