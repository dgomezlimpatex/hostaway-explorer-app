import React from "react";
import { Task } from "@/types/calendar";
import { Clock, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useClientData } from "@/hooks/useClientData";
import { getClientColor } from "@/utils/clientColors";

// Subtask badge component
const SubtaskBadge = ({ task }: { task: Task }) => {
  const additionalTasks = task.additionalTasks || [];
  if (additionalTasks.length === 0) return null;

  const pendingCount = additionalTasks.filter(t => !t.completed).length;
  const allCompleted = pendingCount === 0;

  return (
    <div
      className={cn(
        "absolute top-1 right-1 z-20 flex items-center gap-0.5 px-1 py-0.5 rounded-full text-[9px] font-bold shadow-sm",
        allCompleted
          ? "bg-emerald-500 text-white"
          : "bg-rose-500 text-white animate-pulse"
      )}
    >
      <ListTodo className="h-2.5 w-2.5" />
      <span>{pendingCount > 0 ? pendingCount : additionalTasks.length}</span>
    </div>
  );
};

interface EnhancedTaskCardProps {
  task: Task;
  onClick?: () => void;
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent, task: Task) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  style?: React.CSSProperties;
}

export const EnhancedTaskCard = React.memo(({
  task,
  onClick,
  isDragging,
  onDragStart,
  onDragEnd,
  style
}: EnhancedTaskCardProps) => {
  const { getClientName } = useClientData();
  const clientColor = getClientColor(task.clienteId);

  // Estados especiales que sobrescriben el color del cliente para ser legibles
  const isCompleted = task.status === 'completed';
  const isInProgress = task.status === 'in-progress';
  const isCancelled = task.status === 'cancelled';

  const formatTime = (time: string) => {
    if (time.includes(':')) {
      const parts = time.split(':');
      return `${parts[0]}:${parts[1]}`;
    }
    return time;
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (onDragStart) {
      onDragStart(e, task);
    }
  };

  const clientName = getClientName(task.clienteId || '');
  const displayPropertyName = () => task.property;

  // Estilo dinámico: color del cliente como fondo + borde lateral
  const cardStyle: React.CSSProperties = {
    ...style,
    backgroundColor: isCancelled ? undefined : clientColor.bg,
    borderLeftColor: clientColor.border,
    color: clientColor.text,
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            draggable
            onClick={onClick}
            onDragStart={handleDragStart}
            onDragEnd={onDragEnd}
            style={cardStyle}
            className={cn(
              "relative px-2 py-1.5 rounded-lg border-l-[5px] cursor-pointer transition-all duration-200",
              "hover:shadow-md hover:-translate-y-0.5",
              "focus:outline-none focus:ring-2 focus:ring-primary/40",
              "transform-gpu overflow-hidden",
              // Estados sobre el color del cliente
              isCompleted && "ring-2 ring-emerald-400/60 ring-offset-0",
              isInProgress && "ring-2 ring-blue-400/70 ring-offset-0 animate-pulse",
              isCancelled && "bg-muted text-muted-foreground line-through opacity-70",
              isDragging && "opacity-50 rotate-1 scale-95 shadow-2xl z-50"
            )}
          >
            {/* Header con horas */}
            <div className="flex items-center gap-1 mb-0.5 opacity-80">
              <Clock className="w-3 h-3 flex-shrink-0" />
              <span className="text-[10px] font-medium whitespace-nowrap tabular-nums">
                {formatTime(task.startTime)} – {formatTime(task.endTime)}
              </span>
            </div>

            {/* Contenido principal */}
            <h3 className="font-bold text-[13px] leading-tight truncate text-left">
              {displayPropertyName()}
            </h3>

            {clientName && (
              <p className="text-[11px] leading-tight truncate text-left opacity-75 mt-0.5">
                {clientName}
              </p>
            )}

            {/* Subtask badge */}
            <SubtaskBadge task={task} />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">{displayPropertyName()}</p>
            <p className="text-xs text-muted-foreground">
              {formatTime(task.startTime)} - {formatTime(task.endTime)}
            </p>
            {clientName && <p className="text-xs">{clientName}</p>}
            {task.address && (
              <p className="text-xs">
                <span className="font-medium">Dirección:</span> {task.address}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

EnhancedTaskCard.displayName = "EnhancedTaskCard";
