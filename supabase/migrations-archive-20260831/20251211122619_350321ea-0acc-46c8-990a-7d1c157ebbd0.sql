-- Add sede_id column to laundry_share_links
ALTER TABLE public.laundry_share_links 
ADD COLUMN sede_id uuid REFERENCES public.sedes(id);

-- Update existing links to have a sede_id based on their tasks
-- This will set the sede_id from the first task in the snapshot
UPDATE public.laundry_share_links lsl
SET sede_id = (
  SELECT t.sede_id 
  FROM public.tasks t 
  WHERE t.id = ANY(lsl.snapshot_task_ids)
  LIMIT 1
)
WHERE lsl.sede_id IS NULL;

-- Create index for better query performance
CREATE INDEX idx_laundry_share_links_sede_id ON public.laundry_share_links(sede_id);