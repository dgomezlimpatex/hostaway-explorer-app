-- Add missing columns to worker_contracts table
ALTER TABLE public.worker_contracts 
ADD COLUMN IF NOT EXISTS position text,
ADD COLUMN IF NOT EXISTS department text,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS renewal_date date;

-- Update existing records to have default values
UPDATE public.worker_contracts 
SET 
  position = COALESCE(position, 'Limpiador/a'),
  department = COALESCE(department, 'Limpieza'),
  status = COALESCE(status, 'draft')
WHERE position IS NULL OR department IS NULL OR status IS NULL;