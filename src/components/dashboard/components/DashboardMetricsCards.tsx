import React from 'react';
import { useNavigate } from 'react-router-dom';

import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Clock, TrendingUp } from 'lucide-react';
import { Task } from '@/types/calendar';
import { StatCard } from '@/components/ui/stat-card';

interface DashboardMetricsCardsProps {
  pendingIncidents: number;
  unassignedTasksCount: number;
  todayTasks: Task[];
}

const DashboardMetricsCards = ({
  pendingIncidents,
  unassignedTasksCount,
  todayTasks
}: DashboardMetricsCardsProps) => {
  const navigate = useNavigate();
  const completedTasks = todayTasks.filter(t => t.status === 'completed').length;
  const progressPercentage = todayTasks.length > 0 ? (completedTasks / todayTasks.length) * 100 : 0;

  const handleViewReports = () => navigate('/cleaning-reports');
  const handleAssignTasks = () => navigate('/tasks');

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <StatCard
        title="Incidencias por Resolver"
        value={pendingIncidents}
        description="Reportes con incidencias pendientes"
        icon={AlertTriangle}
        accent="warning"
        cta={pendingIncidents > 0 ? { label: 'Ver Reportes', onClick: handleViewReports } : null}
      />

      <StatCard
        title="Tareas Sin Asignar"
        value={unassignedTasksCount}
        description="Requieren asignación de personal"
        icon={Clock}
        accent="info"
        cta={unassignedTasksCount > 0 ? { label: 'Asignar Tareas', onClick: handleAssignTasks } : null}
      />

      <StatCard
        title="Progreso del Día"
        value={`${completedTasks}/${todayTasks.length}`}
        description={todayTasks.length > 0 ? `${Math.round(progressPercentage)}% completado` : 'Sin tareas para hoy'}
        icon={TrendingUp}
        accent="success"
      >
        <Progress value={progressPercentage} className="h-2 [&>div]:bg-[hsl(var(--success))]" />
      </StatCard>
    </div>
  );
};

export default DashboardMetricsCards;
