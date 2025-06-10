
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin } from "lucide-react";
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
        return "bg-green-100 text-green-800 border-green-200";
      case "in-progress":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "pending":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Vista Rápida del Calendario
          </CardTitle>
          <Link to="/calendar">
            <Button variant="outline" size="sm">
              Ver Calendario Completo
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tareas de Hoy */}
        <div>
          <h4 className="font-medium text-gray-900 mb-2">Tareas de Hoy ({todayTasks.length})</h4>
          {todayTasks.length === 0 ? (
            <p className="text-sm text-gray-500">No hay tareas programadas para hoy</p>
          ) : (
            <div className="space-y-2">
              {todayTasks.slice(0, 3).map(task => (
                <div key={task.id} className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    <Clock className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{task.property}</p>
                      <p className="text-xs text-gray-600">{task.startTime} - {task.endTime}</p>
                    </div>
                  </div>
                  <Badge className={getStatusColor(task.status)} variant="outline">
                    {task.status === 'completed' ? 'Completado' : 
                     task.status === 'in-progress' ? 'En Progreso' : 'Pendiente'}
                  </Badge>
                </div>
              ))}
              {todayTasks.length > 3 && (
                <p className="text-xs text-gray-500 text-center">
                  y {todayTasks.length - 3} tareas más...
                </p>
              )}
            </div>
          )}
        </div>

        {/* Próximas Tareas */}
        <div>
          <h4 className="font-medium text-gray-900 mb-2">Próximas Tareas</h4>
          {upcomingTasks.length === 0 ? (
            <p className="text-sm text-gray-500">No hay tareas próximas programadas</p>
          ) : (
            <div className="space-y-2">
              {upcomingTasks.map(task => (
                <div key={task.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    <MapPin className="h-4 w-4 text-gray-600 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{task.property}</p>
                      <p className="text-xs text-gray-600">
                        {new Date(task.date).toLocaleDateString('es-ES')} • {task.startTime}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">
                    {task.cleaner || 'Sin asignar'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
