import React from "react";
import { AlertTriangle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Task } from "@/types/calendar";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { civilDateToLocalDate } from "./utils/multiDayCalendar";

interface OverlapAlertProps {
  overlappingTasks: Task[];
  cleanerName: string;
  showDate?: boolean;
  onTaskSelect?: (taskId: string) => void;
}

export const OverlapAlert: React.FC<OverlapAlertProps> = ({
  overlappingTasks,
  cleanerName,
  showDate = false,
  onTaskSelect,
}) => {
  if (overlappingTasks.length === 0) return null;

  return (
    <div className="border border-line bg-paper dark:bg-red-950/20 dark:border-red-900/50 rounded-md px-2 py-1 text-xs">
      <div className="flex items-center gap-2 flex-wrap">
        <AlertTriangle className="h-3 w-3 text-danger flex-shrink-0" />
        <span className="font-medium text-danger dark:text-red-200 truncate">
          {cleanerName}
        </span>
        <div className="flex items-center gap-1 flex-wrap">
          {overlappingTasks.map((task) => {
            const label = (
              <>
                <Clock className="h-2.5 w-2.5" />
                {showDate && task.date && `${format(civilDateToLocalDate(task.date), "EEE d", { locale: es })} · `}
                {task.property} {task.startTime}-{task.endTime}
              </>
            );
            return onTaskSelect ? (
              <button
                key={task.id}
                type="button"
                onClick={() => onTaskSelect(task.id)}
                className="rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Abrir ${task.property} ${task.startTime}-${task.endTime}`}
              >
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 font-normal gap-1 cursor-pointer hover:opacity-80">
                  {label}
                </Badge>
              </button>
            ) : (
              <Badge key={task.id} variant="destructive" className="text-[10px] px-1.5 py-0 h-4 font-normal gap-1">
                {label}
              </Badge>
            );
          })}
        </div>
      </div>
    </div>
  );
};
