import { useQuery } from '@tanstack/react-query';
import { recurringTaskStorage } from '@/services/recurringTaskStorage';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, CheckCircle, Clock, Pause } from 'lucide-react';

const calculateMetrics = (recurringTasks: any[]) => {
  const total = recurringTasks.length;
  const active = recurringTasks.filter(task => task.isActive).length;
  const inactive = total - active;
  
  const byFrequency = recurringTasks.reduce((acc, task) => {
    if (task.isActive) {
      acc[task.frequency] = (acc[task.frequency] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const upcomingThisWeek = recurringTasks.filter(task => {
    if (!task.isActive || !task.nextExecution) return false;
    const nextExecution = new Date(task.nextExecution);
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    return nextExecution >= today && nextExecution <= nextWeek;
  }).length;

  return {
    total,
    active,
    inactive,
    upcomingThisWeek,
    byFrequency
  };
};

const getFrequencyLabel = (frequency: string) => {
  switch (frequency) {
    case 'daily': return 'Diarias';
    case 'weekly': return 'Semanales';
    case 'monthly': return 'Mensuales';
    default: return frequency;
  }
};

const getFrequencyColor = (frequency: string) => {
  switch (frequency) {
    case 'daily': return 'bg-green-100 text-green-800';
    case 'weekly': return 'bg-blue-100 text-blue-800';
    case 'monthly': return 'bg-purple-100 text-purple-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export const RecurringTasksMetrics = () => {
  const { data: recurringTasks, isLoading } = useQuery({
    queryKey: ['recurring-tasks'],
    queryFn: () => recurringTaskStorage.getAll(),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-muted rounded w-20" />
                <div className="h-8 bg-muted rounded w-12" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const metrics = calculateMetrics(recurringTasks || []);

  return (
    <div className="space-y-6">
      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-foreground">{metrics.total}</p>
              </div>
              <Activity className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Activas</p>
                <p className="text-2xl font-bold text-green-600">{metrics.active}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Inactivas</p>
                <p className="text-2xl font-bold text-gray-600">{metrics.inactive}</p>
              </div>
              <Pause className="w-8 h-8 text-gray-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Esta Semana</p>
                <p className="text-2xl font-bold text-orange-600">{metrics.upcomingThisWeek}</p>
              </div>
              <Clock className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Distribución por frecuencia */}
      <Card>
        <CardHeader>
          <CardTitle>Distribución por Frecuencia</CardTitle>
          <CardDescription>
            Cantidad de tareas activas agrupadas por frecuencia de ejecución
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(metrics.byFrequency).length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                No hay tareas activas configuradas
              </p>
            ) : (
              Object.entries(metrics.byFrequency).map(([frequency, count]) => (
                <div key={frequency} className="flex items-center justify-between">
                  <Badge 
                    variant="outline" 
                    className={getFrequencyColor(frequency)}
                  >
                    {getFrequencyLabel(frequency)}
                  </Badge>
                  <span className="font-semibold text-foreground">{count as number} tareas</span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};