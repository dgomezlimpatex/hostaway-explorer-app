import { Cleaner, Task } from '@/types/calendar';
import { getTaskAssignedCleanerIds } from '@/utils/taskAssignments';
import { getTaskPlannedDurationMinutes } from '@/utils/cleaning-planning/capacity';

export interface PlanningWeeklyContract {
  cleanerId: string;
  contractHoursPerWeek: number;
  isActive: boolean;
}

export type PlanningWeeklyWorkloadStatus = 'on-track' | 'near-limit' | 'overtime' | 'no-contract';

export interface PlanningWeeklyWorkload {
  cleanerId: string;
  cleanerName: string;
  assignedHours: number;
  contractHours: number;
  remainingHours: number;
  overtimeHours: number;
  assignedTaskCount: number;
  missingDurationTaskCount: number;
  status: PlanningWeeklyWorkloadStatus;
}

/**
 * Builds the compact weekly staffing summary used by daily planning.
 * A multi-worker task consumes its property duration divided by its assigned workers.
 */
export const buildPlanningWeeklyWorkload = (
  tasks: Task[],
  cleaners: Cleaner[],
  // Kept for compatibility with older callers; historical contracts never affect hours.
  _contracts: PlanningWeeklyContract[] = [],
): PlanningWeeklyWorkload[] => {
  const minutesByCleaner = new Map<string, number>();
  const taskCountByCleaner = new Map<string, number>();
  const missingDurationByCleaner = new Map<string, number>();

  tasks
    .filter((task) => task.status !== 'cancelled' && task.status !== 'canceled')
    .forEach((task) => {
      const cleanerIds = getTaskAssignedCleanerIds(task);
      if (cleanerIds.length === 0) return;

      const duration = getTaskPlannedDurationMinutes(task).minutes;
      const workerMinutes = duration > 0 ? Math.ceil(duration / cleanerIds.length) : 0;

      cleanerIds.forEach((cleanerId) => {
        minutesByCleaner.set(cleanerId, (minutesByCleaner.get(cleanerId) || 0) + workerMinutes);
        taskCountByCleaner.set(cleanerId, (taskCountByCleaner.get(cleanerId) || 0) + 1);
        if (duration === 0) {
          missingDurationByCleaner.set(cleanerId, (missingDurationByCleaner.get(cleanerId) || 0) + 1);
        }
      });
    });

  return cleaners
    .filter((cleaner) => cleaner.isActive)
    .map((cleaner) => {
      const resolvedContractHours = Number(cleaner.contractHoursPerWeek ?? 0);
      const assignedHours = (minutesByCleaner.get(cleaner.id) || 0) / 60;
      const remainingHours = Math.max(0, resolvedContractHours - assignedHours);
      const overtimeHours = Math.max(0, assignedHours - resolvedContractHours);
      const percentage = resolvedContractHours > 0 ? (assignedHours / resolvedContractHours) * 100 : 0;

      return {
        cleanerId: cleaner.id,
        cleanerName: cleaner.name,
        assignedHours,
        contractHours: resolvedContractHours,
        remainingHours,
        overtimeHours,
        assignedTaskCount: taskCountByCleaner.get(cleaner.id) || 0,
        missingDurationTaskCount: missingDurationByCleaner.get(cleaner.id) || 0,
        status: resolvedContractHours <= 0 ? 'no-contract' : percentage > 100 ? 'overtime' : percentage >= 85 ? 'near-limit' : 'on-track',
      };
    })
    .sort((left, right) => right.assignedHours - left.assignedHours || left.cleanerName.localeCompare(right.cleanerName, 'es'));
};
