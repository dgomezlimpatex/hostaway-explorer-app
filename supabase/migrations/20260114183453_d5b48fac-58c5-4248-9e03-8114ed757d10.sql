-- Add additional_tasks JSONB column to tasks table for subtasks
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS additional_tasks JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.tasks.additional_tasks IS 'Array of additional subtasks added by admin/manager. Structure: [{id, text, photoRequired, completed, completedAt, completedBy, addedBy, addedAt, notes, mediaUrls}]';

-- Create index for efficient querying of tasks with pending subtasks
CREATE INDEX IF NOT EXISTS idx_tasks_additional_tasks ON public.tasks USING GIN (additional_tasks);
