import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, 
  ChevronLeft,
  ChevronRight,
  Users
} from 'lucide-react';
import { Task } from '@/types/calendar';

interface TodayTasksSectionProps {
  todayTasks: Task[];
  paginatedTodayTasks: Task[];
  currentTaskPage: number;
  totalTaskPages: number;
  TASKS_PER_PAGE: number;
  onTaskClick: (task: Task) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
}

export const TodayTasksSection = ({
  todayTasks,
  paginatedTodayTasks,
  currentTaskPage,
  totalTaskPages,
  TASKS_PER_PAGE,
  onTaskClick,
  onPreviousPage,
  onNextPage
}: TodayTasksSectionProps) => {
  const navigate = useNavigate();

  const handleViewAllInCalendar = () => {
    navigate('/calendar');
  };
  return (
    <Card className="bg-white shadow-lg border-0">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-xl font-semibold text-gray-800">
            <Calendar className="h-6 w-6 text-blue-600" />
            Tareas de Hoy
          </CardTitle>
          
          {/* Navegación y paginación - Solo mostrar si hay más de 6 tareas */}
          {todayTasks.length > TASKS_PER_PAGE && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">
                Página {currentTaskPage + 1} de {totalTaskPages}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onPreviousPage}
                  disabled={currentTaskPage === 0}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onNextPage}
                  disabled={currentTaskPage >= totalTaskPages - 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {todayTasks.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No hay tareas programadas para hoy</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedTodayTasks.map((task, index) => (
              <div 
                key={`${task.id}-${index}`} 
                className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border cursor-pointer transition-all hover:shadow-md hover:scale-105 hover:bg-gradient-to-br hover:from-blue-50 hover:to-blue-100"
                onClick={() => onTaskClick(task)}
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium text-gray-900 truncate">{task.property}</h4>
                  <Badge 
                    variant={task.status === 'completed' ? 'default' : task.status === 'in-progress' ? 'secondary' : 'destructive'}
                    className={`text-xs ${
                      task.status === 'completed' 
                        ? 'bg-green-100 text-green-800 border-green-300' 
                        : task.status === 'in-progress' 
                        ? 'bg-blue-100 text-blue-800 border-blue-300' 
                        : 'bg-red-100 text-red-800 border-red-300'
                    }`}
                  >
                    {task.status === 'completed' ? 'Completado' : 
                     task.status === 'in-progress' ? 'En Progreso' : 'Pendiente'}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 mb-2">{task.address}</p>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">{task.startTime} - {task.endTime}</span>
                  {task.cleaner && (
                    <div className="flex items-center gap-1 text-blue-600">
                      <Users className="h-3 w-3" />
                      <span className="text-xs">{task.cleaner}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Indicador de total de tareas si hay paginación */}
        {todayTasks.length > TASKS_PER_PAGE && (
          <div className="text-center mt-4">
            <p className="text-sm text-gray-500">
              Mostrando {paginatedTodayTasks.length} de {todayTasks.length} tareas del día
            </p>
            <Button variant="outline" size="sm" className="mt-2" onClick={handleViewAllInCalendar}>
              Ver todas en el calendario
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};