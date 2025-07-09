import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  AlertTriangle, 
  Clock,
  TrendingUp,
} from 'lucide-react';
import { Task } from '@/types/calendar';

interface DashboardMetricsCardsProps {
  pendingIncidents: number;
  unassignedTasksCount: number;
  todayTasks: Task[];
}

export const DashboardMetricsCards = ({
  pendingIncidents,
  unassignedTasksCount,
  todayTasks
}: DashboardMetricsCardsProps) => {
  const completedTasks = todayTasks.filter(t => t.status === 'completed').length;
  const progressPercentage = todayTasks.length > 0 ? (completedTasks / todayTasks.length) * 100 : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Incidencias por resolver */}
      <Card className="bg-white shadow-lg border-l-4 border-orange-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-800">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Incidencias por Resolver
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-600 mb-2">{pendingIncidents}</div>
            <p className="text-sm text-gray-600">Reportes con incidencias pendientes</p>
            {pendingIncidents > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3 border-orange-300 text-orange-700 hover:bg-orange-50"
                onClick={() => window.location.href = '/cleaning-reports'}
              >
                Ver Reportes
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tareas sin asignar */}
      <Card className="bg-white shadow-lg border-l-4 border-yellow-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-800">
            <Clock className="h-5 w-5 text-yellow-500" />
            Tareas Sin Asignar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-600 mb-2">{unassignedTasksCount}</div>
            <p className="text-sm text-gray-600">Requieren asignación de personal</p>
            {unassignedTasksCount > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3 border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                onClick={() => window.location.href = '/tasks'}
              >
                Asignar Tareas
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Progreso General */}
      <Card className="bg-white shadow-lg border-l-4 border-green-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-800">
            <TrendingUp className="h-5 w-5 text-green-500" />
            Progreso del Día
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Tareas Completadas</span>
              <span className="text-sm font-medium text-gray-800">
                {completedTasks}/{todayTasks.length}
              </span>
            </div>
            <Progress 
              value={progressPercentage}
              className="h-2"
            />
            <p className="text-xs text-gray-500 text-center">
              {todayTasks.length > 0 
                ? `${Math.round(progressPercentage)}% completado`
                : 'Sin tareas para hoy'
              }
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};