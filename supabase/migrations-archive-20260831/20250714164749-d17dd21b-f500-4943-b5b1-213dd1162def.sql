-- Create task_assignments table for multiple cleaner assignments
CREATE TABLE public.task_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL,
  cleaner_id UUID NOT NULL,
  cleaner_name TEXT NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  assigned_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(task_id, cleaner_id)
);

-- Enable RLS
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view task assignments based on role" 
ON public.task_assignments 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'supervisor'::app_role) OR 
  (has_role(auth.uid(), 'cleaner'::app_role) AND cleaner_id IN (
    SELECT cleaners.id FROM cleaners WHERE cleaners.user_id = auth.uid()
  ))
);

CREATE POLICY "Only admin/manager/supervisor can manage task assignments" 
ON public.task_assignments 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'supervisor'::app_role)
);

-- Add foreign key constraints
ALTER TABLE public.task_assignments 
ADD CONSTRAINT task_assignments_task_id_fkey 
FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;

ALTER TABLE public.task_assignments 
ADD CONSTRAINT task_assignments_cleaner_id_fkey 
FOREIGN KEY (cleaner_id) REFERENCES public.cleaners(id) ON DELETE CASCADE;

-- Create function to update timestamps
CREATE TRIGGER update_task_assignments_updated_at
BEFORE UPDATE ON public.task_assignments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();