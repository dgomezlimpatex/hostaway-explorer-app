import { useMemo } from 'react';
import { useCleaners } from './useCleaners';
import { useTimeLogs } from './useTimeLogs';
import { useWorkerContracts } from './useWorkerContracts';
import { WorkerAlert, WorkerHoursOverview } from '@/types/calendar';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

export const useWorkerAlerts = () => {
  const { cleaners } = useCleaners();
  const { data: contracts = [] } = useWorkerContracts();
  
  // Get current week and month date ranges
  const now = new Date();
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');

  // Calculate worker hours overview and alerts
  const { workersOverview, alerts } = useMemo(() => {
    const workersOverview: WorkerHoursOverview[] = [];
    const alerts: WorkerAlert[] = [];

    cleaners.forEach(cleaner => {
      const contract = contracts.find(c => c.cleanerId === cleaner.id && c.isActive);
      if (!contract) return;

      // For now, we'll simulate the data until we have actual time logs
      // TODO: Replace with actual time log calculations
      const contractHours = contract.contractHoursPerWeek;
      const workedHours = Math.random() * contractHours * 1.2; // Simulate worked hours
      const remainingHours = Math.max(0, contractHours - workedHours);
      const overtimeHours = Math.max(0, workedHours - contractHours);
      const efficiencyRate = (workedHours / contractHours) * 100;
      
      const weeklyProjection = workedHours * (7 / new Date().getDay() || 7);
      const monthlyProjection = workedHours * (30 / new Date().getDate());

      const overview: WorkerHoursOverview = {
        cleanerId: cleaner.id,
        contractHours,
        workedHours,
        remainingHours,
        overtimeHours,
        efficiencyRate,
        weeklyProjection,
        monthlyProjection
      };

      workersOverview.push(overview);

      // Generate alerts based on conditions
      if (overtimeHours > 5) {
        alerts.push({
          type: 'hours_exceeded',
          severity: 'high',
          cleanerId: cleaner.id,
          message: `${cleaner.name} tiene ${overtimeHours.toFixed(1)} horas extra esta semana`,
          actionRequired: true,
          suggestedAction: 'Considerar redistribuir carga de trabajo'
        });
      }

      if (workedHours < contractHours * 0.8) {
        alerts.push({
          type: 'hours_deficit',
          severity: 'medium',
          cleanerId: cleaner.id,
          message: `${cleaner.name} está por debajo de sus horas contractuales`,
          actionRequired: true,
          suggestedAction: 'Asignar más tareas o revisar disponibilidad'
        });
      }

      if (weeklyProjection > contractHours * 1.3) {
        alerts.push({
          type: 'hours_exceeded',
          severity: 'critical',
          cleanerId: cleaner.id,
          message: `${cleaner.name} podría exceder significativamente sus horas esta semana`,
          actionRequired: true,
          suggestedAction: 'Redistribuir tareas urgentemente'
        });
      }
    });

    return { workersOverview, alerts };
  }, [cleaners, contracts]);

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
    actionRequiredCount: alerts.filter(alert => alert.actionRequired).length
  };
};

// Hook específico para obtener datos de un trabajador individual
export const useWorkerHoursOverview = (cleanerId: string) => {
  const { getWorkerOverview, getWorkerAlerts } = useWorkerAlerts();
  
  return useMemo(() => ({
    overview: getWorkerOverview(cleanerId),
    alerts: getWorkerAlerts(cleanerId)
  }), [cleanerId, getWorkerOverview, getWorkerAlerts]);
};