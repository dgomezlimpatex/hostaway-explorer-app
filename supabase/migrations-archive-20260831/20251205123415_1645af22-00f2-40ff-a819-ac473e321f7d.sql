-- Allow public read access to tasks that are part of active share links
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
    AND tasks.type IN ('limpieza', 'check', 'mantenimiento')
  )
);

-- Allow public read access to properties that are linked to tasks in active share links
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
      AND t.type IN ('limpieza', 'check', 'mantenimiento')
    )
    WHERE t.propiedad_id = properties.id
    AND lsl.is_active = true
    AND (lsl.expires_at IS NULL OR lsl.expires_at > now())
  )
);