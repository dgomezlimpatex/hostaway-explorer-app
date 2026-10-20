import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Task } from '@/types/calendar';
import { formatMadridDate } from '@/utils/date';
import { getMadridToday } from '@/utils/madridCalendar';
import { civilDateToLocalDate } from './multiDayCalendar';

const toMinutes = (time: string) => {
  const [h, m] = (time || '').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Work queue order of "Tareas sin asignar": date, start time, then property name. */
export const sortUnassignedTasks = <T extends Pick<Task, 'date' | 'startTime' | 'property'>>(tasks: T[]) =>
  [...tasks].sort((a, b) =>
    a.date.localeCompare(b.date) ||
    toMinutes(a.startTime) - toMinutes(b.startTime) ||
    a.property.localeCompare(b.property, 'es', { sensitivity: 'base' })
  );

/**
 * Copy of a task for "Duplicar": same service, date and times, but without
 * people, reports or derived status. Creating it never assigns anyone or
 * sends assignment notices; the copy appears in "Tareas sin asignar".
 */
export const buildUnassignedDuplicate = (task: Task): Omit<Task, 'id' | 'created_at' | 'updated_at'> => {
  const {
    id: _id,
    created_at: _createdAt,
    updated_at: _updatedAt,
    cleaner: _cleaner,
    cleanerId: _cleanerId,
    assignments: _assignments,
    assignmentCount: _assignmentCount,
    calendarStatus: _calendarStatus,
    originalTaskId: _originalTaskId,
    isRecurringInstance: _isRecurringInstance,
    ...rest
  } = task as Task & { created_at?: string; updated_at?: string };
  return { ...rest, status: 'pending' };
};

/** Label next to the service count: "hoy" only when the day shown is today. */
export const getFooterPeriodLabel = (currentDate: Date, isMultiDay: boolean, today = getMadridToday()) => {
  if (isMultiDay) return 'en el periodo';
  const day = formatMadridDate(currentDate);
  if (day === today) return 'hoy';
  return `el ${format(civilDateToLocalDate(day), "EEE d/MM", { locale: es })}`;
};
