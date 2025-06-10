
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Clock, MapPin, User, Calendar, Edit, Trash2, UserPlus, History, Euro, Timer } from "lucide-react";
import { Task } from "@/types/calendar";

interface TaskCardProps {
  task: Task;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onQuickStatusChange: (task: Task, newStatus: "completed" | "in-progress" | "pending") => void;
  onAssignCleaner: (task: Task) => void;
  onShowHistory?: (task: Task) => void;
  getStatusColor: (status: string) => string;
  getStatusText: (status: string) => string;
}

export const TaskCard = ({
  task,
  onEditTask,
  onDeleteTask,
  onQuickStatusChange,
  onAssignCleaner,
  onShowHistory,
  getStatusColor,
  getStatusText
}: TaskCardProps) => {
  return (
    <Card className="hover:shadow-md transition-all duration-200 border border-gray-200">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 mb-1 truncate">{task.property}</h3>
            <div className="flex items-center gap-1 text-xs text-gray-600">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{task.address}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <Badge className={`${getStatusColor(task.status)} text-white font-medium px-2 py-0.5 text-xs`}>
              {getStatusText(task.status)}
            </Badge>
            {/* Quick status change buttons */}
            {task.status === 'pending' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onQuickStatusChange(task, 'in-progress')}
                className="text-yellow-600 hover:text-yellow-700 border-yellow-300 hover:bg-yellow-50 h-6 px-2 text-xs"
              >
                Iniciar
              </Button>
            )}
            {task.status === 'in-progress' && (
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white h-6 px-2 text-xs"
                onClick={() => onQuickStatusChange(task, 'completed')}
              >
                Completar
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0 px-4 pb-3">
        {/* Información de fecha y hora - más compacta */}
        <div className="grid grid-cols-2 gap-2 mb-2 p-2 bg-gray-50 rounded text-xs">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3 text-blue-600" />
            <span className="font-medium text-gray-700">
              {new Date(task.date).toLocaleDateString('es-ES', { 
                day: 'numeric', 
                month: 'short' 
              })}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-blue-600" />
            <span className="font-medium text-gray-700">{task.startTime}-{task.endTime}</span>
          </div>
        </div>

        {/* Información del personal - más compacta */}
        <div className="flex items-center justify-between mb-2 p-2 bg-blue-50 rounded">
          <div className="flex items-center gap-1">
            <User className="h-3 w-3 text-blue-600" />
            <span className="text-xs font-medium text-gray-700">
              {task.cleaner || 'Sin asignar'}
            </span>
          </div>
          {!task.cleaner && (
            <Badge variant="outline" className="text-red-600 border-red-300 text-xs px-1 py-0">
              Sin asignar
            </Badge>
          )}
        </div>

        {/* Detalles del servicio - layout horizontal más compacto */}
        <div className="flex gap-2 mb-2 text-xs">
          <div className="flex-1 text-center p-1.5 bg-white border rounded">
            <div className="text-gray-500 uppercase tracking-wide mb-0.5 text-xs">{task.type}</div>
          </div>
          {task.duracion && (
            <div className="flex-1 text-center p-1.5 bg-white border rounded">
              <div className="flex items-center justify-center gap-0.5 text-gray-500 mb-0.5">
                <Timer className="h-2.5 w-2.5" />
                <span className="text-xs">{task.duracion}m</span>
              </div>
            </div>
          )}
          {task.coste && (
            <div className="flex-1 text-center p-1.5 bg-white border rounded">
              <div className="flex items-center justify-center gap-0.5 text-green-600 mb-0.5">
                <Euro className="h-2.5 w-2.5" />
                <span className="text-xs font-medium">€{task.coste}</span>
              </div>
            </div>
          )}
        </div>

        {/* Check-in/Check-out - inline y más compacto */}
        <div className="flex gap-2 mb-2 text-xs">
          <div className="flex-1 flex items-center justify-between p-1.5 bg-gray-50 rounded">
            <span className="text-gray-500">Out:</span>
            <span className="font-medium text-gray-900">{task.checkOut}</span>
          </div>
          <div className="flex-1 flex items-center justify-between p-1.5 bg-gray-50 rounded">
            <span className="text-gray-500">In:</span>
            <span className="font-medium text-gray-900">{task.checkIn}</span>
          </div>
        </div>

        {/* Botones de acción - más compactos */}
        <div className="flex flex-wrap gap-1 pt-2 border-t border-gray-200">
          {onShowHistory && (
            <Button 
              size="sm" 
              variant="outline" 
              className="flex items-center gap-1 hover:bg-gray-50 h-7 px-2 text-xs"
              onClick={() => onShowHistory(task)}
            >
              <History className="h-3 w-3" />
              Historial
            </Button>
          )}
          <Button 
            size="sm" 
            variant="outline" 
            className="flex items-center gap-1 hover:bg-blue-50 text-blue-600 border-blue-300 h-7 px-2 text-xs"
            onClick={() => onAssignCleaner(task)}
          >
            <UserPlus className="h-3 w-3" />
            Asignar
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            className="flex items-center gap-1 hover:bg-green-50 text-green-600 border-green-300 h-7 px-2 text-xs"
            onClick={() => onEditTask(task)}
          >
            <Edit className="h-3 w-3" />
            Editar
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            className="flex items-center gap-1 hover:bg-red-50 text-red-600 border-red-300 h-7 px-2 text-xs"
            onClick={() => onDeleteTask(task.id)}
          >
            <Trash2 className="h-3 w-3" />
            Eliminar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
