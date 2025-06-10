
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, Calendar as CalendarIcon, ExternalLink } from "lucide-react";
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
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "in-progress":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "pending":
        return "bg-rose-50 text-rose-700 border-rose-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
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
    <Card className="shadow-sm border-0 bg-gradient-to-br from-blue-50 to-indigo-50">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-800">
            <div className="p-1.5 bg-blue-100 rounded-lg">
              <CalendarIcon className="h-5 w-5 text-blue-600" />
            </div>
            Vista Rápida del Calendario
          </CardTitle>
          <Link to="/calendar">
            <Button variant="outline" size="sm" className="text-xs bg-white hover:bg-blue-50 border-blue-200 text-blue-700 shadow-sm">
              <ExternalLink className="h-3 w-3 mr-1" />
              Ver Completo
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Tareas de Hoy */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-slate-900 text-sm flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              Tareas de Hoy
            </h4>
            <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 border-blue-200">
              {todayTasks.length}
            </Badge>
          </div>
          
          {todayTasks.length === 0 ? (
            <div className="text-center py-6 bg-white rounded-lg border border-blue-100">
              <div className="text-blue-300 mb-3">
                <Calendar className="h-10 w-10 mx-auto" />
              </div>
              <p className="text-sm text-slate-500 font-medium">No hay tareas para hoy</p>
              <p className="text-xs text-slate-400 mt-1">¡Día libre!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todayTasks.slice(0, 3).map(task => (
                <div key={task.id} className="bg-white border border-blue-100 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1 bg-blue-50 rounded">
                          <Clock className="h-3 w-3 text-blue-600" />
                        </div>
                        <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-1 rounded">
                          {task.startTime} - {task.endTime}
                        </span>
                      </div>
                      <p className="font-medium text-sm text-slate-900 truncate mb-1">
                        {task.property}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {task.address}
                      </p>
                    </div>
                    <Badge className={`${getStatusColor(task.status)} text-xs px-2 py-1 font-medium`} variant="outline">
                      {getStatusText(task.status)}
                    </Badge>
                  </div>
                </div>
              ))}
              {todayTasks.length > 3 && (
                <div className="text-center py-2">
                  <p className="text-xs text-slate-500">
                    +{todayTasks.length - 3} tareas más
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Próximas Tareas */}
        <div className="space-y-3">
          <h4 className="font-medium text-slate-900 text-sm flex items-center gap-2">
            <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
            Próximas Tareas
          </h4>
          
          {upcomingTasks.length === 0 ? (
            <div className="text-center py-6 bg-white rounded-lg border border-indigo-100">
              <div className="text-indigo-300 mb-3">
                <MapPin className="h-10 w-10 mx-auto" />
              </div>
              <p className="text-sm text-slate-500 font-medium">No hay próximas tareas</p>
              <p className="text-xs text-slate-400 mt-1">Todo al día</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingTasks.map(task => (
                <div key={task.id} className="bg-white border border-indigo-100 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1 bg-indigo-50 rounded">
                          <MapPin className="h-3 w-3 text-indigo-600" />
                        </div>
                        <span className="text-xs text-indigo-700 bg-indigo-50 px-2 py-1 rounded font-medium">
                          {new Date(task.date).toLocaleDateString('es-ES', { 
                            day: 'numeric', 
                            month: 'short' 
                          })} • {task.startTime}
                        </span>
                      </div>
                      <p className="font-medium text-sm text-slate-900 truncate">
                        {task.property}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs px-2 py-1 bg-white border-slate-200 text-slate-600">
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
