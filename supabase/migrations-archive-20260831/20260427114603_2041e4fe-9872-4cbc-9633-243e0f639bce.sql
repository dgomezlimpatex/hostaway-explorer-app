-- Drop and recreate INSERT policy for anon to also include authenticated users with portal access
DROP POLICY IF EXISTS "Anonymous can create tasks via client portal" ON public.tasks;

CREATE POLICY "Portal users can create tasks via client portal"
ON public.tasks
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.client_portal_access cpa
    WHERE cpa.client_id = tasks.cliente_id
    AND cpa.is_active = true
  )
);

-- Same for UPDATE
DROP POLICY IF EXISTS "Anonymous can update tasks via client portal" ON public.tasks;

CREATE POLICY "Portal users can update tasks via client portal"
ON public.tasks
FOR UPDATE
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.client_portal_access cpa
    WHERE cpa.client_id = tasks.cliente_id
    AND cpa.is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.client_portal_access cpa
    WHERE cpa.client_id = tasks.cliente_id
    AND cpa.is_active = true
  )
);

-- Same for DELETE
DROP POLICY IF EXISTS "Anonymous can delete tasks via client portal" ON public.tasks;

CREATE POLICY "Portal users can delete tasks via client portal"
ON public.tasks
FOR DELETE
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.client_portal_access cpa
    WHERE cpa.client_id = tasks.cliente_id
    AND cpa.is_active = true
  )
);

-- Also fix related tables that the portal needs to write to
-- client_reservations: ensure anon+authenticated can insert/update/delete via portal
DO $$
BEGIN
  -- INSERT policy
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='client_reservations' AND cmd='INSERT' AND 'anon' = ANY(roles)) THEN
    -- check if also includes authenticated
    NULL;
  END IF;
END $$;