import { useMemo } from 'react';
import { useCurrentWeekWorkload } from './useWorkloadCalculation';
import { WorkerAlert, WorkerHoursOverview } from '@/types/calendar';

export const useWorkerAlerts = () => {
  const { data: workloadData = [], isLoading } = useCurrentWeekWorkload();

  // Calculate worker hours overview and alerts
  const { workersOverview, alerts } = useMemo(() => {
    const workersOverview: WorkerHoursOverview[] = [];
    const alerts: WorkerAlert[] = [];

    workloadData.forEach(summary => {
      if (summary.contractHoursPerWeek === 0) return;

      const overview: WorkerHoursOverview = {
        cleanerId: summary.cleanerId,
        contractHours: summary.contractHoursPerWeek,
        workedHours: summary.totalWorked,
        remainingHours: summary.remainingHours,
        overtimeHours: summary.overtimeHours,
        efficiencyRate: summary.percentageComplete,
        weeklyProjection: summary.totalWorked, // Already weekly
        monthlyProjection: summary.totalWorked * 4.34, // Approximate month
      };

      workersOverview.push(overview);

      // Generate alerts based on conditions
      if (summary.overtimeHours > 5) {
        alerts.push({
          type: 'hours_exceeded',
          severity: 'high',
          cleanerId: summary.cleanerId,
          message: `${summary.cleanerName} tiene ${summary.overtimeHours.toFixed(1)} horas extra esta semana`,
          actionRequired: true,
          suggestedAction: 'Considerar redistribuir carga de trabajo'
        });
      }

      if (summary.status === 'deficit' || summary.status === 'critical-deficit') {
        alerts.push({
          type: 'hours_deficit',
          severity: summary.status === 'critical-deficit' ? 'critical' : 'medium',
          cleanerId: summary.cleanerId,
          message: `${summary.cleanerName} está por debajo de sus horas contractuales (${summary.remainingHours.toFixed(1)}h restantes)`,
          actionRequired: true,
          suggestedAction: 'Asignar más tareas o revisar disponibilidad'
        });
      }

      if (summary.percentageComplete > 130) {
        alerts.push({
          type: 'hours_exceeded',
          severity: 'critical',
          cleanerId: summary.cleanerId,
          message: `${summary.cleanerName} excede significativamente sus horas (${summary.percentageComplete.toFixed(0)}%)`,
          actionRequired: true,
          suggestedAction: 'Redistribuir tareas urgentemente'
        });
      }
    });

    return { workersOverview, alerts };
  }, [workloadData]);

  const criticalAlerts = alerts.filter(alert => alert.severity === 'critical');
  const highAlerts = alerts.filter(alert => alert.severity === 'high');
  const mediumAlerts = alerts.filter(alert => alert.severity === 'medium');
  const lowAlerts = alerts.filter(alert => alert.severity === 'low');

  const getWorkerOverview = (cleanerId: string): WorkerHoursOverview | undefined => {
    return workersOverview.find(overview => overview.cleanerId === cleanerId);
  };

  const getWorkerAlerts = (cleanerId: string): WorkerAlert[] => {
    return alerts.filter(alert => alert.cleanerId === cleanerId);
  };

  return {
    workersOverview,
    alerts,
    criticalAlerts,
    highAlerts,
    mediumAlerts,
    lowAlerts,
    getWorkerOverview,
    getWorkerAlerts,
    totalAlerts: alerts.length,
    actionRequiredCount: alerts.filter(alert => alert.actionRequired).length,
    isLoading
  };
};

// Hook específico para obtener datos de un trabajador individual
export const useWorkerHoursOverview = (cleanerId: string) => {
  const { getWorkerOverview, getWorkerAlerts, isLoading } = useWorkerAlerts();
  
  return useMemo(() => ({
    overview: getWorkerOverview(cleanerId),
    alerts: getWorkerAlerts(cleanerId),
    isLoading
  }), [cleanerId, getWorkerOverview, getWorkerAlerts, isLoading]);
};
