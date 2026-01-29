-- Add short_code column to client_portal_access
ALTER TABLE public.client_portal_access 
ADD COLUMN short_code TEXT UNIQUE;

-- Create function to generate random short code (8 alphanumeric chars)
CREATE OR REPLACE FUNCTION public.generate_short_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'abcdefghijklmnopqrstuvwxyz0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Update existing records with short codes
UPDATE public.client_portal_access 
SET short_code = public.generate_short_code()
WHERE short_code IS NULL;

-- Make short_code NOT NULL and add default
ALTER TABLE public.client_portal_access 
ALTER COLUMN short_code SET NOT NULL,
ALTER COLUMN short_code SET DEFAULT public.generate_short_code();

-- Create index for faster lookups by short_code
CREATE INDEX idx_client_portal_access_short_code ON public.client_portal_access(short_code);