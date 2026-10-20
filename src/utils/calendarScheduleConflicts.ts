import type { Task } from '@/types/calendar';
import { ABSENCE_COLUMNS, getAbsenceLabel, maskAbsenceType } from '@/components/calendar/utils/absencePrivacy';
import { civilDayOfWeek } from '@/utils/availabilityUtils';
import { getEffectiveTaskEndTime } from '@/utils/taskPositioning';
import { getDisplayStatus } from '@/utils/calendarTaskStatus';
import { isTaskAssignedToCleaner } from '@/utils/taskAssignments';

/**
 * Checks shared by the calendar drop and the quick actions (resize, duration,
 * move to another day): the same rules must apply whatever the gesture.
 * Reads only; never writes.
 */
export interface CleanerDayConflict {
  kind: 'fixed-day-off' | 'absence' | 'hourly-absence' | 'maintenance' | 'overlap';
  title: string;
  detail: string;
}

const toMin = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

export const timeRangesOverlap = (start1: string, end1: string, start2: string, end2: string): boolean =>
  toMin(start1) < toMin(end2) && toMin(end1) > toMin(start2);


// Minimal query surface of the Supabase client used here (injectable in tests).
type QueryResult = PromiseLike<{ data: unknown; error?: unknown }>;
interface ConflictQuery extends QueryResult {
  select: (columns: string) => ConflictQuery;
  eq: (column: string, value: unknown) => ConflictQuery;
  lte: (column: string, value: unknown) => ConflictQuery;
  gte: (column: string, value: unknown) => ConflictQuery;
  contains: (column: string, value: unknown) => ConflictQuery;
  maybeSingle: () => QueryResult;
}
export interface ConflictReader { from: (table: string) => unknown }

/**
 * Fixed day off, absences and maintenance of one cleaner on a civil date
 * (Europe/Madrid). The weekday is computed from the civil date, so a device
 * in another timezone asks for the right day.
 */
export const fetchCleanerDayConflicts = async (
  db: ConflictReader,
  cleanerId: string,
  date: string,
  startTime: string,
  endTime: string,
  { canSeeAbsenceDetails = true }: { canSeeAbsenceDetails?: boolean } = {},
): Promise<CleanerDayConflict[]> => {
  const dayOfWeek = civilDayOfWeek(date);
  const absenceLabel = (type: string) => getAbsenceLabel(maskAbsenceType(type, canSeeAbsenceDetails));
  const from = (table: string) => db.from(table) as ConflictQuery;
  const [fixedDayOffRes, absencesRes, maintenanceRes] = await Promise.all([
    from('worker_fixed_days_off').select('*').eq('cleaner_id', cleanerId).eq('day_of_week', dayOfWeek).eq('is_active', true).maybeSingle(),
    from('worker_absences').select(ABSENCE_COLUMNS).eq('cleaner_id', cleanerId).lte('start_date', date).gte('end_date', date),
    from('worker_maintenance_cleanings').select('*').eq('cleaner_id', cleanerId).eq('is_active', true).contains('days_of_week', [dayOfWeek]),
  ]);

  const conflicts: CleanerDayConflict[] = [];
  if (fixedDayOffRes.data) {
    conflicts.push({ kind: 'fixed-day-off', title: 'Día libre fijo', detail: 'Tiene este día marcado como día libre fijo.' });
  }
  const absences = (absencesRes.data as Array<{ absence_type: string; start_time?: string | null; end_time?: string | null }> | null) || [];
  const fullDay = absences.find((a) => !a.start_time || !a.end_time);
  if (fullDay) {
    conflicts.push({ kind: 'absence', title: 'Ausencia del trabajador', detail: `Tiene registrada una ausencia: ${absenceLabel(fullDay.absence_type)}` });
  }
  const hourly = absences.find((a) => a.start_time && a.end_time && timeRangesOverlap(startTime, endTime, a.start_time, a.end_time));
  if (hourly) {
    conflicts.push({
      kind: 'hourly-absence',
      title: 'Conflicto de horario',
      detail: `Tiene: ${absenceLabel(hourly.absence_type)}\nHorario: ${hourly.start_time!.slice(0, 5)} - ${hourly.end_time!.slice(0, 5)}`,
    });
  }
  const maintenance = ((maintenanceRes.data as Array<{ location_name: string; start_time: string; end_time: string }> | null) || [])
    .find((m) => timeRangesOverlap(startTime, endTime, m.start_time, m.end_time));
  if (maintenance) {
    conflicts.push({
      kind: 'maintenance',
      title: 'Limpieza de mantenimiento',
      detail: `Tiene: ${maintenance.location_name}\nHorario: ${maintenance.start_time.slice(0, 5)} - ${maintenance.end_time.slice(0, 5)}`,
    });
  }
  return conflicts;
};

/**
 * Other tasks of the cleaner on that date that overlap the window. Shared
 * tasks count with each person's share, like the overlap banner. Cancelled
 * tasks never conflict.
 */
export const findCleanerTaskOverlaps = (
  tasks: Task[],
  cleaner: { id: string; name?: string },
  date: string,
  startTime: string,
  endTime: string,
  excludeTaskId?: string,
): Task[] => tasks.filter((other) =>
  other.id !== excludeTaskId &&
  other.date === date &&
  getDisplayStatus(other) !== 'cancelled' &&
  isTaskAssignedToCleaner(other, cleaner.id, cleaner.name) &&
  timeRangesOverlap(startTime, endTime, other.startTime, getEffectiveTaskEndTime(other)),
);
