import React from 'react';
import { DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { FileText } from 'lucide-react';
import { Task } from '@/types/calendar';
import { cn } from '@/lib/utils';

interface TaskReportHeaderProps {
  task: Task;
  reportStatus: string;
  completionPercentage: number;
  isLoadingReport: boolean;
  isCollapsed?: boolean;
}

export const TaskReportHeader: React.FC<TaskReportHeaderProps> = ({
  task,
  reportStatus,
  completionPercentage,
  isLoadingReport,
  isCollapsed = false
}) => {
  return (
    <div className={cn(
      "transition-all duration-300 ease-out overflow-hidden",
      isCollapsed ? "max-h-0 opacity-0 py-0" : "max-h-40 opacity-100"
    )}>
      <DialogTitle className="flex items-center gap-1.5 text-sm">
        <FileText className="h-4 w-4 flex-shrink-0" />
        <span className="truncate">{task.property}</span>
      </DialogTitle>
      <DialogDescription className="text-xs mt-0.5 line-clamp-1">
        {task.address} • {task.date} • {task.startTime}
      </DialogDescription>

      {/* Compact Progress Header */}
      <div className="flex items-center gap-2 mt-2">
        <Badge 
          variant={reportStatus === 'completed' ? 'default' : 'secondary'}
          className="text-[10px] px-1.5 py-0 h-5"
        >
          {reportStatus === 'completed' ? 'Completado' : 
           reportStatus === 'in_progress' ? 'En Progreso' : 'Pendiente'}
        </Badge>
        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
          {completionPercentage}%
        </span>
        <Progress value={completionPercentage} className="flex-1 h-1.5" />
        {isLoadingReport && (
          <span className="text-[10px] text-muted-foreground animate-pulse">...</span>
        )}
      </div>
    </div>
  );
};
