CREATE POLICY "Anonymous can create tasks via client portal"
ON public.tasks
FOR INSERT
TO anon
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM client_portal_access cpa
    WHERE cpa.client_id = tasks.cliente_id
      AND cpa.is_active = true
  )
);