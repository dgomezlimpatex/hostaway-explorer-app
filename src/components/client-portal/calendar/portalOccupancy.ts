import type { PortalBooking } from '@/types/clientPortal';

// Civil calendar days avoid timezone and DST errors in nightly occupancy.
export const calendarDay = (value: string | null | undefined): string | null => {
  const day = value?.slice(0, 10);
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const date = new Date(`${day}T12:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== day ? null : day;
};
export const madridToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const shiftDay = (day: string, delta: number) => {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
};
export const weekOf = (day: string) => {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  const start = shiftDay(day, -(weekday || 7) + 1);
  return Array.from({ length: 7 }, (_, index) => shiftDay(start, index));
};
export const hasStay = (booking: PortalBooking) => {
  const arrival = calendarDay(booking.checkInDate);
  const departure = calendarDay(booking.checkOutDate);
  return booking.status !== 'cancelled' && !!arrival && !!departure && arrival < departure;
};
export const occupiesNight = (booking: PortalBooking, day: string) => hasStay(booking) && calendarDay(booking.checkInDate)! <= day && day < calendarDay(booking.checkOutDate)!;
export const cleansOn = (booking: PortalBooking, day: string) => booking.status !== 'cancelled' && calendarDay(booking.cleaningDate) === day;
export const staySegment = (booking: PortalBooking, days: string[]) => {
  const occupied = days.map((day, index) => occupiesNight(booking, day) ? index : -1).filter(index => index >= 0);
  return occupied.length ? { start: occupied[0], span: occupied.length } : null;
};
// Visual bars include half of the departure day; nightly occupancy remains exclusive.
export const stayBarSegment = (booking: PortalBooking, days: string[]) => {
  if (!hasStay(booking) || !days.length) return null;
  const offset = (day: string) => (Date.parse(`${day}T12:00:00Z`) - Date.parse(`${days[0]}T12:00:00Z`)) / 86400000;
  const start = Math.max(0, offset(calendarDay(booking.checkInDate)!));
  const finish = Math.min(days.length, offset(calendarDay(booking.checkOutDate)!) + 0.5);
  return finish > start ? { start, span: finish - start } : null;
};
export const nightCount = (booking: PortalBooking) => hasStay(booking) ? Math.round((Date.parse(`${calendarDay(booking.checkOutDate)}T12:00:00Z`) - Date.parse(`${calendarDay(booking.checkInDate)}T12:00:00Z`)) / 86400000) : 0;
export const dayLabel = (day: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('es-ES', { ...options, timeZone: 'Europe/Madrid' }).format(new Date(`${day}T12:00:00Z`));
