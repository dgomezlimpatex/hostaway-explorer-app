import { ViewType } from '@/types/calendar';
import { formatMadridDate } from '@/utils/date';

export type TaskDateRange = {
  dateFrom: string;
  dateTo: string;
};

const parseCivilDate = (value: string): Date => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
};

const formatCivilDate = (value: Date): string => value.toISOString().slice(0, 10);

export const getTaskWindowRange = (currentDate: Date, dayCount: number): TaskDateRange => {
  const dateFrom = parseCivilDate(formatMadridDate(currentDate));
  const dateTo = new Date(dateFrom);
  dateTo.setUTCDate(dateTo.getUTCDate() + Math.max(1, Math.floor(dayCount)) - 1);

  return {
    dateFrom: formatCivilDate(dateFrom),
    dateTo: formatCivilDate(dateTo),
  };
};

export const getTaskDateRange = (currentDate: Date, currentView: ViewType): TaskDateRange => {
  // Convert the instant to Madrid's civil date first, then perform calendar
  // arithmetic with UTC methods. This keeps the result independent from the
  // browser/process timezone and from daylight-saving transitions.
  const madridCivilDate = parseCivilDate(formatMadridDate(currentDate));
  const dateFrom = new Date(madridCivilDate);
  const dateTo = new Date(madridCivilDate);

  if (currentView === 'three-day') {
    dateTo.setUTCDate(dateTo.getUTCDate() + 2);
  } else if (currentView === 'week') {
    const dayOfWeek = dateFrom.getUTCDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    dateFrom.setUTCDate(dateFrom.getUTCDate() + mondayOffset);
    dateTo.setTime(dateFrom.getTime());
    dateTo.setUTCDate(dateTo.getUTCDate() + 6);
  }

  return {
    dateFrom: formatCivilDate(dateFrom),
    dateTo: formatCivilDate(dateTo),
  };
};

export const filterTasksByDateRange = <T extends { date: string }>(
  tasks: readonly T[],
  { dateFrom, dateTo }: TaskDateRange,
): T[] => tasks.filter((task) => task.date >= dateFrom && task.date <= dateTo);

export const filterTasksByQueryRange = <T extends { date: string }>(
  tasks: readonly T[],
  currentDate: Date,
  currentView: ViewType,
): T[] => filterTasksByDateRange(tasks, getTaskDateRange(currentDate, currentView));
