import type { CleanerLoad, PlanningV2CleanerRef, PlanningV2TaskRef } from '../../types/planningV2';

export const DEFAULT_CLEANER_DAY_CAPACITY_MINUTES = 8 * 60;

export function getTaskCleanerIds(task: PlanningV2TaskRef): string[] {
  return Array.from(new Set(task.cleanerIds.filter(Boolean)));
}

export function buildCleanerCapacity(
  cleaners: PlanningV2CleanerRef[],
  assignedTasks: PlanningV2TaskRef[],
  defaultCapacityMinutes = DEFAULT_CLEANER_DAY_CAPACITY_MINUTES,
): Record<string, CleanerLoad> {
  const loads = cleaners.reduce<Record<string, CleanerLoad>>((acc, cleaner) => {
    const capacityMinutes = cleaner.maxMinutesPerDay ?? defaultCapacityMinutes;
    acc[cleaner.id] = {
      cleanerId: cleaner.id,
      taskIds: [],
      assignedMinutes: 0,
      assignedTaskCount: 0,
      multiPersonTaskCount: 0,
      capacityMinutes,
      remainingMinutes: capacityMinutes,
      utilization: 0,
    };
    return acc;
  }, {});

  for (const task of assignedTasks) {
    const cleanerIds = getTaskCleanerIds(task);
    const isMultiPerson = (task.requiredCleaners ?? cleanerIds.length) > 1 || cleanerIds.length > 1;

    for (const cleanerId of cleanerIds) {
      if (!loads[cleanerId]) {
        loads[cleanerId] = {
          cleanerId,
          taskIds: [],
          assignedMinutes: 0,
          assignedTaskCount: 0,
          multiPersonTaskCount: 0,
          capacityMinutes: defaultCapacityMinutes,
          remainingMinutes: defaultCapacityMinutes,
          utilization: 0,
        };
      }

      const load = loads[cleanerId];
      load.taskIds.push(task.id);
      load.assignedMinutes += task.durationMinutes;
      load.assignedTaskCount += 1;
      if (isMultiPerson) load.multiPersonTaskCount += 1;
    }
  }

  for (const load of Object.values(loads)) {
    load.remainingMinutes = load.capacityMinutes - load.assignedMinutes;
    load.utilization = load.capacityMinutes > 0 ? load.assignedMinutes / load.capacityMinutes : 1;
  }

  return loads;
}

export function projectCleanerLoad(load: CleanerLoad, taskId: string, durationMinutes: number, isMultiPersonTask = false): CleanerLoad {
  const assignedMinutes = load.assignedMinutes + durationMinutes;
  const assignedTaskCount = load.assignedTaskCount + 1;
  const multiPersonTaskCount = load.multiPersonTaskCount + (isMultiPersonTask ? 1 : 0);

  return {
    ...load,
    taskIds: [...load.taskIds, taskId],
    assignedMinutes,
    assignedTaskCount,
    multiPersonTaskCount,
    remainingMinutes: load.capacityMinutes - assignedMinutes,
    utilization: load.capacityMinutes > 0 ? assignedMinutes / load.capacityMinutes : 1,
  };
}

export function requiredCleanerCountForProperty(property: { isLargeHome?: boolean; requiredCleaners?: number }): number {
  if (property.requiredCleaners && property.requiredCleaners > 0) {
    return Math.min(3, Math.max(1, Math.ceil(property.requiredCleaners)));
  }

  return property.isLargeHome ? 2 : 1;
}
