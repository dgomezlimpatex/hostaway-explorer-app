import React, { memo, useMemo, useCallback, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { usePerformanceOptimization } from '@/hooks/usePerformanceOptimization';
import { Task } from '@/types/calendar';

// Optimized Stats Cards
export const OptimizedStatsCards = memo<{
  todayTasks: Task[];
  monthlyMetrics: {
    currentMonth: number;
    previousMonth: number;
    change: number;
  };
  pendingIncidents: number;
}>(({ todayTasks, monthlyMetrics, pendingIncidents }) => {
  const { startPerformanceMeasure, endPerformanceMeasure } = usePerformanceOptimization();

  React.useEffect(() => {
    startPerformanceMeasure('stats-cards-render');
    return () => endPerformanceMeasure('stats-cards-render');
  });

  const statsData = useMemo(() => [
    {
      title: "Tareas de Hoy",
      value: todayTasks.length,
      icon: Calendar,
      description: "Tareas programadas para hoy",
      color: "text-blue-600"
    },
    {
      title: "Completadas",
      value: todayTasks.filter(task => task.status === 'completed').length,
      icon: CheckCircle,
      description: "Tareas completadas hoy",
      color: "text-green-600"
    },
    {
      title: "Pendientes",
      value: todayTasks.filter(task => task.status === 'pending').length,
      icon: Clock,
      description: "Tareas pendientes",
      color: "text-yellow-600"
    },
    {
      title: "Incidentes",
      value: pendingIncidents,
      icon: AlertTriangle,
      description: "Incidentes reportados",
      color: "text-red-600"
    }
  ], [todayTasks, pendingIncidents]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {statsData.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index} className="hover:shadow-lg transition-shadow duration-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </p>
                  <p className="text-2xl font-bold">
                    {stat.value}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stat.description}
                  </p>
                </div>
                <Icon className={`h-8 w-8 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
});

OptimizedStatsCards.displayName = 'OptimizedStatsCards';

// Optimized Today Tasks Section
export const OptimizedTodayTasksSection = memo<{
  tasks: Task[];
  currentPage: number;
  totalPages: number;
  onTaskClick: (task: Task) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
  isLoading: boolean;
}>(({ 
  tasks, 
  currentPage, 
  totalPages, 
  onTaskClick, 
  onPreviousPage, 
  onNextPage, 
  isLoading 
}) => {
  const { startPerformanceMeasure, endPerformanceMeasure, createDebouncedFunction } = usePerformanceOptimization();

  React.useEffect(() => {
    startPerformanceMeasure('today-tasks-render');
    return () => endPerformanceMeasure('today-tasks-render');
  });

  // Debounced click handler
  const debouncedTaskClick = useMemo(
    () => createDebouncedFunction(onTaskClick, 150),
    [createDebouncedFunction, onTaskClick]
  );

  const getStatusBadge = useCallback((status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Completada</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-100 text-blue-800">En Progreso</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pendiente</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>;
    }
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <LoadingSpinner size="sm" text="Cargando tareas..." />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-xl">Tareas de Hoy</CardTitle>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onPreviousPage}
              disabled={currentPage === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              {currentPage + 1} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={onNextPage}
              disabled={currentPage === totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No hay tareas programadas para hoy
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => debouncedTaskClick(task)}
              >
                <div className="flex-1">
                  <div className="font-medium">{task.property}</div>
                  <div className="text-sm text-muted-foreground">
                    {task.startTime} - {task.endTime}
                  </div>
                  {task.cleaner && (
                    <div className="text-sm text-blue-600">{task.cleaner}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(task.status)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

OptimizedTodayTasksSection.displayName = 'OptimizedTodayTasksSection';

// Optimized Metrics Cards
export const OptimizedMetricsCards = memo<{
  dashboardMetrics: {
    totalReports: number;
    completedReports: number;
    pendingReports: number;
    completionRate: number;
  };
  isLoading: boolean;
}>(({ dashboardMetrics, isLoading }) => {
  const { startPerformanceMeasure, endPerformanceMeasure } = usePerformanceOptimization();

  React.useEffect(() => {
    startPerformanceMeasure('metrics-cards-render');
    return () => endPerformanceMeasure('metrics-cards-render');
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <LoadingSpinner size="sm" text="Cargando métricas..." />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Métricas del Mes</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {dashboardMetrics.totalReports}
            </div>
            <div className="text-sm text-muted-foreground">
              Total Reportes
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {dashboardMetrics.completedReports}
            </div>
            <div className="text-sm text-muted-foreground">
              Completados
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {dashboardMetrics.pendingReports}
            </div>
            <div className="text-sm text-muted-foreground">
              Pendientes
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {dashboardMetrics.completionRate.toFixed(1)}%
            </div>
            <div className="text-sm text-muted-foreground">
              Tasa Completado
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

OptimizedMetricsCards.displayName = 'OptimizedMetricsCards';