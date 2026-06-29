import { Cleaner, Task } from '../../types/calendar';
import { CleanerCapacityMap, EffectiveWorkerAvailability } from '../../types/cleaningPlanning';
import { WorkerAbsence, WorkerFixedDayOff, WorkerMaintenanceCleaning } from '../../types/workerAbsence';
import { getTaskPlannedDurationMinutes, getWindowDurationMinutes } from './capacity';

export interface WeeklyAvailabilityRow {
  cleaner_id: string;
  day_of_week: number;
  is_available: boolean;
  start_time: string | null;
  end_time: string | null;
}

const dateToDayOfWeek = (date: string): number => new Date(`${date}T00:00:00`).getDay();

const enumerateDates = (startDate: string, endDate: string): string[] => {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
};

const overlapsDate = (date: string, startDate: string, endDate: string): boolean => startDate <= date && endDate >= date;

const assignedMinutesForCleanerDate = (tasks: Task[], cleanerId: string, date: string): number => tasks
  .filter((task) => task.cleanerId === cleanerId && task.date === date && task.status !== 'completed')
  .reduce((total, task) => total + getTaskPlannedDurationMinutes(task).minutes, 0);

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

  const blockedWindows = [
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
  ];

  const blockedMinutes = blockedWindows.reduce((total, window) => total + getWindowDurationMinutes(window.startTime, window.endTime), 0);
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
