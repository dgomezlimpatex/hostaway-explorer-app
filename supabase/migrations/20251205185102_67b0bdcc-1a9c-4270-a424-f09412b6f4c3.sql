-- Add column to track all tasks that existed at link creation time
-- This allows us to differentiate between manually excluded tasks vs truly new tasks
ALTER TABLE public.laundry_share_links 
ADD COLUMN IF NOT EXISTS original_task_ids text[] DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN public.laundry_share_links.original_task_ids IS 'All task IDs that existed when the link was created, used to detect truly new tasks (not just excluded ones)';