CREATE OR REPLACE FUNCTION public.accept_invitation(invitation_token text, input_user_id uuid)
 RETURNS app_role
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    invitation_record RECORD;
    user_email TEXT;
    user_name TEXT;
    existing_cleaner_id UUID;
BEGIN
    IF invitation_token IS NULL OR trim(invitation_token) = '' THEN
        RAISE EXCEPTION 'Token de invitación es requerido';
    END IF;

    IF input_user_id IS NULL THEN
        RAISE EXCEPTION 'ID de usuario es requerido';
    END IF;

    IF NOT public.check_rate_limit(
        input_user_id::TEXT,
        'invitation_accept',
        5, 60, 60
    ) THEN
        RAISE EXCEPTION 'Demasiados intentos de aceptar invitaciones. Intenta de nuevo más tarde.';
    END IF;

    SELECT role, email, expires_at, status, invited_by, sede_id
    INTO invitation_record
    FROM public.user_invitations
    WHERE user_invitations.invitation_token::text = trim(accept_invitation.invitation_token)
    AND status = 'pending';

    IF invitation_record.role IS NULL THEN
        RAISE EXCEPTION 'Invitación no encontrada o ya procesada';
    END IF;

    IF invitation_record.expires_at <= now() THEN
        UPDATE public.user_invitations
        SET status = 'expired'
        WHERE user_invitations.invitation_token::text = trim(accept_invitation.invitation_token);
        RAISE EXCEPTION 'La invitación ha expirado';
    END IF;

    SELECT email, COALESCE(raw_user_meta_data ->> 'full_name', email)
    INTO user_email, user_name
    FROM auth.users
    WHERE id = accept_invitation.input_user_id;

    IF user_email IS NULL THEN
        RAISE EXCEPTION 'Usuario no encontrado o no autenticado';
    END IF;

    IF LOWER(TRIM(user_email)) != LOWER(TRIM(invitation_record.email)) THEN
        RAISE EXCEPTION 'El email del usuario (%) no coincide con la invitación (%)', user_email, invitation_record.email;
    END IF;

    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = accept_invitation.input_user_id) THEN
        UPDATE public.user_invitations
        SET status = 'accepted', accepted_at = now()
        WHERE user_invitations.invitation_token::text = trim(accept_invitation.invitation_token);
        RAISE EXCEPTION 'El usuario ya tiene un rol asignado en el sistema';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = invitation_record.invited_by
        AND ur.role IN ('admin', 'manager')
    ) THEN
        RAISE EXCEPTION 'El usuario que envió la invitación ya no tiene permisos para asignar roles';
    END IF;

    UPDATE public.user_invitations
    SET status = 'accepted', accepted_at = now()
    WHERE user_invitations.invitation_token::text = trim(accept_invitation.invitation_token);

    INSERT INTO public.user_roles (user_id, role)
    VALUES (accept_invitation.input_user_id, invitation_record.role);

    IF invitation_record.role = 'cleaner' THEN
        IF invitation_record.sede_id IS NULL THEN
            RAISE EXCEPTION 'La invitación para cleaner debe incluir una sede válida';
        END IF;

        -- Try to link to an existing cleaner by email (no user_id yet) — created via REGISTRO sync or manual
        SELECT id INTO existing_cleaner_id
        FROM public.cleaners
        WHERE LOWER(TRIM(email)) = LOWER(TRIM(user_email))
          AND user_id IS NULL
        ORDER BY created_at ASC
        LIMIT 1;

        IF existing_cleaner_id IS NOT NULL THEN
            UPDATE public.cleaners
            SET user_id = accept_invitation.input_user_id,
                is_active = true,
                sede_id = COALESCE(sede_id, invitation_record.sede_id),
                name = COALESCE(NULLIF(name, ''), user_name),
                updated_at = now()
            WHERE id = existing_cleaner_id;
        ELSE
            INSERT INTO public.cleaners (user_id, name, email, is_active, sede_id)
            VALUES (accept_invitation.input_user_id, user_name, user_email, true, invitation_record.sede_id)
            ON CONFLICT (user_id) DO UPDATE SET
                name = EXCLUDED.name,
                email = EXCLUDED.email,
                is_active = true,
                sede_id = EXCLUDED.sede_id,
                updated_at = now();
        END IF;
    END IF;

    IF invitation_record.sede_id IS NOT NULL AND invitation_record.role != 'admin' THEN
        INSERT INTO public.user_sede_access (user_id, sede_id, can_access)
        VALUES (accept_invitation.input_user_id, invitation_record.sede_id, true)
        ON CONFLICT (user_id, sede_id) DO UPDATE SET
            can_access = true,
            updated_at = now();
    END IF;

    PERFORM public.log_security_event('invitation_accepted', jsonb_build_object(
        'accepted_role', invitation_record.role,
        'invited_by', invitation_record.invited_by,
        'sede_id', invitation_record.sede_id,
        'linked_existing_cleaner', existing_cleaner_id IS NOT NULL
    ), accept_invitation.input_user_id);

    RETURN invitation_record.role;
EXCEPTION
    WHEN OTHERS THEN
        PERFORM public.log_security_event('invitation_accept_failed', jsonb_build_object(
            'error', SQLERRM,
            'token_hash', md5(invitation_token)
        ), input_user_id);
        RAISE;
END;
$function$;