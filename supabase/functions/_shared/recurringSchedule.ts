export interface RecurringSchedule {
  frequency: 'daily' | 'weekly' | 'monthly' | string;
  interval_days?: number | null;
  days_of_week?: number[] | null;
  day_of_month?: number | null;
  start_date: string;
  end_date?: string | null;
}

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function assertDateKey(value: string, fieldName: string): void {
  if (!DATE_KEY_PATTERN.test(value)) {
    throw new Error(`${fieldName} debe tener formato YYYY-MM-DD`);
  }
}

function parseDateKey(value: string): Date {
  assertDateKey(value, 'date');
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (formatDateKey(date) !== value) {
    throw new Error(`Fecha civil inválida: ${value}`);
  }
  return date;
}

function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(dateKey: string, days: number): string {
  const date = parseDateKey(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateKey(date);
}

function compareDateKeys(left: string, right: string): number {
  return left.localeCompare(right);
}

function laterDateKey(left: string, right: string): string {
  return compareDateKeys(left, right) >= 0 ? left : right;
}

function earlierDateKey(left: string, right: string): string {
  return compareDateKeys(left, right) <= 0 ? left : right;
}

function normalizedInterval(schedule: RecurringSchedule): number {
  return Math.max(1, Math.trunc(Number(schedule.interval_days) || 1));
}

function normalizedWeekdays(schedule: RecurringSchedule): number[] {
  const supplied = Array.from(new Set(schedule.days_of_week || []))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    .sort((left, right) => left - right);
  if (supplied.length > 0) return supplied;
  return [parseDateKey(schedule.start_date).getUTCDay()];
}

function daysBetween(from: string, to: string): number {
  return Math.round((parseDateKey(to).getTime() - parseDateKey(from).getTime()) / DAY_MS);
}

function monthsBetween(from: Date, to: Date): number {
  return (to.getUTCFullYear() - from.getUTCFullYear()) * 12
    + (to.getUTCMonth() - from.getUTCMonth());
}

function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export function isRecurringOccurrence(schedule: RecurringSchedule, dateKey: string): boolean {
  assertDateKey(schedule.start_date, 'start_date');
  assertDateKey(dateKey, 'date');
  if (compareDateKeys(dateKey, schedule.start_date) < 0) return false;
  if (schedule.end_date && compareDateKeys(dateKey, schedule.end_date) > 0) return false;

  const interval = normalizedInterval(schedule);
  const start = parseDateKey(schedule.start_date);
  const candidate = parseDateKey(dateKey);

  switch (schedule.frequency) {
    case 'daily':
      return daysBetween(schedule.start_date, dateKey) % interval === 0;

    case 'weekly': {
      const startWeekDayMondayFirst = (start.getUTCDay() + 6) % 7;
      const candidateWeekDayMondayFirst = (candidate.getUTCDay() + 6) % 7;
      const startWeek = addDays(schedule.start_date, -startWeekDayMondayFirst);
      const candidateWeek = addDays(dateKey, -candidateWeekDayMondayFirst);
      const weekDifference = daysBetween(startWeek, candidateWeek) / 7;
      return weekDifference >= 0
        && weekDifference % interval === 0
        && normalizedWeekdays(schedule).includes(candidate.getUTCDay());
    }

    case 'monthly': {
      const monthDifference = monthsBetween(start, candidate);
      if (monthDifference < 0 || monthDifference % interval !== 0) return false;
      const requestedDay = Math.max(
        1,
        Math.trunc(Number(schedule.day_of_month) || start.getUTCDate()),
      );
      const expectedDay = Math.min(
        requestedDay,
        lastDayOfMonth(candidate.getUTCFullYear(), candidate.getUTCMonth()),
      );
      return candidate.getUTCDate() === expectedDay;
    }

    default:
      throw new Error(`Frecuencia recurrente no soportada: ${schedule.frequency}`);
  }
}

function findFirstOccurrenceOnOrAfter(
  schedule: RecurringSchedule,
  minimumDate: string,
): string | null {
  let cursor = laterDateKey(schedule.start_date, minimumDate);
  const interval = normalizedInterval(schedule);
  const fallbackLimit = schedule.frequency === 'monthly'
    ? interval * 31 + 31
    : schedule.frequency === 'weekly'
      ? interval * 7 + 7
      : interval + 1;
  const hardEnd = schedule.end_date || addDays(cursor, fallbackLimit);

  while (compareDateKeys(cursor, hardEnd) <= 0) {
    if (isRecurringOccurrence(schedule, cursor)) return cursor;
    cursor = addDays(cursor, 1);
  }
  return null;
}

export function calculateInitialExecution(
  schedule: RecurringSchedule,
  todayMadrid: string,
): string | null {
  assertDateKey(todayMadrid, 'todayMadrid');
  return findFirstOccurrenceOnOrAfter(schedule, todayMadrid);
}

export function calculateNextExecution(
  schedule: RecurringSchedule,
  currentExecution: string,
): string | null {
  assertDateKey(currentExecution, 'currentExecution');
  return findFirstOccurrenceOnOrAfter(schedule, addDays(currentExecution, 1));
}

export function calculateOccurrences(
  schedule: RecurringSchedule,
  dateFrom: string,
  dateTo: string,
): string[] {
  assertDateKey(dateFrom, 'dateFrom');
  assertDateKey(dateTo, 'dateTo');
  if (compareDateKeys(dateFrom, dateTo) > 0) return [];

  let cursor = laterDateKey(schedule.start_date, dateFrom);
  const hardEnd = schedule.end_date
    ? earlierDateKey(schedule.end_date, dateTo)
    : dateTo;
  const occurrences: string[] = [];

  while (compareDateKeys(cursor, hardEnd) <= 0) {
    if (isRecurringOccurrence(schedule, cursor)) occurrences.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return occurrences;
}

export function calculateDueExecutions(
  schedule: RecurringSchedule,
  firstExecution: string,
  todayMadrid: string,
  limit: number,
): { dates: string[]; hasMore: boolean } {
  assertDateKey(firstExecution, 'firstExecution');
  assertDateKey(todayMadrid, 'todayMadrid');
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error('limit must be a positive integer');
  }

  const dates: string[] = [];
  let execution: string | null = firstExecution;

  while (
    execution
    && compareDateKeys(execution, todayMadrid) <= 0
    && dates.length < limit
  ) {
    dates.push(execution);
    execution = calculateNextExecution(schedule, execution);
  }

  return {
    dates,
    hasMore: execution !== null && compareDateKeys(execution, todayMadrid) <= 0,
  };
}

export function getMadridDateKey(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
