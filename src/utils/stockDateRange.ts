const MADRID_TIME_ZONE = 'Europe/Madrid';

const madridOffsetMinutes = (instant: Date): number => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MADRID_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60000);
};

/** Instante UTC (ISO) en que empieza el día `YYYY-MM-DD` en horario de Madrid. */
export const madridDayStartIso = (date: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error(`Fecha no válida: ${date}`);
  const utcMidnight = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const firstGuess = utcMidnight - madridOffsetMinutes(new Date(utcMidnight)) * 60000;
  const start = utcMidnight - madridOffsetMinutes(new Date(firstGuess)) * 60000;
  return new Date(start).toISOString();
};

const addDays = (date: string, days: number): string => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
};

/** Rango [desde, hasta) en UTC que cubre los días Madrid `from` y `to` completos. */
export const madridRangeBounds = (from: string, to: string): { start: string; endExclusive: string } => ({
  start: madridDayStartIso(from),
  endExclusive: madridDayStartIso(addDays(to, 1)),
});
