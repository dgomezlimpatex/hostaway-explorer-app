// Estado de disponibilidad de un día, genérico (nunca el tipo médico ni notas).
// Puro para poder probarlo en Node; las fechas son AAAA-MM-DD en Europe/Madrid.
import { formatMadridDate } from '../../../utils/date';

export const madridTodayKey = (now: Date = new Date()): string => formatMadridDate(now);

const dayOfWeekFromKey = (date: string): number => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
};

interface AbsenceLike {
  cleanerId: string;
  startDate: string;
  endDate: string;
  startTime?: string | null;
  endTime?: string | null;
}

interface FixedDayLike {
  cleanerId: string;
  dayOfWeek: number;
  isActive: boolean;
}

interface ScheduleLike {
  cleanerId: string;
  daysOfWeek: number[];
  isActive: boolean;
  scheduleType?: string;
  startTime: string;
  endTime: string;
}

interface WeeklyRowLike {
  cleaner_id: string;
  day_of_week: number;
  is_available: boolean;
}

/** Ausencias que terminan hoy o después (hoy en Madrid, no en UTC). */
export const countUpcomingAbsences = (absences: Pick<AbsenceLike, 'endDate'>[], today: string): number =>
  absences.filter((absence) => absence.endDate >= today).length;

export type DayStatus =
  | { kind: 'absent' }
  | { kind: 'partial_absence'; from: string; to: string }
  | { kind: 'fixed_day_off' }
  | { kind: 'weekly_unavailable' }
  | { kind: 'restricted'; from: string; to: string }
  | { kind: 'available' };

export const dayStatusFor = (
  cleanerId: string,
  date: string,
  sources: {
    absences?: AbsenceLike[];
    fixedDaysOff?: FixedDayLike[];
    schedules?: ScheduleLike[];
    weekly?: WeeklyRowLike[];
  },
): DayStatus => {
  const weekday = dayOfWeekFromKey(date);
  const absences = (sources.absences ?? []).filter(
    (a) => a.cleanerId === cleanerId && a.startDate <= date && a.endDate >= date,
  );
  if (absences.some((a) => !a.startTime || !a.endTime)) return { kind: 'absent' };
  if ((sources.fixedDaysOff ?? []).some((d) => d.cleanerId === cleanerId && d.isActive && d.dayOfWeek === weekday)) {
    return { kind: 'fixed_day_off' };
  }
  if ((sources.weekly ?? []).some((w) => w.cleaner_id === cleanerId && w.day_of_week === weekday && !w.is_available)) {
    return { kind: 'weekly_unavailable' };
  }
  const partial = absences[0];
  if (partial?.startTime && partial.endTime) {
    return { kind: 'partial_absence', from: partial.startTime.slice(0, 5), to: partial.endTime.slice(0, 5) };
  }
  const restriction = (sources.schedules ?? []).find(
    (s) => s.cleanerId === cleanerId && s.isActive && s.scheduleType === 'unavailability' && s.daysOfWeek.includes(weekday),
  );
  if (restriction) {
    return { kind: 'restricted', from: restriction.startTime.slice(0, 5), to: restriction.endTime.slice(0, 5) };
  }
  return { kind: 'available' };
};

export const dayStatusText = (status: DayStatus): string => {
  switch (status.kind) {
    case 'absent':
      return 'Ausente';
    case 'partial_absence':
      return `Ausente ${status.from}–${status.to}`;
    case 'fixed_day_off':
      return 'Día libre fijo';
    case 'weekly_unavailable':
      return 'No disponible (horario semanal)';
    case 'restricted':
      return `No disponible ${status.from}–${status.to}`;
    default:
      return 'Disponible';
  }
};

/** Estados que significan que hoy no trabaja todo el día o en parte. */
export const isUnavailableToday = (status: DayStatus): boolean => status.kind !== 'available';
