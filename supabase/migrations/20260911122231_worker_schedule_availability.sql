-- Both kinds reserve a weekly time window. Only maintenance counts as work.
-- Existing rows keep their previous meaning and existing RLS/grants apply.
ALTER TABLE public.worker_maintenance_cleanings
  ADD COLUMN schedule_type text NOT NULL DEFAULT 'maintenance'
  CONSTRAINT worker_schedule_type_check CHECK (schedule_type IN ('maintenance', 'unavailability'));

COMMENT ON COLUMN public.worker_maintenance_cleanings.schedule_type IS
  'maintenance: actual cleaning work; unavailability: personal availability restriction, never counted as worked hours';
