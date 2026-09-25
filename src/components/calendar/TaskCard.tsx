import { Clock, GripVertical, ListTodo, RefreshCw } from "lucide-react";
import { Task } from "@/hooks/useCalendarData";
import { cn } from "@/lib/utils";
import { useClientData } from "@/hooks/useClientData";

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
  isDragging?: boolean;
  style?: React.CSSProperties;
  onDragStart?: (e: React.DragEvent, task: Task) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  draggable?: boolean;
}

// Subtask badge component
const SubtaskBadge = ({ task }: { task: Task }) => {
  const additionalTasks = task.additionalTasks || [];
  if (additionalTasks.length === 0) return null;
  
  const pendingCount = additionalTasks.filter(t => !t.completed).length;
  const allCompleted = pendingCount === 0;
  
  return (
    <div 
      className={cn(
        "absolute -top-1 -right-1 z-20 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold shadow-md text-white",
        allCompleted 
          ? "bg-ink-3" 
          : "bg-danger animate-pulse"
      )}
    >
      <ListTodo className="h-3 w-3" />
      <span>{pendingCount > 0 ? pendingCount : additionalTasks.length}</span>
    </div>
  );
};

export const TaskCard = ({
  task,
  onClick,
  isDragging,
  style,
  onDragStart,
  onDragEnd,
  draggable = false
}: TaskCardProps) => {
  const { getClientName } = useClientData();

  // Superficie clara con el estado solo en el borde izquierdo y el punto.
  // 'bg-surface' es blanco: sobre el panel blanco la tarjeta desaparecia.
  const getStatusAccent = (status: string) => {
    switch (status) {
      case "completed":
        return "border-l-success";
      case "in-progress":
        return "border-l-warning";
      case "pending":
        return "border-l-danger";
      default:
        return "border-l-ink-4";
    }
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-success";
      case "in-progress":
        return "bg-warning";
      case "pending":
        return "bg-danger";
      default:
        return "bg-ink-4";
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
      e.stopPropagation();
      onDragStart(e, task);
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (onDragEnd) {
      e.stopPropagation();
      onDragEnd(e);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const clientName = getClientName(task.clienteId || '');

  // Formatear el nombre de la propiedad
  const displayPropertyName = () => {
    return task.property;
  };

  const isRecurring = task.isRecurringInstance;
  const effectiveDraggable = draggable && !isRecurring;

  return (
    <div 
      className={cn(
        "border border-line border-l-4",
        isRecurring
          ? "bg-line-soft hover:bg-paper border-dashed"
          : cn("bg-surface hover:bg-paper", getStatusAccent(task.status)),
        "rounded-lg p-2 text-ink shadow-sober hover:shadow-md transition-all duration-200 group relative overflow-visible select-none",
        effectiveDraggable && "cursor-move",
        !effectiveDraggable && "cursor-pointer",
        isDragging && "opacity-50 scale-95 rotate-3"
      )} 
      style={style} 
      onClick={onClick} 
      draggable={effectiveDraggable} 
      onDragStart={handleDragStart} 
      onDragEnd={handleDragEnd} 
      onDragOver={handleDragOver}
    >
      {/* Subtask badge */}
      <SubtaskBadge task={task} />

      {/* Recurring badge */}
      {isRecurring && (
        <div className="absolute -top-1 -left-1 z-20 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold shadow-md bg-ink-3 text-white">
          <RefreshCw className="h-3 w-3" />
        </div>
      )}

      {/* Drag handle */}
      {effectiveDraggable && (
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-70 transition-opacity">
          <GripVertical className="h-3 w-3" />
        </div>
      )}

      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10 bg-gradient-to-br from-white to-transparent rounded-lg" />
      
      {/* Content */}
      <div className="relative z-10 space-y-1">
        <div className="flex items-start gap-1.5">
          {/* Punto de estado: unico indicador de color dentro de la tarjeta */}
          <span
            className={cn("mt-1.5 h-2 w-2 flex-shrink-0 rounded-full", getStatusDot(task.status))}
            aria-hidden="true"
          />
          {/* Property name - pegado a la izquierda */}
          <div className="flex-1 min-w-0 font-semibold text-sm leading-tight line-clamp-2 text-left">
            {displayPropertyName()}
          </div>
        </div>
        
        {/* Cliente - pegado a la izquierda al mismo nivel */}
        {clientName && (
          <div className="text-xs text-ink-2 text-left leading-tight pl-3.5">
            {clientName}
          </div>
        )}
        
        {/* Solo las horas de inicio y fin */}
        <div className="flex items-center text-xs text-ink-2 pl-3.5">
          <Clock className="h-3 w-3 flex-shrink-0 mr-1" />
          <span className="whitespace-nowrap">
            {formatTime(task.startTime)} - {formatTime(task.endTime)}
          </span>
        </div>

        {/* Address - solo si hay espacio suficiente */}
        {task.address && (
          <div className="text-xs text-ink-3 truncate pl-3.5">
            📍 {task.address}
          </div>
        )}
      </div>

      {/* Hover effect */}
      <div className="absolute inset-0 bg-white opacity-0 hover:opacity-10 transition-opacity duration-200" />
      
      {/* Drag feedback overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-surface opacity-20 animate-pulse" />
      )}
    </div>
  );
};
