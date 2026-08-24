// Date helpers

/**
 * Format a Date into YYYY-MM-DD in Europe/Madrid timezone.
 * This avoids off-by-one-day issues caused by Date#toISOString() (UTC).
 */
export const formatMadridDate = (date: Date): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  if (!year || !month || !day) return date.toISOString().split('T')[0];
  return `${year}-${month}-${day}`;
};

export const formatMadridDateTime = (date: Date): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = get('hour');
  const minute = get('minute');
  if (!year || !month || !day || !hour || !minute) return `${formatMadridDate(date)}T12:00`;
  return `${year}-${month}-${day}T${hour}:${minute}`;
};

/**
 * Returns a Date that, when passed to formatMadridDate, yields today's date
 * in Europe/Madrid. Robust around midnight regardless of the browser TZ.
 */
export const getTodayMadrid = (): Date => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  const get = (t: string) => parts.find((p) => p.type === t)?.value;
  const year = Number(get('year'));
  const month = Number(get('month'));
  const day = Number(get('day'));
  const hour = Number(get('hour') ?? '12');
  const minute = Number(get('minute') ?? '0');

  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day, Math.max(12, hour), minute, 0, 0);
};
