import React from "react";
import { AlertTriangle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface OverlapAlertProps {
  overlappingTasks: any[];
  cleanerName: string;
}

export const OverlapAlert: React.FC<OverlapAlertProps> = ({
  overlappingTasks,
  cleanerName,
}) => {
  if (overlappingTasks.length === 0) return null;

  return (
    <div className="border border-red-200 bg-red-50/60 dark:bg-red-950/20 dark:border-red-900/50 rounded-md px-2 py-1 text-xs">
      <div className="flex items-center gap-2 flex-wrap">
        <AlertTriangle className="h-3 w-3 text-red-600 flex-shrink-0" />
        <span className="font-medium text-red-800 dark:text-red-200 truncate">
          {cleanerName}
        </span>
        <div className="flex items-center gap-1 flex-wrap">
          {overlappingTasks.map((task) => (
            <Badge
              key={task.id}
              variant="destructive"
              className="text-[10px] px-1.5 py-0 h-4 font-normal gap-1"
            >
              <Clock className="h-2.5 w-2.5" />
              {task.property} {task.startTime}-{task.endTime}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
};
