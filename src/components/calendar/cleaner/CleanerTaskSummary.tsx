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
  return <div className="p-6 space-y-3 bg-gradient-to-br from-muted/20 to-muted/40 border-b border-border/50">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">Tareas hoy:</span>
        <span className="text-xl font-bold text-foreground bg-primary/10 px-3 py-1 rounded-full">
          {todayTasks.length}
        </span>
      </div>
      
    </div>;
};