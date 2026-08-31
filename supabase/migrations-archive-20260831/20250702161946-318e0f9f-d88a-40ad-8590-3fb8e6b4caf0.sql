
-- Corregir la función accept_invitation para resolver la ambigüedad de user_id
CREATE OR REPLACE FUNCTION public.accept_invitation(token uuid, user_id uuid)
 RETURNS app_role
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    invitation_role app_role;
    invitation_email TEXT;
BEGIN
    -- Obtener datos de la invitación
    SELECT role, email INTO invitation_role, invitation_email
    FROM public.user_invitations
    WHERE invitation_token = token
    AND status = 'pending'
    AND expires_at > now();
    
    IF invitation_role IS NULL THEN
        RAISE EXCEPTION 'Invitación inválida o expirada';
    END IF;
    
    -- Verificar que el email del usuario coincida (especificando explícitamente la tabla auth.users)
    IF NOT EXISTS (
        SELECT 1 FROM auth.users 
        WHERE auth.users.id = user_id AND auth.users.email = invitation_email
    ) THEN
        RAISE EXCEPTION 'El email no coincide con la invitación';
    END IF;
    
    -- Marcar invitación como aceptada
    UPDATE public.user_invitations
    SET status = 'accepted', accepted_at = now()
    WHERE invitation_token = token;
    
    -- Asignar rol al usuario (especificando explícitamente la tabla user_roles)
    INSERT INTO public.user_roles (user_id, role)
    VALUES (user_id, invitation_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RETURN invitation_role;
END;
$function$
