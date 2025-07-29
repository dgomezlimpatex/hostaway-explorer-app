-- Security Fix Migration Phase 2: Database Functions and Enhanced Security (Fixed)

-- Fix database functions security by adding SET search_path = ''
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

-- Add periodic cleanup function for expired invitations
CREATE OR REPLACE FUNCTION public.cleanup_expired_invitations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    -- Auto-cleanup expired invitations older than 30 days
    DELETE FROM public.user_invitations
    WHERE status = 'expired'
    AND expires_at < now() - interval '30 days';
    
    -- Mark pending invitations as expired if past expiry date
    UPDATE public.user_invitations
    SET status = 'expired'
    WHERE status = 'pending'
    AND expires_at < now();
END;
$function$;