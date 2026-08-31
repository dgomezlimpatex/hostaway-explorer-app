
-- Add new columns to store detailed information about tasks and reservations
ALTER TABLE public.hostaway_sync_logs 
ADD COLUMN tasks_details JSONB DEFAULT '[]'::jsonb,
ADD COLUMN reservations_details JSONB DEFAULT '[]'::jsonb;
