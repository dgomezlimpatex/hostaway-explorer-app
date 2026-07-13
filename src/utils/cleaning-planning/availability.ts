import { Cleaner, Task } from '../../types/calendar';
import { CleanerCapacityMap, EffectiveWorkerAvailability } from '../../types/cleaningPlanning';
import { WorkerAbsence, WorkerFixedDayOff, WorkerMaintenanceCleaning } from '../../types/workerAbsence';
import { isPlannableTaskStatus } from '../cleaningPlanning';
import { getTaskAssignmentCleanerIds, getTaskWorkerPlannedDurationMinutes, getWindowDurationMinutes } from './capacity';

export interface WeeklyAvailabilityRow {
  cleaner_id: string;
  day_of_week: number;
  is_available: boolean;
  start_time: string | null;
  end_time: string | null;
}

const parseDateParts = (date: string): { year: number; month: number; day: number } | null => {
  const [year, month, day] = date.split('-').map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
};

const dateToUtcMidnight = (date: string): number => {
  const parts = parseDateParts(date);
  if (!parts) return Date.parse(`${date}T00:00:00Z`);
  return Date.UTC(parts.year, parts.month - 1, parts.day);
};

const formatUtcDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const dateToDayOfWeek = (date: string): number => new Date(dateToUtcMidnight(date)).getUTCDay();

const enumerateDates = (startDate: string, endDate: string): string[] => {
  const dates: string[] = [];
  let cursor = dateToUtcMidnight(startDate);
  const end = dateToUtcMidnight(endDate);
  const dayMs = 24 * 60 * 60 * 1000;

  while (cursor <= end) {
    dates.push(formatUtcDate(cursor));
    cursor += dayMs;
  }

  return dates;
};

const overlapsDate = (date: string, startDate: string, endDate: string): boolean => startDate <= date && endDate >= date;

const isExtraordinaryTask = (task: Task): boolean => task.type.toLowerCase().includes('extraordinario');

const extraordinaryWindowsForCleanerDate = (tasks: Task[], cleanerId: string, date: string) => tasks
  .filter((task) => task.date === date && isPlannableTaskStatus(task.status) && isExtraordinaryTask(task))
  .filter((task) => getTaskAssignmentCleanerIds(task).includes(cleanerId))
  .filter((task) => getWindowDurationMinutes(task.startTime, task.endTime) > 0)
  .map((task) => ({
    startTime: task.startTime,
    endTime: task.endTime,
    reason: `Servicio extraordinario: ${task.property || task.type}`,
  }));

const timeToMinutesValue = (time?: string | null): number | null => {
  if (!time) return null;
  const [rawHours, rawMinutes = '0'] = time.split(':');
  const hours = Number(rawHours);
  const minutes = Number(rawMinutes);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
};

const minutesToTimeValue = (minutes: number): string => {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)));
  const hours = Math.floor(clamped / 60).toString().padStart(2, '0');
  const minutePart = (clamped % 60).toString().padStart(2, '0');
  return `${hours}:${minutePart}`;
};

const assignedTaskWindowsForCleanerDate = (tasks: Task[], cleanerId: string, date: string) => tasks
  .filter((task) => task.date === date && isPlannableTaskStatus(task.status))
  .filter((task) => !isExtraordinaryTask(task))
  .filter((task) => getTaskAssignmentCleanerIds(task).includes(cleanerId))
  .flatMap((task) => {
    const startMinutes = timeToMinutesValue(task.startTime);
    const workerDurationMinutes = getTaskWorkerPlannedDurationMinutes(task);
    const fallbackDurationMinutes = getWindowDurationMinutes(task.startTime, task.endTime);
    const durationMinutes = workerDurationMinutes > 0 ? workerDurationMinutes : fallbackDurationMinutes;
    if (startMinutes === null || durationMinutes <= 0) return [];
    return [{
      startTime: task.startTime,
      endTime: minutesToTimeValue(startMinutes + durationMinutes),
      reason: `Tarea ya asignada: ${task.property || task.type}`,
    }];
  });

const assignedMinutesForCleanerDate = (tasks: Task[], cleanerId: string, date: string): number => tasks
  .filter((task) => task.date === date && isPlannableTaskStatus(task.status))
  .filter((task) => !isExtraordinaryTask(task))
  .filter((task) => getTaskAssignmentCleanerIds(task).includes(cleanerId))
  .reduce((total, task) => total + getTaskWorkerPlannedDurationMinutes(task), 0);

export const buildEffectiveAvailabilityForDate = ({
  cleaner,
  date,
  weeklyAvailability,
  absences = [],
  fixedDaysOff = [],
  maintenanceCleanings = [],
  assignedTasks = [],
  fallbackCapacityMinutes = 8 * 60,
}: {
  cleaner: Cleaner;
  date: string;
  weeklyAvailability?: WeeklyAvailabilityRow[];
  absences?: WorkerAbsence[];
  fixedDaysOff?: WorkerFixedDayOff[];
  maintenanceCleanings?: WorkerMaintenanceCleaning[];
  assignedTasks?: Task[];
  fallbackCapacityMinutes?: number;
}): EffectiveWorkerAvailability => {
  const dayOfWeek = dateToDayOfWeek(date);
  const cleanerWeeklyAvailability = weeklyAvailability?.find((row) => row.cleaner_id === cleaner.id && row.day_of_week === dayOfWeek);
  const cleanerFixedDayOff = fixedDaysOff.find((row) => row.cleanerId === cleaner.id && row.isActive && row.dayOfWeek === dayOfWeek);
  const dayAbsences = absences.filter((absence) => absence.cleanerId === cleaner.id && overlapsDate(date, absence.startDate, absence.endDate));
  const dayMaintenance = maintenanceCleanings.filter((maintenance) => maintenance.cleanerId === cleaner.id && maintenance.isActive && maintenance.daysOfWeek.includes(dayOfWeek));
  const extraordinaryWindows = extraordinaryWindowsForCleanerDate(assignedTasks, cleaner.id, date);
  const assignedTaskWindows = assignedTaskWindowsForCleanerDate(assignedTasks, cleaner.id, date);
  const assignedMinutes = assignedMinutesForCleanerDate(assignedTasks, cleaner.id, date);

  if (cleanerFixedDayOff) {
    return {
      cleanerId: cleaner.id,
      date,
      isAvailable: false,
      source: 'fixed_day_off',
      availableWindows: [],
      blockedWindows: [{ reason: 'Día libre fijo' }],
      availableMinutes: 0,
      assignedMinutes,
      remainingMinutes: 0,
    };
  }

  const fullDayAbsence = dayAbsences.find((absence) => !absence.startTime || !absence.endTime);
  if (fullDayAbsence) {
    return {
      cleanerId: cleaner.id,
      date,
      isAvailable: false,
      source: 'absence',
      availableWindows: [],
      blockedWindows: [{ reason: fullDayAbsence.notes || 'Ausencia de jornada completa' }],
      availableMinutes: 0,
      assignedMinutes,
      remainingMinutes: 0,
      notes: fullDayAbsence.notes || undefined,
    };
  }

  const baseStartTime = cleanerWeeklyAvailability?.start_time || '09:00';
  const baseEndTime = cleanerWeeklyAvailability?.end_time || '17:00';
  const baseMinutes = cleanerWeeklyAvailability
    ? (cleanerWeeklyAvailability.is_available ? getWindowDurationMinutes(baseStartTime, baseEndTime) : 0)
    : fallbackCapacityMinutes;

  const unavailableWindows = [
    ...dayAbsences
      .filter((absence) => absence.startTime && absence.endTime)
      .map((absence) => ({
        startTime: absence.startTime || undefined,
        endTime: absence.endTime || undefined,
        reason: absence.notes || 'Ausencia parcial',
      })),
    ...dayMaintenance.map((maintenance) => ({
      startTime: maintenance.startTime,
      endTime: maintenance.endTime,
      reason: maintenance.locationName ? `Mantenimiento: ${maintenance.locationName}` : 'Mantenimiento fijo',
    })),
    ...extraordinaryWindows,
  ];
  const blockedWindows = [...unavailableWindows, ...assignedTaskWindows];

  const blockedMinutes = unavailableWindows.reduce((total, window) => total + getWindowDurationMinutes(window.startTime, window.endTime), 0);
  const availableMinutes = Math.max(0, baseMinutes - blockedMinutes);
  const remainingMinutes = Math.max(0, availableMinutes - assignedMinutes);

  return {
    cleanerId: cleaner.id,
    date,
    isAvailable: availableMinutes > 0,
    source: cleanerWeeklyAvailability ? 'weekly' : 'contract_fallback',
    availableWindows: availableMinutes > 0 ? [{ startTime: baseStartTime, endTime: baseEndTime }] : [],
    blockedWindows,
    availableMinutes,
    assignedMinutes,
    remainingMinutes,
    notes: cleanerWeeklyAvailability ? undefined : 'Capacidad estimada por fallback hasta configurar disponibilidad real.',
  };
};

export const buildEffectiveAvailabilityRange = ({
  cleaners,
  startDate,
  endDate,
  weeklyAvailability = [],
  absences = [],
  fixedDaysOff = [],
  maintenanceCleanings = [],
  assignedTasks = [],
  fallbackCapacityMinutes = 8 * 60,
}: {
  cleaners: Cleaner[];
  startDate: string;
  endDate: string;
  weeklyAvailability?: WeeklyAvailabilityRow[];
  absences?: WorkerAbsence[];
  fixedDaysOff?: WorkerFixedDayOff[];
  maintenanceCleanings?: WorkerMaintenanceCleaning[];
  assignedTasks?: Task[];
  fallbackCapacityMinutes?: number;
}): EffectiveWorkerAvailability[] => {
  const dates = enumerateDates(startDate, endDate);
  return cleaners.flatMap((cleaner) => dates.map((date) => buildEffectiveAvailabilityForDate({
    cleaner,
    date,
    weeklyAvailability,
    absences,
    fixedDaysOff,
    maintenanceCleanings,
    assignedTasks,
    fallbackCapacityMinutes,
  })));
};

export const buildCapacityMapFromAvailability = (availabilities: EffectiveWorkerAvailability[]): CleanerCapacityMap => availabilities
  .reduce<CleanerCapacityMap>((capacityByCleaner, availability) => {
    capacityByCleaner[availability.cleanerId] = (capacityByCleaner[availability.cleanerId] || 0) + availability.availableMinutes;
    return capacityByCleaner;
  }, {});
