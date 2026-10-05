import type { StaffingCenter, StaffingIssue } from './types';

export const text = (value: unknown): string => typeof value === 'string' ? value : '';
export const numeric = (value: unknown): number => value == null || value === '' ? NaN : Number(value);
export const validDate = (value: unknown): value is string => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text(value))) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
export const timeMinutes = (value: unknown): number => {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(text(value));
  if (!match) return NaN;
  const h = Number(match[1]); const m = Number(match[2]); const s = Number(match[3] || 0);
  return h < 24 && m < 60 && s < 60 ? h * 60 + m : NaN;
};
/** Scheduled end is not an access deadline. Materialization copies these same inputs. */
export function accessWindow(row: { check_out?: unknown; check_in?: unknown; start_time?: unknown }, center: StaffingCenter, issues: StaffingIssue[]) {
  const boundary = (value: unknown, fallback: number) => {
    const minute = timeMinutes(value);
    if (Number.isFinite(minute)) return minute;
    if (value != null && value !== '') issues.push({ code: 'invalid-access-window', message: 'Hora de acceso o referencia inválida; se usa el límite del centro como hipótesis, no ventana certificada.', centerId: center.id });
    return fallback;
  };
  const startMinute = Math.max(center.startMinute, boundary(row.check_out, center.startMinute), boundary(row.start_time, center.startMinute));
  const endMinute = Math.min(center.endMinute, boundary(row.check_in, center.endMinute));
  if (!Number.isFinite(startMinute) || !Number.isFinite(endMinute) || endMinute <= startMinute) issues.push({ code: 'invalid-access-window', message: 'Ventana de acceso contradictoria o desconocida; no se amplía para encajar el servicio.', centerId: center.id });
  return { startMinute, endMinute };
}
/** DATE columns are Madrid civil keys; UTC noon is only calendar arithmetic, never timestamp interpretation. */
export const datePlus = (date: string, days: number): string => {
  if (!validDate(date)) throw new Error('Fecha civil inválida.');
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
