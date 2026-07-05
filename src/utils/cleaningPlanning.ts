import { Cleaner, Task } from '@/types/calendar';
import {
  CleanerCapacityMap,
  CleanerPlanningDay,
  CleaningPlanningModel,
  CleaningPlanningSummary,
  CleaningPlanningTask,
  PlanningTaskRisk,
} from '@/types/cleaningPlanning';
import { getTaskAssignmentCleanerIds, getTaskPlannedDurationMinutes, getTaskWorkerPlannedDurationMinutes } from './cleaning-planning/capacity';

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

export const getTaskDurationMinutes = (task: Pick<Task, 'duration' | 'propertyDurationMinutes' | 'startTime' | 'endTime'>): number => getTaskPlannedDurationMinutes(task).minutes;

export const hasMissingTime = (task: Pick<Task, 'startTime' | 'endTime' | 'duration' | 'propertyDurationMinutes'>): boolean => {
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

export const formatPlanningTime = (time?: string | null): string => {
  const minutes = timeToMinutes(time);
  if (minutes === null) return 'Sin hora';
  const hours = Math.floor(minutes / 60).toString().padStart(2, '0');
  const mins = (minutes % 60).toString().padStart(2, '0');
  return `${hours}:${mins}`;
};

export const formatTaskStatus = (status: string): string => {
  const labels: Record<string, string> = {
    pending: 'Pendiente',
    'in-progress': 'En curso',
    completed: 'Completada',
    cancelled: 'Cancelada',
    canceled: 'Cancelada',
    declined: 'Declinada',
    expired: 'Expirada',
  };
  return labels[status] || status;
};

export const PLANNABLE_TASK_STATUSES = new Set<string>(['pending', 'in-progress']);

export const isPlannableTaskStatus = (status?: string | null): boolean => PLANNABLE_TASK_STATUSES.has(status || '');

export const formatTaskType = (type: string): string => type
  .split('-')
  .filter(Boolean)
  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
  .join(' ');

export const inferTaskZone = (task: Pick<Task, 'address' | 'property'>): string => {
  const text = `${task.address || ''} ${task.property || ''}`.toLowerCase();
  if (/sanxenxo|pontevedra|portonovo|a lanzada|sangenjo/.test(text)) return 'Sanxenxo';
  if (/ourense|orense/.test(text)) return 'Ourense';
  if (/benidorm|alicante/.test(text)) return 'Benidorm';
  if (/perillo|oleiros|sada|betanzos|cambre|arteixo|coruña|coruna|a coruña/.test(text)) return 'A Coruña';
  if (/santiago/.test(text)) return 'Santiago';
  return 'Sin zona';
};

export const isOperationalCleaner = (cleaner: Cleaner): boolean => {
  const name = cleaner.name.trim().toLowerCase();
  return cleaner.isActive && name !== 'not count' && !name.includes('not count');
};

export const decoratePlanningTask = (task: Task, extraRisks: PlanningTaskRisk[] = []): CleaningPlanningTask => {
  const riskFlags: PlanningTaskRisk[] = [...extraRisks];
  const duration = getTaskPlannedDurationMinutes(task);

  if (!task.cleanerId) riskFlags.push('unassigned');
  if (hasMissingTime(task)) riskFlags.push('missing-time');
  if (duration.source === 'missing') riskFlags.push('missing-duration');

  return {
    ...task,
    durationMinutes: duration.minutes,
    durationSource: duration.source,
    riskFlags: uniqueRisks(riskFlags),
    zone: inferTaskZone(task),
    displayStatus: formatTaskStatus(task.status),
    displayType: formatTaskType(task.type),
    displayStartTime: formatPlanningTime(task.startTime),
    displayEndTime: formatPlanningTime(task.endTime),
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
    const cleanerIds = getTaskAssignmentCleanerIds(task);
    cleanerIds.forEach((cleanerId) => {
      const cleanerTasks = tasksByCleaner.get(cleanerId) || [];
      cleanerTasks.push(task);
      tasksByCleaner.set(cleanerId, cleanerTasks);
    });
  });

  return cleaners
    .filter((cleaner) => isOperationalCleaner(cleaner) || tasksByCleaner.has(cleaner.id))
    .map((cleaner) => {
      const cleanerTasks = tasksByCleaner.get(cleaner.id) || [];
      const overlapIds = detectOverlapTaskIds(cleanerTasks);
      const capacityMinutes = capacityByCleaner[cleaner.id] ?? DEFAULT_DAILY_CAPACITY_MINUTES;
      const plannedMinutes = cleanerTasks.reduce((total, task) => total + getTaskWorkerPlannedDurationMinutes(task), 0);
      const isOvercapacity = capacityMinutes > 0 && plannedMinutes > capacityMinutes;
      const tasksWithRisks = cleanerTasks.map((task) => ({
        ...decoratePlanningTask(task, [
          ...(overlapIds.has(task.id) ? ['overlap' as const] : []),
          ...(isOvercapacity ? ['overcapacity' as const] : []),
        ]),
        durationMinutes: getTaskWorkerPlannedDurationMinutes(task),
      }));
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
  const uniqueAssignedTasks = Array.from(new Map(assignedTasks.map((task) => [task.id, task])).values());
  const allTasks = [...uniqueAssignedTasks, ...unassignedTasks];
  const plannedMinutes = cleanerDays.reduce((total, day) => total + day.plannedMinutes, 0);
  const capacityMinutes = cleanerDays.reduce((total, day) => total + day.capacityMinutes, 0);

  return {
    totalTasks: allTasks.length,
    assignedTasks: uniqueAssignedTasks.length,
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
  const activeTasks = tasks.filter((task) => isPlannableTaskStatus(task.status));
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
