import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { Task } from '@/types/calendar';
import { useClientAllowIncidents } from '@/hooks/useCleaningIncidents';
import { ReportIncidentDialog } from './ReportIncidentDialog';
import { cn } from '@/lib/utils';

interface Props {
  task: Task;
  hasStartedTask: boolean;
  isTaskCompleted?: boolean;
  className?: string;
  variant?: 'compact' | 'full';
}

export const IncidentReportTrigger: React.FC<Props> = ({
  task,
  hasStartedTask,
  isTaskCompleted,
  className,
  variant = 'full',
}) => {
  const [open, setOpen] = useState(false);
  const { data: allowed } = useClientAllowIncidents(task.clienteId);
  const realTaskId = task.id?.includes('_assignment_')
    ? task.id.split('_assignment_')[0]
    : task.id;

  if (!allowed) return null;
  if (!hasStartedTask || isTaskCompleted) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className={cn(
          'border-orange-300 text-orange-700 hover:bg-orange-50 hover:text-orange-800',
          variant === 'full' ? 'w-full h-11' : 'h-9',
          className
        )}
      >
        <AlertTriangle className="h-4 w-4 mr-2" />
        Reportar incidencia
      </Button>
      <ReportIncidentDialog
        open={open}
        onOpenChange={setOpen}
        taskId={task.id}
        propertyName={task.property}
      />
    </>
  );
};
