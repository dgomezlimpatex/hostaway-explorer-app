import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { CalendarDays, Clock, MapPin, User, Settings, Trash2, Edit } from 'lucide-react';
import { useRecurringTasks, useUpdateRecurringTask, useDeleteRecurringTask } from '@/hooks/useRecurringTasks';
import { RecurringTask } from '@/types/recurring';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { EditRecurringTaskModal } from './EditRecurringTaskModal';

const frequencyLabels = {
  daily: 'Diario',
  weekly: 'Semanal', 
  monthly: 'Mensual'
};

const dayLabels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

interface RecurringTasksListProps {
  onCreateNew?: () => void;
}

export const RecurringTasksList = ({ onCreateNew }: RecurringTasksListProps) => {
  const { data: recurringTasks, isLoading } = useRecurringTasks();
  const updateRecurringTask = useUpdateRecurringTask();
  const deleteRecurringTask = useDeleteRecurringTask();
  const [editingTask, setEditingTask] = useState<RecurringTask | null>(null);

  const handleToggleActive = async (task: RecurringTask) => {
    updateRecurringTask.mutate({
      id: task.id,
      updates: { isActive: !task.isActive }
    });
  };

  const handleDelete = async (taskId: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar esta tarea recurrente?')) {
      deleteRecurringTask.mutate(taskId);
    }
  };

  const formatRecurrenceDescription = (task: RecurringTask) => {
    let description = `${frequencyLabels[task.frequency]}`;
    
    if (task.interval > 1) {
      description += ` cada ${task.interval}`;
      if (task.frequency === 'daily') description += ' días';
      if (task.frequency === 'weekly') description += ' semanas';  
      if (task.frequency === 'monthly') description += ' meses';
    }

    if (task.frequency === 'weekly' && task.daysOfWeek && task.daysOfWeek.length > 0) {
      const days = task.daysOfWeek.map(day => dayLabels[day]).join(', ');
      description += ` (${days})`;
    }

    if (task.frequency === 'monthly' && task.dayOfMonth) {
      description += ` el día ${task.dayOfMonth}`;
    }

    return description;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-muted rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!recurringTasks || recurringTasks.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <CalendarDays className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No hay tareas recurrentes</h3>
          <p className="text-muted-foreground mb-4">
            Crea tu primera tarea recurrente para automatizar tus procesos.
          </p>
          {onCreateNew && (
            <Button onClick={onCreateNew}>
              Crear primera tarea recurrente
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Tareas Recurrentes</h2>
          {onCreateNew && (
            <Button onClick={onCreateNew}>
              Nueva tarea recurrente
            </Button>
          )}
        </div>

        {recurringTasks.map((task) => (
          <Card key={task.id} className={!task.isActive ? 'opacity-60' : ''}>
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{task.name}</CardTitle>
                  {task.description && (
                    <p className="text-sm text-muted-foreground">{task.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={task.isActive ? 'default' : 'secondary'}>
                    {task.isActive ? 'Activa' : 'Inactiva'}
                  </Badge>
                  <Switch
                    checked={task.isActive}
                    onCheckedChange={() => handleToggleActive(task)}
                  />
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    <span>{formatRecurrenceDescription(task)}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{task.startTime} - {task.endTime}</span>
                  </div>

                  {task.cleaner && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>{task.cleaner}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="font-medium">Próxima ejecución: </span>
                    <span className="text-muted-foreground">
                      {format(parseISO(task.nextExecution), 'dd/MM/yyyy', { locale: es })}
                    </span>
                  </div>

                  {task.endDate && (
                    <div className="text-sm">
                      <span className="font-medium">Finaliza: </span>
                      <span className="text-muted-foreground">
                        {format(parseISO(task.endDate), 'dd/MM/yyyy', { locale: es })}
                      </span>
                    </div>
                  )}

                  {task.lastExecution && (
                    <div className="text-sm">
                      <span className="font-medium">Última ejecución: </span>
                      <span className="text-muted-foreground">
                        {format(parseISO(task.lastExecution), 'dd/MM/yyyy', { locale: es })}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {task.type}
                  </Badge>
                  {task.coste && (
                    <Badge variant="outline" className="text-xs">
                      €{task.coste}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingTask(task)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(task.id)}
                    className="text-destructive hover:text-destructive-foreground hover:bg-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {editingTask && (
        <EditRecurringTaskModal
          task={editingTask}
          open={!!editingTask}
          onOpenChange={(open) => !open && setEditingTask(null)}
        />
      )}
    </>
  );
};