-- Permitir que el rol logistics pueda ver propiedades
DROP POLICY IF EXISTS "Logistics can view properties" ON public.properties;
CREATE POLICY "Logistics can view properties"
ON public.properties
FOR SELECT
USING (has_role(auth.uid(), 'logistics'));