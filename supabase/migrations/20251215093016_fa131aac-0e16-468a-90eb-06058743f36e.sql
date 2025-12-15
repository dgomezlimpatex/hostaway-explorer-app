-- Add linen control fields to clients table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS linen_control_enabled boolean NOT NULL DEFAULT false;

-- Add linen control field to properties table (for individual override)
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS linen_control_enabled boolean DEFAULT NULL;

-- NULL means "inherit from client", true/false means explicit override

COMMENT ON COLUMN public.clients.linen_control_enabled IS 'Whether this client uses the linen control system for all their properties';
COMMENT ON COLUMN public.properties.linen_control_enabled IS 'Override linen control for this specific property. NULL = inherit from client, true/false = explicit override';