-- Security Fix Migration: Implement Proper RLS Policies and Database Security
-- Phase 1: Critical RLS Policy Fixes

-- Fix overly permissive RLS policies with proper role-based access control

-- 1. Update cleaners table RLS policies
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.cleaners;

CREATE POLICY "Admins and managers can manage cleaners"
ON public.cleaners
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
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'manager')
  )
);

CREATE POLICY "Supervisors can view cleaners"
ON public.cleaners
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role = 'supervisor'
  )
);

CREATE POLICY "Cleaners can view and update their own data"
ON public.cleaners
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 2. Update clients table RLS policies
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.clients;

CREATE POLICY "Admin, manager, supervisor can manage clients"
ON public.clients
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'manager', 'supervisor')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'manager', 'supervisor')
  )
);

-- 3. Update properties table RLS policies
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.properties;

CREATE POLICY "Admin, manager, supervisor can manage properties"
ON public.properties
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'manager', 'supervisor')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'manager', 'supervisor')
  )
);

CREATE POLICY "Cleaners can view properties for their assigned tasks"
ON public.properties
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.cleaners c ON c.user_id = ur.user_id
    JOIN public.tasks t ON t.cleaner_id = c.id
    WHERE ur.user_id = auth.uid() 
    AND ur.role = 'cleaner'
    AND t.propiedad_id = properties.id
  )
);

-- 4. Update assignment_patterns table RLS policies
DROP POLICY IF EXISTS "Allow all operations for authenticated users on assignment_patt" ON public.assignment_patterns;

CREATE POLICY "Admin and managers can manage assignment patterns"
ON public.assignment_patterns
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
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'manager')
  )
);

-- 5. Update auto_assignment_logs table RLS policies
DROP POLICY IF EXISTS "Allow all operations for authenticated users on auto_assignment" ON public.auto_assignment_logs;

CREATE POLICY "Admin and managers can view assignment logs"
ON public.auto_assignment_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'manager')
  )
);

CREATE POLICY "System can insert assignment logs"
ON public.auto_assignment_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 6. Update auto_assignment_rules table RLS policies
DROP POLICY IF EXISTS "Allow all operations for authenticated users on auto_assignment" ON public.auto_assignment_rules;

CREATE POLICY "Admin and managers can manage assignment rules"
ON public.auto_assignment_rules
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
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'manager')
  )
);

-- 7. Update recurring_tasks table RLS policies
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.recurring_tasks;

CREATE POLICY "Admin and managers can manage recurring tasks"
ON public.recurring_tasks
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
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'manager')
  )
);

CREATE POLICY "Supervisors can view recurring tasks"
ON public.recurring_tasks
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role = 'supervisor'
  )
);

-- 8. Update property_groups and related tables RLS policies
DROP POLICY IF EXISTS "Allow all operations for authenticated users on property_groups" ON public.property_groups;

CREATE POLICY "Admin and managers can manage property groups"
ON public.property_groups
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
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'manager')
  )
);

DROP POLICY IF EXISTS "Allow all operations for authenticated users on property_group_" ON public.property_group_assignments;

CREATE POLICY "Admin and managers can manage property group assignments"
ON public.property_group_assignments
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
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'manager')
  )
);

DROP POLICY IF EXISTS "Allow all operations for authenticated users on cleaner_group_a" ON public.cleaner_group_assignments;

CREATE POLICY "Admin and managers can manage cleaner group assignments"
ON public.cleaner_group_assignments
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
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'manager')
  )
);

-- 9. Update hostaway related tables
DROP POLICY IF EXISTS "Allow all operations for authenticated users on hostaway_reserv" ON public.hostaway_reservations;

CREATE POLICY "Admin, manager, supervisor can view hostaway reservations"
ON public.hostaway_reservations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'manager', 'supervisor')
  )
);

CREATE POLICY "System can manage hostaway reservations"
ON public.hostaway_reservations
FOR INSERT, UPDATE, DELETE
TO authenticated
WITH CHECK (true)
USING (true);

DROP POLICY IF EXISTS "Allow all operations for authenticated users on hostaway_sync_l" ON public.hostaway_sync_logs;

CREATE POLICY "Admin and managers can view sync logs"
ON public.hostaway_sync_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'manager')
  )
);

CREATE POLICY "System can insert sync logs"
ON public.hostaway_sync_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Phase 2: Database Security Hardening

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

-- Enhanced invitation security
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