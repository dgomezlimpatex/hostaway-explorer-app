-- Create table for manual hour adjustments
CREATE TABLE public.worker_hour_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id UUID NOT NULL REFERENCES public.cleaners(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  hours NUMERIC(5,2) NOT NULL,  -- Positive to add, negative to subtract
  category TEXT NOT NULL DEFAULT 'other',  -- extra, training, absence, correction, other
  reason TEXT NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes for common queries
CREATE INDEX idx_worker_hour_adjustments_cleaner_id ON public.worker_hour_adjustments(cleaner_id);
CREATE INDEX idx_worker_hour_adjustments_date ON public.worker_hour_adjustments(date);
CREATE INDEX idx_worker_hour_adjustments_cleaner_date ON public.worker_hour_adjustments(cleaner_id, date);

-- Enable RLS
ALTER TABLE public.worker_hour_adjustments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins and managers can view all adjustments"
ON public.worker_hour_adjustments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager')
  )
);

CREATE POLICY "Admins and managers can create adjustments"
ON public.worker_hour_adjustments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager')
  )
);

CREATE POLICY "Admins and managers can update adjustments"
ON public.worker_hour_adjustments
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager')
  )
);

CREATE POLICY "Admins and managers can delete adjustments"
ON public.worker_hour_adjustments
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager')
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_worker_hour_adjustments_updated_at
  BEFORE UPDATE ON public.worker_hour_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();