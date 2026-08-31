-- Add notes column to tasks table
ALTER TABLE public.tasks 
ADD COLUMN notes TEXT;