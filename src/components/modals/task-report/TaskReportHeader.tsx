
import React from 'react';
import { DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { FileText } from 'lucide-react';
import { Task } from '@/types/calendar';

interface TaskReportHeaderProps {
  task: Task;
  reportStatus: string;
  completionPercentage: number;
  isLoadingReport: boolean;
}

export const TaskReportHeader: React.FC<TaskReportHeaderProps> = ({
  task,
  reportStatus,
  completionPercentage,
  isLoadingReport
}) => {
  return (
    <>
      <DialogTitle className="flex items-center space-x-2">
        <FileText className="h-5 w-5" />
        <span>Reporte de Limpieza - {task.property}</span>
      </DialogTitle>
      <DialogDescription>
        {task.address} • {task.date} • {task.startTime} - {task.endTime}
      </DialogDescription>

      {/* Progress Header */}
      <div className="border-b pb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Badge variant={reportStatus === 'completed' ? 'default' : 'secondary'}>
              {reportStatus === 'completed' ? 'Completado' : 
               reportStatus === 'in_progress' ? 'En Progreso' : 'Pendiente'}
            </Badge>
            <span className="text-sm text-gray-600">
              {completionPercentage}% completado
            </span>
          </div>
          <div className="flex items-center space-x-2">
            {isLoadingReport && (
              <span className="text-sm text-gray-500">Cargando...</span>
            )}
          </div>
        </div>
        <Progress value={completionPercentage} className="w-full" />
      </div>
    </>
  );
};
