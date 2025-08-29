-- Fase 2: Mejoras de Seguridad
-- Corregir funciones sin search_path configurado

-- 1. Actualizar función has_role con search_path
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$function$;

-- 2. Actualizar función get_user_role con search_path
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
 RETURNS app_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY 
    CASE role
      WHEN 'admin' THEN 1
      WHEN 'manager' THEN 2
      WHEN 'supervisor' THEN 3
      WHEN 'cleaner' THEN 4
      WHEN 'client' THEN 5
      WHEN 'logistics' THEN 6
    END
  LIMIT 1
$function$;

-- 3. Actualizar función get_current_user_role con search_path
CREATE OR REPLACE FUNCTION public.get_current_user_role()
 RETURNS app_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  SELECT role FROM public.user_roles 
  WHERE user_id = auth.uid() 
  ORDER BY 
    CASE role
      WHEN 'admin' THEN 1
      WHEN 'manager' THEN 2
      WHEN 'supervisor' THEN 3
      WHEN 'cleaner' THEN 4
      WHEN 'client' THEN 5
      WHEN 'logistics' THEN 6
    END
  LIMIT 1
$function$;

-- 4. Actualizar función user_has_role con search_path
CREATE OR REPLACE FUNCTION public.user_has_role(check_role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = check_role
  )
$function$;

-- 5. Actualizar función user_is_admin_or_manager con search_path
CREATE OR REPLACE FUNCTION public.user_is_admin_or_manager()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'manager')
  )
$function$;

-- 6. Actualizar función user_has_sede_access con search_path
CREATE OR REPLACE FUNCTION public.user_has_sede_access(_user_id uuid, _sede_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  SELECT CASE 
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = _user_id AND role = 'admin'::app_role
    ) THEN true
    ELSE EXISTS (
      SELECT 1 FROM public.user_sede_access 
      WHERE user_id = _user_id 
      AND sede_id = _sede_id 
      AND can_access = true
    )
  END;
$function$;

-- 7. Actualizar función get_user_accessible_sedes con search_path
CREATE OR REPLACE FUNCTION public.get_user_accessible_sedes()
 RETURNS uuid[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  SELECT CASE 
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'::app_role
    ) THEN (
      SELECT array_agg(id) FROM public.sedes WHERE is_active = true
    )
    ELSE (
      SELECT array_agg(usa.sede_id) 
      FROM public.user_sede_access usa
      JOIN public.sedes s ON s.id = usa.sede_id
      WHERE usa.user_id = auth.uid() 
      AND usa.can_access = true 
      AND s.is_active = true
    )
  END;
$function$;

-- 8. Actualizar función log_sede_event con search_path mejorado
CREATE OR REPLACE FUNCTION public.log_sede_event(
  event_type_param text, 
  from_sede_id_param uuid DEFAULT NULL::uuid, 
  to_sede_id_param uuid DEFAULT NULL::uuid, 
  event_data_param jsonb DEFAULT '{}'::jsonb
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  -- Validar parámetros de entrada
  IF event_type_param IS NULL OR trim(event_type_param) = '' THEN
    RAISE EXCEPTION 'event_type es requerido';
  END IF;

  -- Validar que el usuario esté autenticado
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  INSERT INTO public.sede_audit_log (
    user_id,
    event_type,
    from_sede_id,
    to_sede_id,
    event_data,
    ip_address
  ) VALUES (
    auth.uid(),
    event_type_param,
    from_sede_id_param,
    to_sede_id_param,
    event_data_param,
    inet_client_addr()
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Log el error pero no fallar la operación principal
    RAISE WARNING 'Error logging sede event: %', SQLERRM;
END;
$function$;

-- 9. Actualizar función accept_invitation con search_path y mejoras de seguridad
CREATE OR REPLACE FUNCTION public.accept_invitation(invitation_token text, input_user_id uuid)
 RETURNS app_role
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
    invitation_record RECORD;
    user_email TEXT;
    user_name TEXT;
BEGIN
    -- Input validation mejorado
    IF invitation_token IS NULL OR trim(invitation_token) = '' THEN
        RAISE EXCEPTION 'Token de invitación es requerido';
    END IF;
    
    IF input_user_id IS NULL THEN
        RAISE EXCEPTION 'ID de usuario es requerido';
    END IF;
    
    -- Rate limiting check
    IF NOT public.check_rate_limit(
        input_user_id::TEXT, 
        'invitation_accept', 
        5,  -- max 5 intentos
        60, -- en 1 hora
        60  -- bloqueo por 1 hora
    ) THEN
        RAISE EXCEPTION 'Demasiados intentos de aceptar invitaciones. Intenta de nuevo más tarde.';
    END IF;
    
    -- Get invitation details with validation
    SELECT role, email, expires_at, status, invited_by
    INTO invitation_record
    FROM public.user_invitations
    WHERE user_invitations.invitation_token::text = trim(accept_invitation.invitation_token)
    AND status = 'pending';
    
    -- Validate invitation exists and is pending
    IF invitation_record.role IS NULL THEN
        RAISE EXCEPTION 'Invitación no encontrada o ya procesada';
    END IF;
    
    -- Validate invitation has not expired
    IF invitation_record.expires_at <= now() THEN
        UPDATE public.user_invitations
        SET status = 'expired'
        WHERE user_invitations.invitation_token::text = trim(accept_invitation.invitation_token);
        
        RAISE EXCEPTION 'La invitación ha expirado';
    END IF;
    
    -- Get authenticated user details
    SELECT email, COALESCE(raw_user_meta_data ->> 'full_name', email) 
    INTO user_email, user_name
    FROM auth.users 
    WHERE id = accept_invitation.input_user_id;
    
    -- Validate user exists
    IF user_email IS NULL THEN
        RAISE EXCEPTION 'Usuario no encontrado o no autenticado';
    END IF;
    
    -- CRITICAL: Verify email matches invitation
    IF LOWER(TRIM(user_email)) != LOWER(TRIM(invitation_record.email)) THEN
        RAISE EXCEPTION 'El email del usuario (%) no coincide con la invitación (%)', user_email, invitation_record.email;
    END IF;
    
    -- Check if user already has a role to prevent duplicate roles
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = accept_invitation.input_user_id) THEN
        UPDATE public.user_invitations
        SET status = 'accepted', accepted_at = now()
        WHERE user_invitations.invitation_token::text = trim(accept_invitation.invitation_token);
        
        RAISE EXCEPTION 'El usuario ya tiene un rol asignado en el sistema';
    END IF;
    
    -- Validate the inviter still has permission to assign this role
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles ur 
        WHERE ur.user_id = invitation_record.invited_by 
        AND ur.role IN ('admin', 'manager')
    ) THEN
        RAISE EXCEPTION 'El usuario que envió la invitación ya no tiene permisos para asignar roles';
    END IF;
    
    -- Mark invitation as accepted
    UPDATE public.user_invitations
    SET status = 'accepted', accepted_at = now()
    WHERE user_invitations.invitation_token::text = trim(accept_invitation.invitation_token);
    
    -- Assign role to user
    INSERT INTO public.user_roles (user_id, role)
    VALUES (accept_invitation.input_user_id, invitation_record.role);
    
    -- If role is cleaner, create cleaner record
    IF invitation_record.role = 'cleaner' THEN
        INSERT INTO public.cleaners (user_id, name, email, is_active)
        VALUES (accept_invitation.input_user_id, user_name, user_email, true)
        ON CONFLICT (user_id) DO UPDATE SET
            name = EXCLUDED.name,
            email = EXCLUDED.email,
            is_active = true,
            updated_at = now();
    END IF;
    
    -- Log successful invitation acceptance
    PERFORM public.log_security_event('invitation_accepted', jsonb_build_object(
        'accepted_role', invitation_record.role,
        'invited_by', invitation_record.invited_by
    ), accept_invitation.input_user_id);
    
    RETURN invitation_record.role;
EXCEPTION
    WHEN OTHERS THEN
        -- Log failed invitation acceptance
        PERFORM public.log_security_event('invitation_accept_failed', jsonb_build_object(
            'error', SQLERRM,
            'token_hash', md5(invitation_token)
        ), input_user_id);
        RAISE;
END;
$function$;

-- 10. Actualizar función create_user_invitation_secure con search_path mejorado
CREATE OR REPLACE FUNCTION public.create_user_invitation_secure(
  invite_email text, 
  invite_role text, 
  expires_hours integer DEFAULT 48
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
    current_user_role TEXT;
    invitation_token UUID;
    invite_expires_at TIMESTAMP WITH TIME ZONE;
    inviter_user_id UUID;
BEGIN
    inviter_user_id := auth.uid();
    
    -- Validar que el usuario esté autenticado
    IF inviter_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado';
    END IF;
    
    -- Input validation mejorado
    IF invite_email IS NULL OR trim(invite_email) = '' THEN
        RAISE EXCEPTION 'Email es requerido';
    END IF;
    
    -- Validar formato de email básico
    IF NOT invite_email ~* '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        RAISE EXCEPTION 'Formato de email inválido';
    END IF;
    
    IF invite_role IS NULL THEN
        RAISE EXCEPTION 'Rol es requerido';
    END IF;
    
    -- Validate role values (incluye logistics)
    IF invite_role NOT IN ('admin', 'manager', 'supervisor', 'cleaner', 'client', 'logistics') THEN
        RAISE EXCEPTION 'Rol no válido: %', invite_role;
    END IF;
    
    -- Validar expires_hours
    IF expires_hours IS NULL OR expires_hours < 1 OR expires_hours > 168 THEN -- máximo 1 semana
        RAISE EXCEPTION 'expires_hours debe estar entre 1 y 168 horas';
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
EXCEPTION
    WHEN OTHERS THEN
        -- Log failed invitation creation
        PERFORM public.log_security_event('invitation_create_failed', jsonb_build_object(
            'error', SQLERRM,
            'invite_email', LOWER(TRIM(invite_email)),
            'invite_role', invite_role
        ));
        RAISE;
END;
$function$;