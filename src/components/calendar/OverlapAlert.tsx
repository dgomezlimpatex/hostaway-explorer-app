import React from "react";
import { AlertTriangle, Clock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

interface OverlapAlertProps {
  overlappingTasks: any[];
  cleanerName: string;
}

export const OverlapAlert: React.FC<OverlapAlertProps> = ({ 
  overlappingTasks, 
  cleanerName 
}) => {
  if (overlappingTasks.length === 0) return null;

  return (
    <Alert className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
      <AlertTriangle className="h-4 w-4 text-red-600" />
      <AlertDescription className="text-sm">
        <div className="space-y-2">
          <p className="font-medium text-red-800 dark:text-red-200">
            ⚠️ Conflicto de horario detectado para {cleanerName}
          </p>
          <div className="space-y-1">
            {overlappingTasks.map((task, index) => (
              <div key={task.id} className="flex items-center gap-2">
                <Clock className="h-3 w-3 text-red-500" />
                <span className="text-red-700 dark:text-red-300">
                  {task.property}
                </span>
                <Badge variant="destructive" className="text-xs">
                  {task.startTime} - {task.endTime}
                </Badge>
              </div>
            ))}
          </div>
          <p className="text-xs text-red-600 dark:text-red-400">
            Las tareas se mostrarán apiladas. Considera ajustar los horarios.
          </p>
        </div>
      </AlertDescription>
    </Alert>
  );
};