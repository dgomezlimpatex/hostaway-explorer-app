import { eachDayOfInterval, getDay } from 'date-fns';
import type { Cleaner, Task } from '@/types/calendar';
import type { WorkerMaintenanceCleaning } from '@/types/workerAbsence';
import { buildPlanningWeeklyWorkload } from '@/utils/planningWeeklyWorkload';
import { getWindowDurationMinutes } from '@/utils/cleaning-planning/capacity';

export type DashboardHoursStatus = 'covered' | 'shortfall' | 'critical' | 'no-contract' | 'partial';

export const dashboardHoursStatus = (assigned: number, contract: number): DashboardHoursStatus => {
  if (contract <= 0) return 'no-contract';
  if (assigned >= contract) return 'covered';
  return assigned >= contract * 0.75 ? 'shortfall' : 'critical';
};

export const buildDashboardWeeklyWorkload = (
  tasks: Task[],
  cleaners: Cleaner[],
  maintenance: WorkerMaintenanceCleaning[],
  startDate: string,
  endDate: string,
) => {
  const days = eachDayOfInterval({ start: new Date(`${startDate}T12:00:00`), end: new Date(`${endDate}T12:00:00`) });
  const rows = buildPlanningWeeklyWorkload(tasks.filter(task => task.date >= startDate && task.date <= endDate), cleaners);
  return rows.map(row => {
    let maintenanceMinutes = 0;
    let missingMaintenanceCount = 0;
    for (const cleaning of maintenance) {
      if (cleaning.cleanerId !== row.cleanerId || !cleaning.isActive || cleaning.scheduleType === 'unavailability') continue;
      const occurrences = days.filter(day => cleaning.daysOfWeek.includes(getDay(day))).length;
      const duration = getWindowDurationMinutes(cleaning.startTime, cleaning.endTime);
      maintenanceMinutes += duration * occurrences;
      if (!duration && occurrences) missingMaintenanceCount += occurrences;
    }
    const assignedHours = row.assignedHours + maintenanceMinutes / 60;
    const isPartial = row.missingDurationTaskCount > 0 || missingMaintenanceCount > 0;
    return { ...row, assignedHours, taskHours: row.assignedHours, maintenanceHours: maintenanceMinutes / 60,
      percentage: row.contractHours > 0 ? assignedHours / row.contractHours * 100 : 0,
      dashboardStatus: isPartial ? 'partial' as const : dashboardHoursStatus(assignedHours, row.contractHours),
      isPartial };
  });
};
