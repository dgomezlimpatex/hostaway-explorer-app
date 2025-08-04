-- Add billing fields for extraordinary services to tasks table
ALTER TABLE public.tasks 
ADD COLUMN extraordinary_client_name TEXT,
ADD COLUMN extraordinary_client_email TEXT,
ADD COLUMN extraordinary_client_phone TEXT,
ADD COLUMN extraordinary_billing_address TEXT;

-- Add comment to clarify usage
COMMENT ON COLUMN public.tasks.extraordinary_client_name IS 'Client name for extraordinary services (not linked to clients table)';
COMMENT ON COLUMN public.tasks.extraordinary_client_email IS 'Client email for extraordinary services';
COMMENT ON COLUMN public.tasks.extraordinary_client_phone IS 'Client phone for extraordinary services';
COMMENT ON COLUMN public.tasks.extraordinary_billing_address IS 'Billing address for extraordinary services';