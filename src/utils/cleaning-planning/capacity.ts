import { Task } from '../../types/calendar';

const timeToMinutesValue = (time?: string | null): number | null => {
  if (!time) return null;
  const [rawHours, rawMinutes = '0'] = time.split(':');
  const hours = Number(rawHours);
  const minutes = Number(rawMinutes);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
};

export const clampNonNegativeMinutes = (minutes: number): number => Math.max(0, Math.round(minutes));

export const getWindowDurationMinutes = (startTime?: string | null, endTime?: string | null): number => {
  const start = timeToMinutesValue(startTime);
  const end = timeToMinutesValue(endTime);
  if (start === null || end === null || end <= start) return 0;
  return end - start;
};

export const getTaskPlannedDurationMinutes = (
  task: Pick<Task, 'duration' | 'propertyDurationMinutes' | 'startTime' | 'endTime'>,
): { minutes: number; source: 'property' | 'task' | 'time_window' | 'missing' } => {
  if (typeof task.propertyDurationMinutes === 'number' && Number.isFinite(task.propertyDurationMinutes) && task.propertyDurationMinutes > 0) {
    return { minutes: Math.round(task.propertyDurationMinutes), source: 'property' };
  }

  if (typeof task.duration === 'number' && Number.isFinite(task.duration) && task.duration > 0) {
    return { minutes: Math.round(task.duration), source: 'task' };
  }

  const windowMinutes = getWindowDurationMinutes(task.startTime, task.endTime);
  if (windowMinutes > 0) {
    return { minutes: windowMinutes, source: 'time_window' };
  }

  return { minutes: 0, source: 'missing' };
};

export const sumTaskDurations = (tasks: Pick<Task, 'duration' | 'propertyDurationMinutes' | 'startTime' | 'endTime'>[]): number => tasks
  .reduce((total, task) => total + getTaskPlannedDurationMinutes(task).minutes, 0);

export const getTaskAssignmentCleanerIds = (
  task: Pick<Task, 'cleanerId' | 'assignments'>,
): string[] => {
  const assignmentIds = (task.assignments || [])
    .map((assignment) => assignment.cleaner_id)
    .filter(Boolean);
  const ids = assignmentIds.length > 0 ? assignmentIds : ([task.cleanerId].filter(Boolean) as string[]);
  return Array.from(new Set(ids));
};

export const getTaskWorkerCount = (
  task: Pick<Task, 'cleanerId' | 'assignments' | 'requiredCleaners'>,
): number => {
  const assignedCount = getTaskAssignmentCleanerIds(task).length;
  if (assignedCount > 0) return assignedCount;
  const required = Number(task.requiredCleaners || 0);
  return Number.isFinite(required) && required > 0 ? Math.ceil(required) : 1;
};

export const getTaskWorkerPlannedDurationMinutes = (
  task: Pick<Task, 'duration' | 'propertyDurationMinutes' | 'startTime' | 'endTime' | 'cleanerId' | 'assignments' | 'requiredCleaners'>,
): number => {
  const totalMinutes = getTaskPlannedDurationMinutes(task).minutes;
  const workerCount = Math.max(1, getTaskWorkerCount(task));
  return Math.ceil(totalMinutes / workerCount);
};
