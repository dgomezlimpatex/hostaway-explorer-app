-- CRITICAL SECURITY FIXES - Phase 1

-- 1. Fix Role Escalation - Add policy to prevent unauthorized role assignments
CREATE POLICY "Prevent role escalation during insertion" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (
  -- Only admins can assign admin roles
  (role = 'admin' AND EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )) OR
  -- Only admins and managers can assign manager roles
  (role = 'manager' AND EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'manager')
  )) OR
  -- Only admins and managers can assign supervisor roles
  (role = 'supervisor' AND EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'manager')
  )) OR
  -- Only admins and managers can assign cleaner roles (through invitation system)
  (role = 'cleaner' AND EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'manager')
  ))
);

-- 2. Secure handle_new_user function
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
  
  RETURN new;
END;
$function$;

-- 3. Enhanced accept_invitation function with better validation
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
BEGIN
    -- Input validation
    IF invitation_token IS NULL OR trim(invitation_token) = '' THEN
        RAISE EXCEPTION 'Token de invitación es requerido';
    END IF;
    
    IF input_user_id IS NULL THEN
        RAISE EXCEPTION 'ID de usuario es requerido';
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
    
    RETURN invitation_record.role;
END;
$function$;

-- 4. Enhanced verify_invitation function
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
        AND status = 'pending'
        AND expires_at > now()
    )
$function$;