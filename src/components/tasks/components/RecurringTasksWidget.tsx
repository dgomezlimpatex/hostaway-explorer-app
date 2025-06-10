
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Repeat, Play, Calendar, Settings } from "lucide-react";
import { useState } from "react";
import { useRecurringTasks, useProcessRecurringTasks } from "@/hooks/useRecurringTasks";
import { CreateRecurringTaskModal } from "@/components/modals/CreateRecurringTaskModal";

export const RecurringTasksWidget = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { data: recurringTasks = [] } = useRecurringTasks();
  const processRecurringTasks = useProcessRecurringTasks();

  const activeTasks = recurringTasks.filter(task => task.isActive);
  const upcomingTasks = recurringTasks.filter(task => {
    const nextExec = new Date(task.nextExecution);
    const today = new Date();
    const weekFromNow = new Date();
    weekFromNow.setDate(today.getDate() + 7);
    return task.isActive && nextExec >= today && nextExec <= weekFromNow;
  });

  const handleProcessTasks = () => {
    processRecurringTasks.mutate();
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Repeat className="h-5 w-5" />
            Tareas Recurrentes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Estadísticas */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-center p-2 bg-blue-50 rounded">
              <div className="font-semibold text-blue-700">{activeTasks.length}</div>
              <div className="text-blue-600">Activas</div>
            </div>
            <div className="text-center p-2 bg-green-50 rounded">
              <div className="font-semibold text-green-700">{upcomingTasks.length}</div>
              <div className="text-green-600">Esta semana</div>
            </div>
          </div>

          {/* Próximas ejecuciones */}
          {upcomingTasks.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">Próximas ejecuciones:</h4>
              <div className="space-y-1">
                {upcomingTasks.slice(0, 3).map(task => (
                  <div key={task.id} className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded">
                    <span className="truncate flex-1">{task.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {new Date(task.nextExecution).toLocaleDateString('es-ES', { 
                        day: 'numeric', 
                        month: 'short' 
                      })}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Botones de acción */}
          <div className="space-y-2">
            <Button 
              onClick={handleProcessTasks}
              className="w-full flex items-center gap-2"
              size="sm"
              disabled={processRecurringTasks.isPending}
            >
              <Play className="h-4 w-4" />
              {processRecurringTasks.isPending ? 'Procesando...' : 'Generar Tareas Pendientes'}
            </Button>
            
            <Button 
              onClick={() => setIsCreateModalOpen(true)}
              variant="outline"
              className="w-full flex items-center gap-2"
              size="sm"
            >
              <Calendar className="h-4 w-4" />
              Nueva Tarea Recurrente
            </Button>
          </div>

          {activeTasks.length === 0 && (
            <div className="text-center py-4 text-sm text-gray-500">
              No hay tareas recurrentes configuradas
            </div>
          )}
        </CardContent>
      </Card>

      <CreateRecurringTaskModal 
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
      />
    </>
  );
};
