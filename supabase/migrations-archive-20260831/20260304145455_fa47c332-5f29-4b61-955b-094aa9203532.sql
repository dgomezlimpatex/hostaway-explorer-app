
-- Create property_preferred_cleaners table
CREATE TABLE public.property_preferred_cleaners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  cleaner_id UUID NOT NULL REFERENCES public.cleaners(id) ON DELETE CASCADE,
  priority INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (property_id, cleaner_id)
);

-- Enable RLS
ALTER TABLE public.property_preferred_cleaners ENABLE ROW LEVEL SECURITY;

-- Admin/manager can do everything
CREATE POLICY "Admin and manager full access on property_preferred_cleaners"
  ON public.property_preferred_cleaners
  FOR ALL
  TO authenticated
  USING (public.user_is_admin_or_manager())
  WITH CHECK (public.user_is_admin_or_manager());

-- Supervisors can read
CREATE POLICY "Supervisors can read property_preferred_cleaners"
  ON public.property_preferred_cleaners
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor'));

-- Create index for fast lookups
CREATE INDEX idx_property_preferred_cleaners_property_id ON public.property_preferred_cleaners(property_id);
