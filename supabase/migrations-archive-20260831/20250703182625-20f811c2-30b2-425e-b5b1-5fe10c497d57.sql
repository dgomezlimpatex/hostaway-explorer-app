-- Add kit_alimentario field to properties table
ALTER TABLE public.properties 
ADD COLUMN kit_alimentario integer NOT NULL DEFAULT 0;