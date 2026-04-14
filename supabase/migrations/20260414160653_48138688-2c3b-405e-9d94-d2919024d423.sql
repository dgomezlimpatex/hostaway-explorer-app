CREATE POLICY "Anonymous can view properties via client portal"
ON public.properties
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1
    FROM client_portal_access cpa
    WHERE cpa.client_id = properties.cliente_id
      AND cpa.is_active = true
  )
);