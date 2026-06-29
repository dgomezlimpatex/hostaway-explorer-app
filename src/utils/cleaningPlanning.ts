import { Cleaner, Task } from '@/types/calendar';
import {
  CleanerCapacityMap,
  CleanerPlanningDay,
  CleaningPlanningModel,
  CleaningPlanningSummary,
  CleaningPlanningTask,
  PlanningTaskRisk,
} from '@/types/cleaningPlanning';

export const DEFAULT_DAILY_CAPACITY_MINUTES = 8 * 60;

export const timeToMinutes = (time?: string | null): number | null => {
  if (!time) return null;
  const [rawHours, rawMinutes = '0'] = time.split(':');
  const hours = Number(rawHours);
  const minutes = Number(rawMinutes);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return hours * 60 + minutes;
};

export const getTaskDurationMinutes = (task: Pick<Task, 'duration' | 'startTime' | 'endTime'>): number => {
  if (typeof task.duration === 'number' && Number.isFinite(task.duration) && task.duration > 0) {
    return task.duration;
  }

  const start = timeToMinutes(task.startTime);
  const end = timeToMinutes(task.endTime);

  if (start === null || end === null || end <= start) return 0;
  return end - start;
};

export const hasMissingTime = (task: Pick<Task, 'startTime' | 'endTime' | 'duration'>): boolean => {
  const start = timeToMinutes(task.startTime);
  const end = timeToMinutes(task.endTime);
  return start === null || end === null || end <= start || getTaskDurationMinutes(task) <= 0;
};

export const tasksOverlap = (a: Pick<Task, 'date' | 'startTime' | 'endTime'>, b: Pick<Task, 'date' | 'startTime' | 'endTime'>): boolean => {
  if (a.date !== b.date) return false;

  const aStart = timeToMinutes(a.startTime);
  const aEnd = timeToMinutes(a.endTime);
  const bStart = timeToMinutes(b.startTime);
  const bEnd = timeToMinutes(b.endTime);

  if (aStart === null || aEnd === null || bStart === null || bEnd === null) return false;
  if (aEnd <= aStart || bEnd <= bStart) return false;

  return aStart < bEnd && bStart < aEnd;
};

const uniqueRisks = (risks: PlanningTaskRisk[]): PlanningTaskRisk[] => Array.from(new Set(risks));

export const decoratePlanningTask = (task: Task, extraRisks: PlanningTaskRisk[] = []): CleaningPlanningTask => {
  const riskFlags: PlanningTaskRisk[] = [...extraRisks];

  if (!task.cleanerId) riskFlags.push('unassigned');
  if (hasMissingTime(task)) riskFlags.push('missing-time');

  return {
    ...task,
    durationMinutes: getTaskDurationMinutes(task),
    riskFlags: uniqueRisks(riskFlags),
  };
};

const detectOverlapTaskIds = (tasks: Task[]): Set<string> => {
  const overlapIds = new Set<string>();
  const ordered = [...tasks].sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));

  for (let i = 0; i < ordered.length; i += 1) {
    for (let j = i + 1; j < ordered.length; j += 1) {
      if (ordered[i].date !== ordered[j].date) break;
      if (tasksOverlap(ordered[i], ordered[j])) {
        overlapIds.add(ordered[i].id);
        overlapIds.add(ordered[j].id);
      }
    }
  }

  return overlapIds;
};

export const buildCleanerPlanningDays = (
  tasks: Task[],
  cleaners: Cleaner[],
  capacityByCleaner: CleanerCapacityMap = {},
): CleanerPlanningDay[] => {
  const tasksByCleaner = new Map<string, Task[]>();

  tasks.forEach((task) => {
    if (!task.cleanerId) return;
    const cleanerTasks = tasksByCleaner.get(task.cleanerId) || [];
    cleanerTasks.push(task);
    tasksByCleaner.set(task.cleanerId, cleanerTasks);
  });

  return cleaners
    .filter((cleaner) => cleaner.isActive || tasksByCleaner.has(cleaner.id))
    .map((cleaner) => {
      const cleanerTasks = tasksByCleaner.get(cleaner.id) || [];
      const overlapIds = detectOverlapTaskIds(cleanerTasks);
      const capacityMinutes = capacityByCleaner[cleaner.id] ?? DEFAULT_DAILY_CAPACITY_MINUTES;
      const plannedMinutes = cleanerTasks.reduce((total, task) => total + getTaskDurationMinutes(task), 0);
      const isOvercapacity = capacityMinutes > 0 && plannedMinutes > capacityMinutes;
      const tasksWithRisks = cleanerTasks.map((task) => decoratePlanningTask(task, [
        ...(overlapIds.has(task.id) ? ['overlap' as const] : []),
        ...(isOvercapacity ? ['overcapacity' as const] : []),
      ]));
      const riskFlags = uniqueRisks(tasksWithRisks.flatMap((task) => task.riskFlags));

      return {
        cleanerId: cleaner.id,
        cleanerName: cleaner.name,
        cleaner,
        tasks: tasksWithRisks,
        plannedMinutes,
        capacityMinutes,
        utilizationPercent: capacityMinutes > 0 ? Math.round((plannedMinutes / capacityMinutes) * 100) : 0,
        riskFlags,
      };
    })
    .sort((a, b) => {
      if (b.riskFlags.length !== a.riskFlags.length) return b.riskFlags.length - a.riskFlags.length;
      return b.plannedMinutes - a.plannedMinutes;
    });
};

export const buildPlanningSummary = (
  cleanerDays: CleanerPlanningDay[],
  unassignedTasks: CleaningPlanningTask[],
): CleaningPlanningSummary => {
  const assignedTasks = cleanerDays.flatMap((day) => day.tasks);
  const allTasks = [...assignedTasks, ...unassignedTasks];
  const plannedMinutes = cleanerDays.reduce((total, day) => total + day.plannedMinutes, 0);
  const capacityMinutes = cleanerDays.reduce((total, day) => total + day.capacityMinutes, 0);

  return {
    totalTasks: allTasks.length,
    assignedTasks: assignedTasks.length,
    unassignedTasks: unassignedTasks.length,
    completedTasks: allTasks.filter((task) => task.status === 'completed').length,
    conflictTasks: allTasks.filter((task) => task.riskFlags.includes('overlap') || task.riskFlags.includes('missing-time')).length,
    overcapacityCleaners: cleanerDays.filter((day) => day.riskFlags.includes('overcapacity')).length,
    plannedMinutes,
    capacityMinutes,
    utilizationPercent: capacityMinutes > 0 ? Math.round((plannedMinutes / capacityMinutes) * 100) : 0,
  };
};

export const buildCleaningPlanningModel = (
  tasks: Task[],
  cleaners: Cleaner[],
  capacityByCleaner: CleanerCapacityMap,
  startDate: string,
  endDate: string,
): CleaningPlanningModel => {
  const activeTasks = tasks.filter((task) => task.status !== 'completed');
  const cleanerDays = buildCleanerPlanningDays(activeTasks, cleaners, capacityByCleaner);
  const unassignedTasks = activeTasks
    .filter((task) => !task.cleanerId)
    .map((task) => decoratePlanningTask(task))
    .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));

  return {
    startDate,
    endDate,
    cleaners: cleanerDays,
    unassignedTasks,
    summary: buildPlanningSummary(cleanerDays, unassignedTasks),
  };
};

export const minutesToHoursLabel = (minutes: number): string => `${(minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1)} h`;
