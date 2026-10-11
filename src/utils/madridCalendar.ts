import { formatMadridDate } from '@/utils/date';

/** Today's civil date (YYYY-MM-DD) in Europe/Madrid, whatever the device timezone. */
export const getMadridToday = (now: Date = new Date()) => formatMadridDate(now);

/** Adds days to a civil date without timezone or daylight-saving drift. */
export const shiftCivilDate = (day: string, days: number) => {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export const isMadridToday = (date: Date, now: Date = new Date()) =>
  formatMadridDate(date) === getMadridToday(now);

/** Local-noon Date for a civil date, safe to format with date-fns on any device. */
export const civilDateToDisplayDate = (day: string) => {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date, 12);
};

/** Monday-to-Sunday civil dates of the Madrid week that contains `date`. */
export const getMadridWeekDays = (date: Date) => {
  const day = formatMadridDate(date);
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  const monday = shiftCivilDate(day, weekday === 0 ? -6 : 1 - weekday);
  return Array.from({ length: 7 }, (_, index) => shiftCivilDate(monday, index));
};
