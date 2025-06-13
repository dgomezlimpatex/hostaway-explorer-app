
import React from "react";
import { Task } from "@/types/calendar";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useClientData } from "@/hooks/useClientData";

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-100 border-emerald-300 dark:bg-emerald-900/20 dark:border-emerald-700';
      case 'in-progress':
        return 'bg-blue-100 border-blue-300 dark:bg-blue-900/20 dark:border-blue-700';
      case 'cancelled':
        return 'bg-red-100 border-red-300 dark:bg-red-900/20 dark:border-red-700';
      default:
        return 'bg-amber-100 border-amber-300 dark:bg-amber-900/20 dark:border-amber-700';
    }
  };

  // Función para formatear tiempo de HH:MM:SS a HH:MM
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

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            draggable
            onClick={onClick}
            onDragStart={handleDragStart}
            onDragEnd={onDragEnd}
            style={style}
            className={cn(
              "relative p-2 rounded-lg border-l-4 cursor-pointer transition-all duration-300",
              "hover:shadow-lg hover:scale-[1.02] hover:-translate-y-0.5",
              "focus:outline-none focus:ring-2 focus:ring-primary/50",
              "transform-gpu overflow-hidden",
              getStatusColor(task.status),
              isDragging && "opacity-50 rotate-2 scale-95 shadow-2xl z-50"
            )}
          >
            {/* Header con horas */}
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <Clock className="w-3 h-3 flex-shrink-0" />
                <span className="whitespace-nowrap">
                  {formatTime(task.startTime)} - {formatTime(task.endTime)}
                </span>
              </div>
            </div>

            {/* Contenido principal */}
            <div className="space-y-1">
              {/* Código y nombre del piso - pegado a la izquierda */}
              <h3 className="font-semibold text-sm truncate text-left text-zinc-950">
                {task.property}
              </h3>
              
              {/* Nombre del cliente - pegado a la izquierda */}
              {clientName && (
                <p className="text-xs truncate text-left text-zinc-900">
                  {clientName}
                </p>
              )}
            </div>

            {/* Indicador de arrastre */}
            <div className="absolute top-1 right-1 opacity-30 group-hover:opacity-100 transition-opacity duration-200">
              <div className="grid grid-cols-2 gap-0.5">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-500" />
                ))}
              </div>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">{task.property}</p>
            <p className="text-xs text-muted-foreground">
              {formatTime(task.startTime)} - {formatTime(task.endTime)}
            </p>
            {clientName && (
              <p className="text-xs">
                {clientName}
              </p>
            )}
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
