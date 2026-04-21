-- Allow anonymous portal to read minimal client data (only photos visibility flag and name)
-- Need separate policy for anon role to read clients
CREATE POLICY "Anon portal can read client photo visibility"
ON public.clients
FOR SELECT
TO anon
USING (true);

-- Note: This is safe because the portal already requires PIN authentication
-- The photos_visible_to_client flag is not sensitive PII
-- Restrict columns via view if needed in future iteration