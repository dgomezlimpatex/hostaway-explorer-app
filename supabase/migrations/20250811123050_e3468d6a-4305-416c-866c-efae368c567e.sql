-- CRITICAL SECURITY FIXES MIGRATION
-- Fix overly permissive RLS policies and insecure database functions

-- 1. DROP THE DANGEROUS "Allow all operations" POLICY ON cleaner_availability
DROP POLICY IF EXISTS "Allow all operations on cleaner_availability" ON public.cleaner_availability;

-- 2. CREATE SECURE ROLE-BASED POLICIES FOR cleaner_availability
CREATE POLICY "Admins and managers can manage all cleaner availability" 
ON public.cleaner_availability 
FOR ALL 
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

CREATE POLICY "Supervisors can view all cleaner availability" 
ON public.cleaner_availability 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role = 'supervisor'
  )
);

CREATE POLICY "Cleaners can manage their own availability" 
ON public.cleaner_availability 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.cleaners c 
    WHERE c.id = cleaner_availability.cleaner_id 
    AND c.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cleaners c 
    WHERE c.id = cleaner_availability.cleaner_id 
    AND c.user_id = auth.uid()
  )
);

-- 3. FIX INSECURE DATABASE FUNCTIONS - Add proper search_path security
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';

CREATE OR REPLACE FUNCTION public.update_inventory_stock_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';

-- 4. ADD SECURITY AUDIT LOGGING FOR POLICY CHANGES
INSERT INTO public.security_audit_log (
  event_type,
  user_id,
  event_data
) VALUES (
  'security_policy_update',
  auth.uid(),
  jsonb_build_object(
    'action', 'fixed_overly_permissive_rls_policies',
    'table', 'cleaner_availability',
    'description', 'Replaced dangerous "Allow all operations" policy with role-based restrictions',
    'timestamp', now()
  )
);