-- Allow anonymous portal users to UPDATE tasks linked to their client
CREATE POLICY "Anonymous can update tasks via client portal"
ON public.tasks
FOR UPDATE
TO anon
USING (
  EXISTS (
    SELECT 1
    FROM client_portal_access cpa
    WHERE cpa.client_id = tasks.cliente_id
      AND cpa.is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM client_portal_access cpa
    WHERE cpa.client_id = tasks.cliente_id
      AND cpa.is_active = true
  )
);

-- Allow anonymous portal users to DELETE tasks linked to their client
CREATE POLICY "Anonymous can delete tasks via client portal"
ON public.tasks
FOR DELETE
TO anon
USING (
  EXISTS (
    SELECT 1
    FROM client_portal_access cpa
    WHERE cpa.client_id = tasks.cliente_id
      AND cpa.is_active = true
  )
);