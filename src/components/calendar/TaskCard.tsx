import { Clock, GripVertical, ListTodo } from "lucide-react";
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
        "absolute -top-1 -right-1 z-20 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold shadow-md",
        allCompleted 
          ? "bg-green-500 text-white" 
          : "bg-red-500 text-white animate-pulse"
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500 hover:bg-green-600";
      case "in-progress":
        return "bg-yellow-500 hover:bg-yellow-600";
      case "pending":
        return "bg-red-500 hover:bg-red-600";
      default:
        return "bg-gray-500 hover:bg-gray-600";
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

  return (
    <div 
      className={cn(
        getStatusColor(task.status), 
        "rounded-lg p-2 text-white shadow-lg hover:shadow-xl transition-all duration-200 cursor-move group relative overflow-visible select-none",
        isDragging && "opacity-50 scale-95 rotate-3"
      )} 
      style={style} 
      onClick={onClick} 
      draggable={draggable} 
      onDragStart={handleDragStart} 
      onDragEnd={handleDragEnd} 
      onDragOver={handleDragOver}
    >
      {/* Subtask badge */}
      <SubtaskBadge task={task} />

      {/* Drag handle */}
      {draggable && (
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-70 transition-opacity">
          <GripVertical className="h-3 w-3" />
        </div>
      )}

      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10 bg-gradient-to-br from-white to-transparent rounded-lg" />
      
      {/* Content */}
      <div className="relative z-10 space-y-1">
        {/* Property name - pegado a la izquierda */}
        <div className="font-semibold text-sm leading-tight line-clamp-2 text-left">
          {displayPropertyName()}
        </div>
        
        {/* Cliente - pegado a la izquierda al mismo nivel */}
        {clientName && (
          <div className="text-xs opacity-90 text-left leading-tight">
            {clientName}
          </div>
        )}
        
        {/* Solo las horas de inicio y fin */}
        <div className="flex items-center text-xs">
          <Clock className="h-3 w-3 flex-shrink-0 mr-1" />
          <span className="whitespace-nowrap">
            {formatTime(task.startTime)} - {formatTime(task.endTime)}
          </span>
        </div>

        {/* Address - solo si hay espacio suficiente */}
        {task.address && (
          <div className="text-xs opacity-70 truncate">
            📍 {task.address}
          </div>
        )}
      </div>

      {/* Hover effect */}
      <div className="absolute inset-0 bg-white opacity-0 hover:opacity-10 transition-opacity duration-200" />
      
      {/* Drag feedback overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-blue-500 opacity-20 animate-pulse" />
      )}
    </div>
  );
};
