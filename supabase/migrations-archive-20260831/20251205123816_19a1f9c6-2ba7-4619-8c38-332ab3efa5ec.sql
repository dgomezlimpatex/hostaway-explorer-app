-- Drop old policies with type filter
DROP POLICY IF EXISTS "Public can read tasks via active share links" ON public.tasks;
DROP POLICY IF EXISTS "Public can read properties via active share links" ON public.properties;

-- Recreate policies without type filter (to include all task types)
CREATE POLICY "Public can read tasks via active share links"
ON public.tasks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.laundry_share_links lsl
    WHERE lsl.is_active = true
    AND (lsl.expires_at IS NULL OR lsl.expires_at > now())
    AND tasks.date >= lsl.date_start
    AND tasks.date <= lsl.date_end
  )
);

CREATE POLICY "Public can read properties via active share links"
ON public.properties
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM public.tasks t
    JOIN public.laundry_share_links lsl ON (
      t.date >= lsl.date_start 
      AND t.date <= lsl.date_end
    )
    WHERE t.propiedad_id = properties.id
    AND lsl.is_active = true
    AND (lsl.expires_at IS NULL OR lsl.expires_at > now())
  )
);