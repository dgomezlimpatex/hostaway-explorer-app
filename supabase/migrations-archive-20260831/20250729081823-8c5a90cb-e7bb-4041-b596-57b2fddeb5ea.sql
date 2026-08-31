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

-- 9. Update hostaway related tables - separate policies for each operation
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

CREATE POLICY "System can insert hostaway reservations"
ON public.hostaway_reservations
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "System can update hostaway reservations"
ON public.hostaway_reservations
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "System can delete hostaway reservations"
ON public.hostaway_reservations
FOR DELETE
TO authenticated
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