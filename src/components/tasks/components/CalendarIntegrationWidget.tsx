
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, Calendar as CalendarIcon } from "lucide-react";
import { Task } from "@/types/calendar";
import { Link } from "react-router-dom";

interface CalendarIntegrationWidgetProps {
  tasks: Task[];
}

export const CalendarIntegrationWidget = ({ tasks }: CalendarIntegrationWidgetProps) => {
  const today = new Date().toISOString().split('T')[0];
  const todayTasks = tasks.filter(task => task.date === today);
  const upcomingTasks = tasks
    .filter(task => task.date > today)
    .slice(0, 3)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-700 border-green-200";
      case "in-progress":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "pending":
        return "bg-red-100 text-red-700 border-red-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
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
        return "Sin estado";
    }
  };

  return (
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarIcon className="h-5 w-5 text-blue-600" />
            Vista Rápida del Calendario
          </CardTitle>
          <Link to="/calendar">
            <Button variant="outline" size="sm" className="text-xs">
              Ver Completo
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Tareas de Hoy */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-gray-900 text-sm">Tareas de Hoy</h4>
            <Badge variant="secondary" className="text-xs">
              {todayTasks.length}
            </Badge>
          </div>
          
          {todayTasks.length === 0 ? (
            <div className="text-center py-4">
              <div className="text-gray-400 mb-2">
                <Calendar className="h-8 w-8 mx-auto" />
              </div>
              <p className="text-sm text-gray-500">No hay tareas para hoy</p>
            </div>
          ) : (
            <div className="space-y-2">
              {todayTasks.slice(0, 3).map(task => (
                <div key={task.id} className="border border-blue-200 bg-blue-50 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="h-3 w-3 text-blue-600 flex-shrink-0" />
                        <span className="text-xs font-medium text-blue-800">
                          {task.startTime} - {task.endTime}
                        </span>
                      </div>
                      <p className="font-medium text-sm text-gray-900 truncate">
                        {task.property}
                      </p>
                    </div>
                    <Badge className={`${getStatusColor(task.status)} text-xs px-2 py-0.5`} variant="outline">
                      {getStatusText(task.status)}
                    </Badge>
                  </div>
                </div>
              ))}
              {todayTasks.length > 3 && (
                <p className="text-xs text-center text-gray-500 pt-1">
                  +{todayTasks.length - 3} tareas más
                </p>
              )}
            </div>
          )}
        </div>

        {/* Próximas Tareas */}
        <div className="space-y-3">
          <h4 className="font-semibold text-gray-900 text-sm">Próximas Tareas</h4>
          
          {upcomingTasks.length === 0 ? (
            <div className="text-center py-4">
              <div className="text-gray-400 mb-2">
                <MapPin className="h-8 w-8 mx-auto" />
              </div>
              <p className="text-sm text-gray-500">No hay próximas tareas</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingTasks.map(task => (
                <div key={task.id} className="border border-gray-200 bg-gray-50 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <MapPin className="h-3 w-3 text-gray-600 flex-shrink-0" />
                        <span className="text-xs text-gray-600">
                          {new Date(task.date).toLocaleDateString('es-ES', { 
                            day: 'numeric', 
                            month: 'short' 
                          })} • {task.startTime}
                        </span>
                      </div>
                      <p className="font-medium text-sm text-gray-900 truncate">
                        {task.property}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs px-2 py-0.5 bg-white">
                      {task.cleaner || 'Sin asignar'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
