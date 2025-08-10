CREATE OR REPLACE FUNCTION public.create_user_invitation_secure(invite_email text, invite_role text, expires_hours integer DEFAULT 48)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    current_user_role TEXT;
    invitation_token UUID;
    invite_expires_at TIMESTAMP WITH TIME ZONE;
    inviter_user_id UUID;
BEGIN
    inviter_user_id := auth.uid();
    
    -- Input validation
    IF invite_email IS NULL OR trim(invite_email) = '' THEN
        RAISE EXCEPTION 'Email es requerido';
    END IF;
    
    IF invite_role IS NULL THEN
        RAISE EXCEPTION 'Rol es requerido';
    END IF;
    
    -- Validate role values (incluye logistics)
    IF invite_role NOT IN ('admin', 'manager', 'supervisor', 'cleaner', 'client', 'logistics') THEN
        RAISE EXCEPTION 'Rol no válido';
    END IF;
    
    -- Rate limiting check
    IF NOT public.check_rate_limit(
        inviter_user_id::TEXT, 
        'invitation_request', 
        10, -- max 10 invitations
        60, -- per hour
        60  -- block for 1 hour
    ) THEN
        RAISE EXCEPTION 'Demasiadas invitaciones enviadas. Intenta de nuevo más tarde.';
    END IF;
    
    -- Get current user role for authorization
    SELECT role::TEXT INTO current_user_role
    FROM public.user_roles
    WHERE user_id = inviter_user_id;
    
    -- Authorization check
    IF current_user_role NOT IN ('admin', 'manager') THEN
        RAISE EXCEPTION 'No tienes permisos para enviar invitaciones';
    END IF;
    
    -- Prevent privilege escalation
    IF current_user_role = 'manager' AND invite_role = 'admin' THEN
        RAISE EXCEPTION 'Los managers no pueden crear usuarios admin';
    END IF;
    
    -- Check if user already exists
    IF EXISTS (
        SELECT 1 FROM auth.users 
        WHERE email = LOWER(TRIM(invite_email))
    ) THEN
        RAISE EXCEPTION 'Un usuario con este email ya existe en el sistema';
    END IF;
    
    -- Check for existing pending invitation
    IF EXISTS (
        SELECT 1 FROM public.user_invitations
        WHERE LOWER(TRIM(email)) = LOWER(TRIM(invite_email))
        AND status = 'pending'
        AND expires_at > now()
    ) THEN
        RAISE EXCEPTION 'Ya existe una invitación pendiente para este email';
    END IF;
    
    -- Mark any existing invitations as superseded
    UPDATE public.user_invitations
    SET status = 'superseded'
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(invite_email))
    AND status = 'pending';
    
    -- Generate secure invitation token and expiration
    invitation_token := gen_random_uuid();
    invite_expires_at := now() + (expires_hours || ' hours')::INTERVAL;
    
    -- Create invitation record
    INSERT INTO public.user_invitations (
        invitation_token,
        email,
        role,
        invited_by,
        expires_at,
        status
    ) VALUES (
        invitation_token,
        LOWER(TRIM(invite_email)),
        invite_role::app_role,
        inviter_user_id,
        invite_expires_at,
        'pending'
    );
    
    -- Log security event
    PERFORM public.log_security_event('invitation_created', jsonb_build_object(
        'invited_email', LOWER(TRIM(invite_email)),
        'invited_role', invite_role,
        'expires_at', invite_expires_at
    ));
    
    RETURN invitation_token;
END;
$function$