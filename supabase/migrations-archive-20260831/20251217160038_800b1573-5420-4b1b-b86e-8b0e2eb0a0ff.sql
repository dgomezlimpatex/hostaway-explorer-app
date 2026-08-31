-- Add is_active column to clients table (defaults to true)
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Add is_active column to properties table (NULL = inherit from client)
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT NULL;

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_clients_is_active ON public.clients(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_properties_is_active ON public.properties(is_active) WHERE is_active = true OR is_active IS NULL;