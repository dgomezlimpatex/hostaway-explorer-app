
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, MapPin, User, Calendar, Edit, Trash2 } from "lucide-react";
import { Task } from "@/types/calendar";

interface TasksListProps {
  tasks: Task[];
  filters: {
    status: string;
    cleaner: string;
    dateRange: string;
  };
  isLoading: boolean;
}

export const TasksList = ({ tasks, filters, isLoading }: TasksListProps) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 border-green-200";
      case "in-progress":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "pending":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
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

  const filteredTasks = tasks.filter(task => {
    // Filtro por estado
    if (filters.status !== 'all' && task.status !== filters.status) {
      return false;
    }

    // Filtro por limpiador
    if (filters.cleaner !== 'all') {
      if (filters.cleaner === 'unassigned' && task.cleaner) {
        return false;
      }
      if (filters.cleaner !== 'unassigned' && task.cleaner !== filters.cleaner) {
        return false;
      }
    }

    // Filtro por fecha
    if (filters.dateRange !== 'all') {
      const taskDate = new Date(task.date);
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      switch (filters.dateRange) {
        case 'today':
          if (taskDate.toDateString() !== today.toDateString()) return false;
          break;
        case 'tomorrow':
          if (taskDate.toDateString() !== tomorrow.toDateString()) return false;
          break;
        case 'this-week':
          const weekStart = new Date(today);
          weekStart.setDate(today.getDate() - today.getDay());
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          if (taskDate < weekStart || taskDate > weekEnd) return false;
          break;
        case 'next-week':
          const nextWeekStart = new Date(today);
          nextWeekStart.setDate(today.getDate() + (7 - today.getDay()));
          const nextWeekEnd = new Date(nextWeekStart);
          nextWeekEnd.setDate(nextWeekStart.getDate() + 6);
          if (taskDate < nextWeekStart || taskDate > nextWeekEnd) return false;
          break;
      }
    }

    return true;
  });

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Cargando tareas...</p>
      </div>
    );
  }

  if (filteredTasks.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No se encontraron tareas con los filtros aplicados.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {filteredTasks.map((task) => (
        <Card key={task.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex-1 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h4 className="font-semibold text-gray-900 text-lg">
                    {task.property}
                  </h4>
                  <Badge className={getStatusColor(task.status)}>
                    {getStatusText(task.status)}
                  </Badge>
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
                <Button size="sm" variant="outline" className="flex items-center gap-1">
                  <Edit className="h-3 w-3" />
                  Editar
                </Button>
                <Button size="sm" variant="outline" className="flex items-center gap-1 text-red-600 hover:text-red-700">
                  <Trash2 className="h-3 w-3" />
                  Eliminar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
