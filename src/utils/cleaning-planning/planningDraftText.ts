import { formatMadridDate, formatMadridDateTime } from '../date';
import type { DraftSummary } from './planningDraftStore';

const shortDate = (isoDate: string, currentYear: string): string => {
  const [year, month, day] = isoDate.split('-');
  return year === currentYear ? `${day}/${month}` : `${day}/${month}/${year}`;
};

/** «17/10» o «17/10 al 23/10» para el día o rango real de planificación. */
export const describeDraftPeriod = (startDate: string, endDate: string, now: Date): string => {
  const currentYear = formatMadridDate(now).slice(0, 4);
  return startDate === endDate
    ? shortDate(startDate, currentYear)
    : `${shortDate(startDate, currentYear)} al ${shortDate(endDate, currentYear)}`;
};

/** «a las 18:42» si fue hoy en Madrid; si no, «el 16/10 a las 18:42». */
export const describeDraftTime = (updatedAt: string, now: Date): string => {
  const stamp = formatMadridDateTime(new Date(updatedAt));
  const [day, time] = stamp.split('T');
  if (day === formatMadridDate(now)) return `a las ${time}`;
  return `el ${shortDate(day, formatMadridDate(now).slice(0, 4))} a las ${time}`;
};

export const describeTaskCount = (count: number): string => `${count} ${count === 1 ? 'tarea' : 'tareas'}`;

/** «Tienes un reparto sin guardar del 17/10, modificado a las 18:42. Afecta a 8 tareas.» */
export const describeStoredDraft = (summary: Pick<DraftSummary, 'identity' | 'updatedAt' | 'taskCount'>, now: Date = new Date()): string => {
  const { startDate, endDate } = summary.identity;
  return `Tienes un reparto sin guardar del ${describeDraftPeriod(startDate, endDate, now)}, modificado ${describeDraftTime(summary.updatedAt, now)}. Afecta a ${describeTaskCount(summary.taskCount)}.`;
};

/** Rango de planificación (`today`, `7d`, `30d`) que corresponde a un borrador; `null` si no hay ninguno que encaje. */
export const presetForDraftPeriod = (startDate: string, endDate: string): 'today' | '7d' | '30d' | null => {
  const toDay = (value: string) => Date.UTC(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10))) / 86_400_000;
  const span = toDay(endDate) - toDay(startDate);
  return span === 0 ? 'today' : span === 6 ? '7d' : span === 29 ? '30d' : null;
};
