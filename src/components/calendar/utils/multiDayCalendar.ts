import { Cleaner, Task, ViewType } from '@/types/calendar';
import { getTaskDateRange } from '@/utils/taskQueryRange';
import { getEffectiveTaskEndTime } from '@/utils/taskPositioning';
import { isTaskAssignedToCleaner } from '@/utils/taskAssignments';

export interface CalendarDayTask {
  task: Task;
  /** Per-worker end time (shorter than task.endTime for shared tasks). */
  displayEndTime: string;
  hasOverlap: boolean;
}

export type CleanerDayCells = Record<string, Record<string, CalendarDayTask[]>>;

export type TaskOverlap = Task & { endTime: string };

export const isMultiDayView = (view: ViewType) => view !== 'day';

/** Civil dates (YYYY-MM-DD, Europe/Madrid) shown by the active view. */
export const getVisibleDays = (currentDate: Date, view: ViewType): string[] => {
  const { dateFrom, dateTo } = getTaskDateRange(currentDate, view);
  const days: string[] = [];
  const cursor = new Date(`${dateFrom}T12:00:00Z`);
  const end = new Date(`${dateTo}T12:00:00Z`);
  while (cursor <= end) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
};

/** Local-noon Date for a civil date, safe to format with date-fns. */
export const civilDateToLocalDate = (day: string) => {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date, 12);
};

const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const markOverlaps = (entries: CalendarDayTask[]) => {
  entries.forEach((entry, index) => {
    const start = toMinutes(entry.task.startTime);
    const end = toMinutes(entry.displayEndTime);
    entry.hasOverlap = entries.some((other, otherIndex) => {
      if (otherIndex === index) return false;
      return start < toMinutes(other.displayEndTime) && end > toMinutes(other.task.startTime);
    });
  });
  return entries;
};

/**
 * Groups the tasks of each cleaner by day, sorted by start time, flagging
 * tasks that overlap with another task of the same cleaner on the same day.
 */
export const buildCleanerDayCells = (
  tasks: Task[],
  cleaners: Cleaner[],
  days: string[],
  assignmentsMap?: Record<string, string[]>,
): CleanerDayCells => {
  const daySet = new Set(days);
  const cells: CleanerDayCells = {};

  cleaners.forEach((cleaner) => {
    const byDay: Record<string, CalendarDayTask[]> = {};
    days.forEach((day) => { byDay[day] = []; });

    tasks.forEach((task) => {
      if (!daySet.has(task.date)) return;
      if (!isTaskAssignedToCleaner(task, cleaner.id, cleaner.name)) return;
      byDay[task.date].push({
        task,
        displayEndTime: getEffectiveTaskEndTime(task, assignmentsMap),
        hasOverlap: false,
      });
    });

    days.forEach((day) => {
      byDay[day].sort((a, b) => toMinutes(a.task.startTime) - toMinutes(b.task.startTime));
      markOverlaps(byDay[day]);
    });
    cells[cleaner.id] = byDay;
  });

  return cells;
};

/**
 * Overlapping tasks per cleaner. Only tasks on the same date can conflict, so
 * a multi-day range never reports Monday and Tuesday tasks as overlapping.
 */
export const getOverlapsByCleaner = (
  tasks: Task[],
  cleaners: Cleaner[],
  assignmentsMap?: Record<string, string[]>,
): Record<string, TaskOverlap[]> => {
  const days = Array.from(new Set(tasks.map((task) => task.date))).sort();
  const cells = buildCleanerDayCells(tasks, cleaners, days, assignmentsMap);
  const result: Record<string, TaskOverlap[]> = {};

  cleaners.forEach((cleaner) => {
    const overlaps = days.flatMap((day) => cells[cleaner.id][day]
      .filter((entry) => entry.hasOverlap)
      .map((entry) => ({ ...entry.task, endTime: entry.displayEndTime })));
    if (overlaps.length > 0) result[cleaner.id] = overlaps;
  });

  return result;
};

/** A drag in the multi-day grid reassigns the cleaner but never moves the date. */
export const canDropOnDay = (task: Pick<Task, 'date'> | null | undefined, day: string) =>
  !!task && task.date === day;
