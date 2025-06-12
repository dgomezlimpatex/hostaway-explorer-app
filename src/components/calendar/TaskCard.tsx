import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, GripVertical } from "lucide-react";
import { Task } from "@/hooks/useCalendarData";
import { cn } from "@/lib/utils";
interface TaskCardProps {
  task: Task;
  onClick?: () => void;
  isDragging?: boolean;
  style?: React.CSSProperties;
  onDragStart?: (e: React.DragEvent, task: Task) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  draggable?: boolean;
}
export const TaskCard = ({
  task,
  onClick,
  isDragging,
  style,
  onDragStart,
  onDragEnd,
  draggable = false
}: TaskCardProps) => {
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
  const getStatusText = (status: string) => {
    switch (status) {
      case "completed":
        return "Completado";
      case "in-progress":
        return "En Progreso";
      case "pending":
        return "Pendiente";
      default:
        return "Desconocido";
    }
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
  return <div className={cn(getStatusColor(task.status), "rounded-lg p-3 text-white shadow-lg hover:shadow-xl transition-all duration-200 cursor-move group relative overflow-hidden select-none", isDragging && "opacity-50 scale-95 rotate-3")} style={style} onClick={onClick} draggable={draggable} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragOver={handleDragOver}>
      {/* Drag handle */}
      {draggable && <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-70 transition-opacity">
          <GripVertical className="h-3 w-3" />
        </div>}

      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10 bg-gradient-to-br from-white to-transparent" />
      
      {/* Content */}
      <div className="relative z-10 space-y-2">
        {/* Property name */}
        <div className="font-semibold text-sm leading-tight line-clamp-2">
          {task.property}
        </div>
        
        {/* Time and type */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{task.startTime} - {task.endTime}</span>
          </div>
          <Badge variant="secondary" className="bg-white/20 text-white border-white/30 text-xs px-2 py-0">
            {getStatusText(task.status)}
          </Badge>
        </div>

        {/* Check times */}
        <div className="text-xs opacity-90 flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          <span>Out: {task.checkOut} | In: {task.checkIn}</span>
        </div>

        {/* Address */}
        {task.address && <div className="text-xs opacity-80 truncate">
            📍 {task.address}
          </div>}
      </div>

      {/* Hover effect */}
      <div className="absolute inset-0 bg-white opacity-0 hover:opacity-10 transition-opacity duration-200 mx-0" />
      
      {/* Drag feedback overlay */}
      {isDragging && <div className="absolute inset-0 bg-blue-500 opacity-20 animate-pulse" />}
    </div>;
};