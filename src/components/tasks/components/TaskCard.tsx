
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
    <Card className="hover:shadow-lg transition-all duration-200 border border-gray-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900 mb-2">{task.property}</h3>
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
              <MapPin className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{task.address}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge className={`${getStatusColor(task.status)} text-white font-medium px-3 py-1`}>
              {getStatusText(task.status)}
            </Badge>
            {/* Quick status change buttons */}
            {task.status === 'pending' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onQuickStatusChange(task, 'in-progress')}
                className="text-yellow-600 hover:text-yellow-700 border-yellow-300 hover:bg-yellow-50"
              >
                Iniciar
              </Button>
            )}
            {task.status === 'in-progress' && (
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => onQuickStatusChange(task, 'completed')}
              >
                Completar
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        {/* Información de fecha y hora */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-blue-600" />
            <span className="font-medium text-gray-700">
              {new Date(task.date).toLocaleDateString('es-ES', { 
                weekday: 'short', 
                day: 'numeric', 
                month: 'short' 
              })}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-blue-600" />
            <span className="font-medium text-gray-700">{task.startTime} - {task.endTime}</span>
          </div>
        </div>

        {/* Información del personal */}
        <div className="flex items-center justify-between mb-4 p-3 bg-blue-50 rounded-lg">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">
              {task.cleaner || 'Sin asignar'}
            </span>
          </div>
          {!task.cleaner && (
            <Badge variant="outline" className="text-red-600 border-red-300">
              Sin asignar
            </Badge>
          )}
        </div>

        {/* Detalles del servicio */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className="text-center p-2 bg-white border rounded-lg">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Tipo</div>
            <div className="text-sm font-medium text-gray-900">{task.type}</div>
          </div>
          {task.duracion && (
            <div className="text-center p-2 bg-white border rounded-lg">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1 flex items-center justify-center gap-1">
                <Timer className="h-3 w-3" />
                Duración
              </div>
              <div className="text-sm font-medium text-gray-900">{task.duracion} min</div>
            </div>
          )}
          {task.coste && (
            <div className="text-center p-2 bg-white border rounded-lg">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1 flex items-center justify-center gap-1">
                <Euro className="h-3 w-3" />
                Coste
              </div>
              <div className="text-sm font-medium text-green-600">€{task.coste}</div>
            </div>
          )}
        </div>

        {/* Check-in/Check-out */}
        <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
          <div className="text-center p-2 bg-gray-50 rounded">
            <div className="text-gray-500 mb-1">Check-out</div>
            <div className="font-medium text-gray-900">{task.checkOut}</div>
          </div>
          <div className="text-center p-2 bg-gray-50 rounded">
            <div className="text-gray-500 mb-1">Check-in</div>
            <div className="font-medium text-gray-900">{task.checkIn}</div>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-200">
          {onShowHistory && (
            <Button 
              size="sm" 
              variant="outline" 
              className="flex items-center gap-2 hover:bg-gray-50"
              onClick={() => onShowHistory(task)}
            >
              <History className="h-3 w-3" />
              Historial
            </Button>
          )}
          <Button 
            size="sm" 
            variant="outline" 
            className="flex items-center gap-2 hover:bg-blue-50 text-blue-600 border-blue-300"
            onClick={() => onAssignCleaner(task)}
          >
            <UserPlus className="h-3 w-3" />
            Asignar
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            className="flex items-center gap-2 hover:bg-green-50 text-green-600 border-green-300"
            onClick={() => onEditTask(task)}
          >
            <Edit className="h-3 w-3" />
            Editar
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            className="flex items-center gap-2 hover:bg-red-50 text-red-600 border-red-300"
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
