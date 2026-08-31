-- Add new columns to hostaway_sync_logs table for tracking cancelled and modified tasks
ALTER TABLE public.hostaway_sync_logs 
ADD COLUMN IF NOT EXISTS tasks_cancelled INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tasks_modified INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tasks_cancelled_details JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS tasks_modified_details JSONB DEFAULT '[]'::jsonb;