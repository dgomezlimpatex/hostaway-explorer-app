
-- Add sort_order column to cleaners table
ALTER TABLE public.cleaners ADD COLUMN sort_order INTEGER;

-- Create RPC function to update cleaners order
CREATE OR REPLACE FUNCTION public.update_cleaners_order(cleaner_updates JSONB[])
RETURNS VOID AS $$
DECLARE
    update_item JSONB;
BEGIN
    FOREACH update_item IN ARRAY cleaner_updates
    LOOP
        UPDATE public.cleaners 
        SET sort_order = (update_item->>'sortOrder')::INTEGER
        WHERE id = (update_item->>'id')::UUID;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
