-- Security Fix Migration Phase 2: Database Functions and Enhanced Security

-- Fix database functions security by adding SET search_path = ''
-- Update existing functions that don't have proper search_path

CREATE OR REPLACE FUNCTION public.update_cleaners_order(cleaner_updates jsonb[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    update_item JSONB;
BEGIN
    FOREACH update_item IN ARRAY cleaner_updates
    LOOP
        UPDATE public.cleaners 
        SET sort_order = (update_item->>'sortOrder')::INTEGER
        WHERE id = (update_item->>'id')::UUID;
    END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_inventory_stock_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    NEW.last_updated = now();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

-- Enhanced invitation security with rate limiting and audit logging
CREATE OR REPLACE FUNCTION public.accept_invitation(invitation_token text, input_user_id uuid)
RETURNS app_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    invitation_record RECORD;
    user_email TEXT;
    user_name TEXT;
    existing_roles_count INTEGER;
BEGIN
    -- Input validation
    IF invitation_token IS NULL OR trim(invitation_token) = '' THEN
        PERFORM public.log_security_event('invitation_accept_failed', jsonb_build_object(
            'reason', 'missing_token',
            'user_id', input_user_id
        ), input_user_id);
        RAISE EXCEPTION 'Token de invitación es requerido';
    END IF;
    
    IF input_user_id IS NULL THEN
        PERFORM public.log_security_event('invitation_accept_failed', jsonb_build_object(
            'reason', 'missing_user_id'
        ));
        RAISE EXCEPTION 'ID de usuario es requerido';
    END IF;
    
    -- Check for rate limiting (max 5 attempts per hour per user)
    SELECT COUNT(*) INTO existing_roles_count
    FROM public.security_audit_log
    WHERE user_id = input_user_id
    AND event_type = 'invitation_accept_failed'
    AND created_at > now() - interval '1 hour';
    
    IF existing_roles_count >= 5 THEN
        PERFORM public.log_security_event('invitation_rate_limit_exceeded', jsonb_build_object(
            'attempts_in_hour', existing_roles_count
        ), input_user_id);
        RAISE EXCEPTION 'Demasiados intentos fallidos. Intenta de nuevo más tarde.';
    END IF;
    
    -- Get invitation details with validation
    SELECT role, email, expires_at, status, invited_by
    INTO invitation_record
    FROM public.user_invitations
    WHERE user_invitations.invitation_token::text = trim(accept_invitation.invitation_token)
    AND status = 'pending';
    
    -- Validate invitation exists and is pending
    IF invitation_record.role IS NULL THEN
        PERFORM public.log_security_event('invitation_accept_failed', jsonb_build_object(
            'reason', 'invalid_token',
            'token', invitation_token
        ), input_user_id);
        RAISE EXCEPTION 'Invitación no encontrada o ya procesada';
    END IF;
    
    -- Validate invitation has not expired
    IF invitation_record.expires_at <= now() THEN
        UPDATE public.user_invitations
        SET status = 'expired'
        WHERE user_invitations.invitation_token::text = trim(accept_invitation.invitation_token);
        
        PERFORM public.log_security_event('invitation_accept_failed', jsonb_build_object(
            'reason', 'expired_token',
            'token', invitation_token,
            'expired_at', invitation_record.expires_at
        ), input_user_id);
        RAISE EXCEPTION 'La invitación ha expirado';
    END IF;
    
    -- Get authenticated user details
    SELECT email, COALESCE(raw_user_meta_data ->> 'full_name', email) 
    INTO user_email, user_name
    FROM auth.users 
    WHERE id = accept_invitation.input_user_id;
    
    -- Validate user exists
    IF user_email IS NULL THEN
        PERFORM public.log_security_event('invitation_accept_failed', jsonb_build_object(
            'reason', 'user_not_found'
        ), input_user_id);
        RAISE EXCEPTION 'Usuario no encontrado o no autenticado';
    END IF;
    
    -- CRITICAL: Verify email matches invitation
    IF LOWER(TRIM(user_email)) != LOWER(TRIM(invitation_record.email)) THEN
        PERFORM public.log_security_event('invitation_security_violation', jsonb_build_object(
            'reason', 'email_mismatch',
            'user_email', user_email,
            'invitation_email', invitation_record.email
        ), input_user_id);
        RAISE EXCEPTION 'El email del usuario (%) no coincide con la invitación (%)', user_email, invitation_record.email;
    END IF;
    
    -- Check if user already has a role to prevent duplicate roles
    SELECT COUNT(*) INTO existing_roles_count
    FROM public.user_roles 
    WHERE user_id = accept_invitation.input_user_id;
    
    IF existing_roles_count > 0 THEN
        UPDATE public.user_invitations
        SET status = 'accepted', accepted_at = now()
        WHERE user_invitations.invitation_token::text = trim(accept_invitation.invitation_token);
        
        PERFORM public.log_security_event('invitation_accept_failed', jsonb_build_object(
            'reason', 'user_already_has_role',
            'existing_roles_count', existing_roles_count
        ), input_user_id);
        RAISE EXCEPTION 'El usuario ya tiene un rol asignado en el sistema';
    END IF;
    
    -- Validate the inviter still has permission to assign this role
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles ur 
        WHERE ur.user_id = invitation_record.invited_by 
        AND ur.role IN ('admin', 'manager')
    ) THEN
        PERFORM public.log_security_event('invitation_security_violation', jsonb_build_object(
            'reason', 'inviter_no_permission',
            'inviter_id', invitation_record.invited_by
        ), input_user_id);
        RAISE EXCEPTION 'El usuario que envió la invitación ya no tiene permisos para asignar roles';
    END IF;
    
    -- Mark invitation as accepted
    UPDATE public.user_invitations
    SET status = 'accepted', accepted_at = now()
    WHERE user_invitations.invitation_token::text = trim(accept_invitation.invitation_token);
    
    -- Assign role to user
    INSERT INTO public.user_roles (user_id, role)
    VALUES (accept_invitation.input_user_id, invitation_record.role);
    
    -- Log successful role assignment
    PERFORM public.log_security_event('role_assigned', jsonb_build_object(
        'role', invitation_record.role,
        'assigned_by', invitation_record.invited_by,
        'method', 'invitation'
    ), input_user_id);
    
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
    
    RETURN invitation_record.role;
END;
$function$;

-- Create function to check for privilege escalation attempts
CREATE OR REPLACE FUNCTION public.check_role_assignment_security(target_user_id uuid, new_role app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    current_user_role app_role;
    target_current_role app_role;
BEGIN
    -- Get current user's role
    SELECT role INTO current_user_role
    FROM public.user_roles
    WHERE user_id = auth.uid();
    
    -- Get target user's current role
    SELECT role INTO target_current_role
    FROM public.user_roles
    WHERE user_id = target_user_id;
    
    -- Only admin and manager can assign roles
    IF current_user_role NOT IN ('admin', 'manager') THEN
        PERFORM public.log_security_event('unauthorized_role_assignment_attempt', jsonb_build_object(
            'target_user_id', target_user_id,
            'attempted_role', new_role,
            'current_user_role', current_user_role
        ));
        RETURN false;
    END IF;
    
    -- Prevent privilege escalation: users cannot assign roles higher than their own
    IF current_user_role = 'manager' AND new_role = 'admin' THEN
        PERFORM public.log_security_event('privilege_escalation_attempt', jsonb_build_object(
            'target_user_id', target_user_id,
            'attempted_role', new_role,
            'current_user_role', current_user_role
        ));
        RETURN false;
    END IF;
    
    -- Log successful role assignment authorization
    PERFORM public.log_security_event('role_assignment_authorized', jsonb_build_object(
        'target_user_id', target_user_id,
        'new_role', new_role,
        'previous_role', target_current_role
    ));
    
    RETURN true;
END;
$function$;

-- Enhanced user management RLS policy update
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

CREATE POLICY "Secure role management for admins and managers"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'manager')
  )
)
WITH CHECK (
  -- Use the security check function for assignments
  public.check_role_assignment_security(user_roles.user_id, user_roles.role)
);

-- Add trigger to automatically cleanup expired invitations
CREATE OR REPLACE FUNCTION public.cleanup_expired_invitations_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    -- Auto-cleanup expired invitations older than 30 days
    DELETE FROM public.user_invitations
    WHERE status = 'expired'
    AND expires_at < now() - interval '30 days';
    
    RETURN NULL;
END;
$function$;

-- Create trigger that runs cleanup when invitations are accessed
CREATE OR REPLACE TRIGGER cleanup_expired_invitations_on_access
AFTER SELECT ON public.user_invitations
FOR EACH STATEMENT
EXECUTE FUNCTION public.cleanup_expired_invitations_trigger();