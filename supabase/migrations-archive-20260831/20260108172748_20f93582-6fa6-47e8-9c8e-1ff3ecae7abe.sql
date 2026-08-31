
-- ================================================
-- LAUNDRY DELIVERY SCHEDULE CONFIGURATION
-- ================================================

-- Table for configurable delivery days (admin can modify)
CREATE TABLE public.laundry_delivery_schedule (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sede_id UUID REFERENCES public.sedes(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 1=Monday...6=Saturday
  name TEXT NOT NULL, -- Human readable name like "Lunes", "Domingo"
  collection_days INTEGER[] NOT NULL, -- Days of week to collect (services from these days)
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(sede_id, day_of_week)
);

-- Enable RLS
ALTER TABLE public.laundry_delivery_schedule ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view delivery schedule for their sede"
  ON public.laundry_delivery_schedule
  FOR SELECT
  USING (
    sede_id IS NULL OR 
    public.user_has_sede_access(auth.uid(), sede_id) OR 
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
  );

CREATE POLICY "Admins and managers can manage delivery schedule"
  ON public.laundry_delivery_schedule
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
  );

-- Trigger for updated_at
CREATE TRIGGER update_laundry_delivery_schedule_updated_at
  BEFORE UPDATE ON public.laundry_delivery_schedule
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default schedule (L-X-V-D pattern)
-- Note: Default is sede_id = NULL (applies to all sedes unless overridden)
INSERT INTO public.laundry_delivery_schedule (sede_id, day_of_week, name, collection_days, sort_order) VALUES
  (NULL, 1, 'Lunes', ARRAY[0], 1),         -- Monday: collect Sunday services
  (NULL, 3, 'Miércoles', ARRAY[1, 2], 2),  -- Wednesday: collect Monday + Tuesday services
  (NULL, 5, 'Viernes', ARRAY[3, 4], 3),    -- Friday: collect Wednesday + Thursday services
  (NULL, 0, 'Domingo', ARRAY[5, 6], 4);    -- Sunday: collect Friday + Saturday services

-- ================================================
-- ADD FIELDS TO laundry_share_links
-- ================================================

ALTER TABLE public.laundry_share_links 
  ADD COLUMN IF NOT EXISTS delivery_day INTEGER, -- Day of week this link is for
  ADD COLUMN IF NOT EXISTS collection_dates DATE[], -- Specific dates of services being collected
  ADD COLUMN IF NOT EXISTS link_type TEXT NOT NULL DEFAULT 'legacy'; -- 'legacy' | 'scheduled'

-- ================================================
-- ADD COLLECTION TRACKING TO laundry_delivery_tracking
-- ================================================

ALTER TABLE public.laundry_delivery_tracking
  ADD COLUMN IF NOT EXISTS collection_status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'collected'
  ADD COLUMN IF NOT EXISTS collected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS collected_by_name TEXT;

-- Add check constraint for collection_status
ALTER TABLE public.laundry_delivery_tracking
  ADD CONSTRAINT valid_collection_status CHECK (collection_status IN ('pending', 'collected'));

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_laundry_share_links_delivery_day ON public.laundry_share_links(delivery_day);
CREATE INDEX IF NOT EXISTS idx_laundry_share_links_link_type ON public.laundry_share_links(link_type);
CREATE INDEX IF NOT EXISTS idx_laundry_delivery_schedule_sede_id ON public.laundry_delivery_schedule(sede_id);
