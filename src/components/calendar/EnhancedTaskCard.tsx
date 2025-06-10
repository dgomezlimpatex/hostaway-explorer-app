
import React from "react";
import { Task } from "@/types/calendar";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { Clock, MapPin, User } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-100 border-emerald-300 dark:bg-emerald-900/20 dark:border-emerald-700';
      case 'in-progress': return 'bg-blue-100 border-blue-300 dark:bg-blue-900/20 dark:border-blue-700';
      case 'cancelled': return 'bg-red-100 border-red-300 dark:bg-red-900/20 dark:border-red-700';
      default: return 'bg-amber-100 border-amber-300 dark:bg-amber-900/20 dark:border-amber-700';
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (onDragStart) {
      onDragStart(e, task);
    }
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
            style={style}
            className={cn(
              "relative p-2 rounded-lg border-l-4 cursor-pointer transition-all duration-300",
              "hover:shadow-lg hover:scale-[1.02] hover:-translate-y-0.5",
              "focus:outline-none focus:ring-2 focus:ring-primary/50",
              "transform-gpu", // Hardware acceleration
              getStatusColor(task.status),
              isDragging && "opacity-50 rotate-2 scale-95 shadow-2xl z-50"
            )}
          >
            {/* Header con estado */}
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <StatusIndicator 
                  status={task.status as any} 
                  size="sm" 
                  showTooltip={false}
                />
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                  {task.type}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <Clock className="w-3 h-3" />
                <span>{task.startTime} - {task.endTime}</span>
              </div>
            </div>

            {/* Contenido principal */}
            <div className="space-y-1">
              <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 line-clamp-2">
                {task.title}
              </h3>
              
              {/* Información de ubicación y cliente */}
              <div className="space-y-1">
                {task.cliente && (
                  <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
                    <User className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{task.cliente}</span>
                  </div>
                )}
                
                {task.propiedad && (
                  <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{task.propiedad}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Indicador de arrastre */}
            <div className="absolute top-1 right-1 opacity-30 group-hover:opacity-100 transition-opacity duration-200">
              <div className="grid grid-cols-2 gap-0.5">
                {[...Array(6)].map((_, i) => (
                  <div 
                    key={i} 
                    className="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-500" 
                  />
                ))}
              </div>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">{task.title}</p>
            <p className="text-xs text-muted-foreground">
              {task.startTime} - {task.endTime}
            </p>
            {task.description && (
              <p className="text-xs">{task.description}</p>
            )}
            {task.cleaner && (
              <p className="text-xs">
                <span className="font-medium">Limpiador:</span> {task.cleaner}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

EnhancedTaskCard.displayName = "EnhancedTaskCard";
