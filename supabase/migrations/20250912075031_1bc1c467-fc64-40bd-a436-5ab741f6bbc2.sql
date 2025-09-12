-- Enable pg_cron extension for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create cron job to process recurring tasks daily at 6:00 AM
SELECT cron.schedule(
  'process-recurring-tasks-daily',
  '0 6 * * *', -- Every day at 6:00 AM
  $$
  SELECT
    net.http_post(
        url:='https://qyipyygojlfhdghnraus.supabase.co/functions/v1/process-recurring-tasks',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5aXB5eWdvamxmaGRnaG5yYXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1NTUyNTYsImV4cCI6MjA2NTEzMTI1Nn0.8L48rM_j_95tM37KRB6pBo4PgsLcHWoMMMO-OkPGw2Q"}'::jsonb,
        body:='{"source": "cron"}'::jsonb
    ) as request_id;
  $$
);

-- Create a table to track recurring task execution history
CREATE TABLE IF NOT EXISTS public.recurring_task_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recurring_task_id UUID NOT NULL,
  generated_task_id UUID,
  execution_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add foreign key constraints
ALTER TABLE public.recurring_task_executions 
ADD CONSTRAINT fk_recurring_task_executions_recurring_task 
FOREIGN KEY (recurring_task_id) REFERENCES public.recurring_tasks(id) ON DELETE CASCADE;

ALTER TABLE public.recurring_task_executions 
ADD CONSTRAINT fk_recurring_task_executions_generated_task 
FOREIGN KEY (generated_task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.recurring_task_executions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view executions for their accessible sedes" 
ON public.recurring_task_executions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.recurring_tasks rt 
    WHERE rt.id = recurring_task_id 
    AND rt.sede_id = ANY(public.get_user_accessible_sedes())
  )
);

-- Create indexes for better performance
CREATE INDEX idx_recurring_task_executions_recurring_task_id 
ON public.recurring_task_executions(recurring_task_id);

CREATE INDEX idx_recurring_task_executions_execution_date 
ON public.recurring_task_executions(execution_date);

-- Add trigger for updated_at
CREATE TRIGGER update_recurring_task_executions_updated_at
BEFORE UPDATE ON public.recurring_task_executions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();