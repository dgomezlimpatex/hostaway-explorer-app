
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, MapPin, User, Calendar, Edit, Trash2, UserPlus, History } from "lucide-react";
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
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex-1 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h4 className="font-semibold text-gray-900 text-lg">
                {task.property}
              </h4>
              <div className="flex items-center gap-2">
                <Badge className={getStatusColor(task.status)}>
                  {getStatusText(task.status)}
                </Badge>
                
                {/* Quick status change buttons */}
                {task.status === 'pending' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onQuickStatusChange(task, 'in-progress')}
                    className="text-yellow-600 hover:text-yellow-700"
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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>{new Date(task.date).toLocaleDateString('es-ES')}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{task.startTime} - {task.endTime}</span>
              </div>
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                <span className="truncate">{task.address}</span>
              </div>
              <div className="flex items-center gap-1">
                <User className="h-4 w-4" />
                <span>{task.cleaner || 'Sin asignar'}</span>
              </div>
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>Tipo: {task.type}</span>
              {task.duracion && <span>Duración: {task.duracion} min</span>}
              {task.coste && <span>Coste: €{task.coste}</span>}
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            {onShowHistory && (
              <Button 
                size="sm" 
                variant="outline" 
                className="flex items-center gap-1"
                onClick={() => onShowHistory(task)}
              >
                <History className="h-3 w-3" />
                Historial
              </Button>
            )}
            <Button 
              size="sm" 
              variant="outline" 
              className="flex items-center gap-1"
              onClick={() => onAssignCleaner(task)}
            >
              <UserPlus className="h-3 w-3" />
              Asignar
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              className="flex items-center gap-1"
              onClick={() => onEditTask(task)}
            >
              <Edit className="h-3 w-3" />
              Editar
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              className="flex items-center gap-1 text-red-600 hover:text-red-700"
              onClick={() => onDeleteTask(task.id)}
            >
              <Trash2 className="h-3 w-3" />
              Eliminar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
