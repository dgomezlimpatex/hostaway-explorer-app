ALTER TABLE public.recurring_task_executions 
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();