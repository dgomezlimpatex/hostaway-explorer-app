-- Eliminar las funciones duplicadas de verify_invitation
DROP FUNCTION IF EXISTS public.verify_invitation(uuid, text);
DROP FUNCTION IF EXISTS public.verify_invitation(text, text);

-- Crear una sola función verify_invitation que maneje tokens como texto
CREATE OR REPLACE FUNCTION public.verify_invitation(token text, email text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM public.user_invitations
        WHERE invitation_token::text = $1
        AND email = $2
        AND status = 'pending'
        AND expires_at > now()
    )
$function$;

-- También asegurar que accept_invitation use texto para el token
DROP FUNCTION IF EXISTS public.accept_invitation(uuid, uuid);

CREATE OR REPLACE FUNCTION public.accept_invitation(invitation_token text, input_user_id uuid)
 RETURNS app_role
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    invitation_role app_role;
    invitation_email TEXT;
    user_email TEXT;
    user_name TEXT;
BEGIN
    -- Obtener datos de la invitación usando text
    SELECT role, email INTO invitation_role, invitation_email
    FROM public.user_invitations
    WHERE user_invitations.invitation_token::text = accept_invitation.invitation_token
    AND status = 'pending'
    AND expires_at > now();
    
    IF invitation_role IS NULL THEN
        RAISE EXCEPTION 'Invitación inválida, expirada o ya aceptada';
    END IF;
    
    -- Obtener datos del usuario autenticado
    SELECT email, COALESCE(raw_user_meta_data ->> 'full_name', email) 
    INTO user_email, user_name
    FROM auth.users 
    WHERE id = accept_invitation.input_user_id;
    
    -- Verificar que el email del usuario coincida
    IF user_email != invitation_email THEN
        RAISE EXCEPTION 'El email del usuario (%s) no coincide con la invitación (%s)', user_email, invitation_email;
    END IF;
    
    -- Marcar invitación como aceptada
    UPDATE public.user_invitations
    SET status = 'accepted', accepted_at = now()
    WHERE user_invitations.invitation_token::text = accept_invitation.invitation_token;
    
    -- Asignar rol al usuario
    INSERT INTO public.user_roles (user_id, role)
    VALUES (accept_invitation.input_user_id, invitation_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    
    -- Si el rol es cleaner, crear automáticamente el registro en cleaners
    IF invitation_role = 'cleaner' THEN
        INSERT INTO public.cleaners (user_id, name, email, is_active)
        VALUES (accept_invitation.input_user_id, user_name, user_email, true)
        ON CONFLICT (user_id) DO UPDATE SET
            name = EXCLUDED.name,
            email = EXCLUDED.email,
            is_active = true,
            updated_at = now();
    END IF;
    
    RETURN invitation_role;
END;
$function$;