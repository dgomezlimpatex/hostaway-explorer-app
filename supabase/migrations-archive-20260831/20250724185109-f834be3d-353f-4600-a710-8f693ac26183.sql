-- CRITICAL SECURITY FIXES - Phase 1 (Fixed Type Casting)

-- 1. Fix Role Escalation Vulnerability - Prevent users from inserting admin/manager roles
CREATE POLICY "Prevent role escalation during insertion" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (
  -- Only admins can assign admin roles
  (role = 'admin'::app_role AND EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role
  )) OR
  -- Only admins and managers can assign manager roles
  (role = 'manager'::app_role AND EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() AND ur.role = ANY(ARRAY['admin'::app_role, 'manager'::app_role])
  )) OR
  -- Only admins and managers can assign supervisor roles
  (role = 'supervisor'::app_role AND EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() AND ur.role = ANY(ARRAY['admin'::app_role, 'manager'::app_role])
  )) OR
  -- Only admins and managers can assign cleaner roles (through invitation system)
  (role = 'cleaner'::app_role AND EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() AND ur.role = ANY(ARRAY['admin'::app_role, 'manager'::app_role])
  ))
);

-- 2. Secure Database Functions - Add search_path to all SECURITY DEFINER functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$function$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
 RETURNS app_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = ''
AS $function$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY 
    CASE role
      WHEN 'admin'::app_role THEN 1
      WHEN 'manager'::app_role THEN 2
      WHEN 'supervisor'::app_role THEN 3
      WHEN 'cleaner'::app_role THEN 4
      WHEN 'client'::app_role THEN 5
    END
  LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.get_current_user_role()
 RETURNS app_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = ''
AS $function$
  SELECT role FROM public.user_roles 
  WHERE user_id = auth.uid() 
  ORDER BY 
    CASE role
      WHEN 'admin'::app_role THEN 1
      WHEN 'manager'::app_role THEN 2
      WHEN 'supervisor'::app_role THEN 3
      WHEN 'cleaner'::app_role THEN 4
      WHEN 'client'::app_role THEN 5
    END
  LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.user_has_role(check_role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = check_role
  )
$function$;

CREATE OR REPLACE FUNCTION public.user_is_admin_or_manager()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin'::app_role, 'manager'::app_role)
  )
$function$;

-- 3. Strengthen Invitation System - Enhanced accept_invitation with better validation
CREATE OR REPLACE FUNCTION public.accept_invitation(invitation_token text, input_user_id uuid)
 RETURNS app_role
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
    invitation_role app_role;
    invitation_email TEXT;
    user_email TEXT;
    user_name TEXT;
    invitation_record RECORD;
BEGIN
    -- Input validation
    IF invitation_token IS NULL OR trim(invitation_token) = '' THEN
        RAISE EXCEPTION 'Token de invitación es requerido';
    END IF;
    
    IF input_user_id IS NULL THEN
        RAISE EXCEPTION 'ID de usuario es requerido';
    END IF;
    
    -- Get invitation details with additional validation
    SELECT role, email, expires_at, status, invited_by
    INTO invitation_record
    FROM public.user_invitations
    WHERE user_invitations.invitation_token::text = trim(accept_invitation.invitation_token)
    AND status = 'pending'::invitation_status;
    
    -- Validate invitation exists and is pending
    IF invitation_record.role IS NULL THEN
        RAISE EXCEPTION 'Invitación no encontrada o ya procesada';
    END IF;
    
    -- Validate invitation has not expired
    IF invitation_record.expires_at <= now() THEN
        -- Mark as expired
        UPDATE public.user_invitations
        SET status = 'expired'::invitation_status
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
        -- Update invitation as accepted but don't assign new role
        UPDATE public.user_invitations
        SET status = 'accepted'::invitation_status, accepted_at = now()
        WHERE user_invitations.invitation_token::text = trim(accept_invitation.invitation_token);
        
        RAISE EXCEPTION 'El usuario ya tiene un rol asignado en el sistema';
    END IF;
    
    -- Validate the inviter still has permission to assign this role
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles ur 
        WHERE ur.user_id = invitation_record.invited_by 
        AND ur.role IN ('admin'::app_role, 'manager'::app_role)
    ) THEN
        RAISE EXCEPTION 'El usuario que envió la invitación ya no tiene permisos para asignar roles';
    END IF;
    
    -- Mark invitation as accepted
    UPDATE public.user_invitations
    SET status = 'accepted'::invitation_status, accepted_at = now()
    WHERE user_invitations.invitation_token::text = trim(accept_invitation.invitation_token);
    
    -- Assign role to user
    INSERT INTO public.user_roles (user_id, role)
    VALUES (accept_invitation.input_user_id, invitation_record.role);
    
    -- If role is cleaner, create cleaner record
    IF invitation_record.role = 'cleaner'::app_role THEN
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

-- 4. Enhanced verify_invitation function with better validation
CREATE OR REPLACE FUNCTION public.verify_invitation(token text, email text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = ''
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM public.user_invitations
        WHERE invitation_token::text = trim($1)
        AND LOWER(TRIM(email)) = LOWER(TRIM($2))
        AND status = 'pending'::invitation_status
        AND expires_at > now()
    )
$function$;

-- 5. Add audit logging table for security events
CREATE TABLE IF NOT EXISTS public.security_audit_log (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type text NOT NULL,
    user_id uuid REFERENCES auth.users(id),
    event_data jsonb DEFAULT '{}',
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Only admins can view audit logs" 
ON public.security_audit_log 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'::app_role
    )
);

-- System can insert audit logs
CREATE POLICY "System can insert audit logs" 
ON public.security_audit_log 
FOR INSERT 
WITH CHECK (true);

-- 6. Add constraints to prevent data integrity issues
ALTER TABLE public.user_invitations 
ADD CONSTRAINT IF NOT EXISTS check_email_format 
CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- 7. Fix handle_new_user function with proper search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data ->> 'full_name', new.email)
  );
  
  -- Log the signup event (only if audit table exists)
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'security_audit_log') THEN
    INSERT INTO public.security_audit_log (event_type, user_id, event_data)
    VALUES (
      'user_signup',
      new.id,
      jsonb_build_object(
        'email', new.email,
        'signup_method', 'email',
        'confirmed_at', new.confirmed_at
      )
    );
  END IF;
  
  RETURN new;
END;
$function$;

-- 8. Add function to log security events
CREATE OR REPLACE FUNCTION public.log_security_event(
    event_type text,
    event_data jsonb DEFAULT '{}',
    target_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    INSERT INTO public.security_audit_log (
        event_type,
        user_id,
        event_data
    ) VALUES (
        event_type,
        COALESCE(target_user_id, auth.uid()),
        event_data
    );
END;
$function$;