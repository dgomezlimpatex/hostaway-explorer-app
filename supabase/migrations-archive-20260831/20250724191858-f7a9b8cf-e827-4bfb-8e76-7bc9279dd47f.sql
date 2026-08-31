-- CRITICAL SECURITY FIXES - Phase 1: Role Escalation Prevention

-- Add policy to prevent unauthorized role assignments
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

-- Secure all SECURITY DEFINER functions by adding search_path
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