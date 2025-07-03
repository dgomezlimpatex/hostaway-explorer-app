import React from 'react';
import { Task } from '@/types/calendar';

interface CleanerTaskSummaryProps {
  todayTasks: Task[];
  tomorrowTasks: Task[];
}

export const CleanerTaskSummary: React.FC<CleanerTaskSummaryProps> = ({
  todayTasks,
  tomorrowTasks
}) => {
  return (
    <div className="p-4 space-y-2 bg-muted/30">
      <div className="text-sm text-muted-foreground">
        Tareas hoy: <span className="font-medium text-foreground">{todayTasks.length}</span>
      </div>
      <div className="text-sm text-muted-foreground">
        Tareas mañana: <span className="font-medium text-foreground">{tomorrowTasks.length}</span>
      </div>
    </div>
  );
};