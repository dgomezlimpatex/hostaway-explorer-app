-- Allow anonymous portal users to read tasks linked to their client reservations
CREATE POLICY "Anonymous can view tasks via client portal"
ON public.tasks
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1
    FROM client_portal_access cpa
    WHERE cpa.client_id = tasks.cliente_id
      AND cpa.is_active = true
  )
);