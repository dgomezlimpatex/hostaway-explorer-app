-- Security Enhancement Phase 3: Rate Limiting and Enhanced Authentication Security

-- Create table for tracking login attempts and rate limiting
CREATE TABLE IF NOT EXISTS public.security_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT NOT NULL, -- IP address or email
    action_type TEXT NOT NULL, -- 'login_attempt', 'invitation_request', etc.
    attempt_count INTEGER NOT NULL DEFAULT 1,
    first_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    last_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    blocked_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient rate limiting queries
CREATE INDEX IF NOT EXISTS idx_security_rate_limits_identifier_action 
ON public.security_rate_limits(identifier, action_type);

CREATE INDEX IF NOT EXISTS idx_security_rate_limits_blocked_until 
ON public.security_rate_limits(blocked_until);

-- Enable RLS on rate limits table
ALTER TABLE public.security_rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS policy for rate limits (only system can manage)
CREATE POLICY "System can manage rate limits"
ON public.security_rate_limits
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- Create function to check and enforce rate limits
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    check_identifier TEXT,
    check_action_type TEXT,
    max_attempts INTEGER DEFAULT 5,
    window_minutes INTEGER DEFAULT 15,
    block_minutes INTEGER DEFAULT 15
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    current_record RECORD;
    window_start TIMESTAMP WITH TIME ZONE;
    block_until TIMESTAMP WITH TIME ZONE;
BEGIN
    window_start := now() - (window_minutes || ' minutes')::INTERVAL;
    
    -- Get or create rate limit record
    SELECT * INTO current_record
    FROM public.security_rate_limits
    WHERE identifier = check_identifier
    AND action_type = check_action_type;
    
    -- Check if currently blocked
    IF current_record.blocked_until IS NOT NULL AND current_record.blocked_until > now() THEN
        RETURN FALSE;
    END IF;
    
    -- Reset if outside window
    IF current_record.first_attempt_at IS NULL OR current_record.first_attempt_at < window_start THEN
        UPDATE public.security_rate_limits
        SET 
            attempt_count = 1,
            first_attempt_at = now(),
            last_attempt_at = now(),
            blocked_until = NULL,
            updated_at = now()
        WHERE identifier = check_identifier
        AND action_type = check_action_type;
        RETURN TRUE;
    END IF;
    
    -- Check if exceeded limits
    IF current_record.attempt_count >= max_attempts THEN
        block_until := now() + (block_minutes || ' minutes')::INTERVAL;
        
        UPDATE public.security_rate_limits
        SET 
            blocked_until = block_until,
            updated_at = now()
        WHERE identifier = check_identifier
        AND action_type = check_action_type;
        
        -- Log security event
        PERFORM public.log_security_event('rate_limit_exceeded', jsonb_build_object(
            'identifier', check_identifier,
            'action_type', check_action_type,
            'attempt_count', current_record.attempt_count,
            'blocked_until', block_until
        ));
        
        RETURN FALSE;
    END IF;
    
    -- Increment attempt count
    UPDATE public.security_rate_limits
    SET 
        attempt_count = attempt_count + 1,
        last_attempt_at = now(),
        updated_at = now()
    WHERE identifier = check_identifier
    AND action_type = check_action_type;
    
    -- If record doesn't exist, create it
    IF NOT FOUND THEN
        INSERT INTO public.security_rate_limits (
            identifier,
            action_type,
            attempt_count,
            first_attempt_at,
            last_attempt_at
        ) VALUES (
            check_identifier,
            check_action_type,
            1,
            now(),
            now()
        );
    END IF;
    
    RETURN TRUE;
END;
$function$;

-- Create function to reset rate limits on successful actions
CREATE OR REPLACE FUNCTION public.reset_rate_limit(
    reset_identifier TEXT,
    reset_action_type TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    UPDATE public.security_rate_limits
    SET 
        attempt_count = 0,
        blocked_until = NULL,
        updated_at = now()
    WHERE identifier = reset_identifier
    AND action_type = reset_action_type;
END;
$function$;

-- Enhanced user invitation rate limiting
CREATE OR REPLACE FUNCTION public.create_user_invitation_secure(
    invite_email TEXT,
    invite_role app_role,
    expires_hours INTEGER DEFAULT 48
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    current_user_role app_role;
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
    SELECT role INTO current_user_role
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
        invite_role,
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
$function$;

-- Enhanced trigger for updated_at columns
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

-- Add updated_at trigger to security_rate_limits
CREATE TRIGGER update_security_rate_limits_updated_at
    BEFORE UPDATE ON public.security_rate_limits
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Add periodic cleanup for old rate limit records
INSERT INTO cron.job (jobname, schedule, command)
VALUES (
    'cleanup-old-rate-limits',
    '0 2 * * *', -- Daily at 2 AM
    $$
    DELETE FROM public.security_rate_limits 
    WHERE updated_at < now() - interval '7 days'
    AND (blocked_until IS NULL OR blocked_until < now());
    $$
) ON CONFLICT (jobname) DO UPDATE SET
    schedule = EXCLUDED.schedule,
    command = EXCLUDED.command;