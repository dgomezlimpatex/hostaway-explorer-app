import { useQuery } from '@tanstack/react-query';
import { recurringTaskStorage } from '@/services/recurringTaskStorage';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock } from 'lucide-react';
import { format, addDays, isAfter, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';

interface UpcomingExecution {
  id: string;
  name: string;
  nextExecution: string;
  frequency: string;
  interval: number;
  daysUntilExecution: number;
}

const calculateUpcomingExecutions = (recurringTasks: any[]): UpcomingExecution[] => {
  const today = new Date();
  const nextWeek = addDays(today, 7);
  
  return recurringTasks
    .filter(task => task.isActive && task.nextExecution)
    .map(task => {
      const nextExecution = new Date(task.nextExecution);
      const daysUntilExecution = Math.ceil(
        (nextExecution.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      return {
        id: task.id,
        name: task.name,
        nextExecution: task.nextExecution,
        frequency: task.frequency,
        interval: task.interval,
        daysUntilExecution
      };
    })
    .filter(execution => 
      isAfter(new Date(execution.nextExecution), today) && 
      isBefore(new Date(execution.nextExecution), nextWeek)
    )
    .sort((a, b) => a.daysUntilExecution - b.daysUntilExecution);
};

const getFrequencyBadgeColor = (frequency: string) => {
  switch (frequency) {
    case 'daily': return 'bg-green-100 text-green-800';
    case 'weekly': return 'bg-blue-100 text-blue-800';
    case 'monthly': return 'bg-purple-100 text-purple-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getFrequencyLabel = (frequency: string, interval: number) => {
  switch (frequency) {
    case 'daily': return interval === 1 ? 'Diario' : `Cada ${interval} días`;
    case 'weekly': return interval === 1 ? 'Semanal' : `Cada ${interval} semanas`;
    case 'monthly': return interval === 1 ? 'Mensual' : `Cada ${interval} meses`;
    default: return frequency;
  }
};

const getUrgencyColor = (daysUntil: number) => {
  if (daysUntil <= 1) return 'text-red-600';
  if (daysUntil <= 2) return 'text-orange-600';
  if (daysUntil <= 4) return 'text-yellow-600';
  return 'text-green-600';
};

export const UpcomingTasksPreview = () => {
  const { data: recurringTasks, isLoading } = useQuery({
    queryKey: ['recurring-tasks'],
    queryFn: () => recurringTaskStorage.getAll(),
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Próximas Ejecuciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const upcomingExecutions = calculateUpcomingExecutions(recurringTasks || []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Próximas Ejecuciones
        </CardTitle>
        <CardDescription>
          Tareas programadas para los próximos 7 días
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {upcomingExecutions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>No hay tareas programadas para los próximos 7 días</p>
          </div>
        ) : (
          upcomingExecutions.map((execution) => (
            <div
              key={execution.id}
              className="flex items-center justify-between p-4 rounded-lg border bg-card"
            >
              <div className="flex-1">
                <h4 className="font-medium text-card-foreground mb-1">
                  {execution.name}
                </h4>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {format(new Date(execution.nextExecution), "dd 'de' MMM, yyyy", { locale: es })}
                  </div>
                  <Badge 
                    variant="outline" 
                    className={getFrequencyBadgeColor(execution.frequency)}
                  >
                    {getFrequencyLabel(execution.frequency, execution.interval)}
                  </Badge>
                </div>
              </div>
              <div className="text-right">
                <div className={`font-semibold ${getUrgencyColor(execution.daysUntilExecution)}`}>
                  {execution.daysUntilExecution === 0 && 'Hoy'}
                  {execution.daysUntilExecution === 1 && 'Mañana'}
                  {execution.daysUntilExecution > 1 && `En ${execution.daysUntilExecution} días`}
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};