// Calendar-month chunks for reading tasks: every month is cached on its own, so
// moving to the next or previous month only reads the months not downloaded yet.
export const MAX_MONTHS = 60;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export const monthBounds = (month: string): { start: string; end: string } => {
  const last = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(last).padStart(2, '0')}` };
};
const shift = (month: string, offset: number) => {
  const index = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + offset;
  return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String(index % 12 + 1).padStart(2, '0')}`;
};

// Every calendar month touched by [start, end], oldest first. Empty for an invalid or reversed range.
export function monthsCovering(start: string, end: string): string[] {
  const first = start.slice(0, 7), last = end.slice(0, 7);
  if (!MONTH.test(first) || !MONTH.test(last) || start > end) return [];
  const months: string[] = [];
  for (let month = first; month <= last; month = shift(month, 1)) {
    months.push(month);
    if (months.length > MAX_MONTHS) throw new Error('El periodo contiene demasiados registros. Reduce el intervalo de fechas.');
  }
  return months;
}
// The `count` months right before the oldest one, nearest first: what the user reaches by stepping back.
export function olderMonths(months: string[], count: number): string[] {
  if (!months.length) return [];
  return Array.from({ length: count }, (_, index) => shift(months[0], -(index + 1)));
}
// Closed months rarely change; the current and future ones can (new tasks, reassignments).
export const MONTH_STALE_MS = 10 * 60_000, OPEN_MONTH_STALE_MS = 60_000;
export const monthStaleTime = (month: string, today: string) => month >= today.slice(0, 7) ? OPEN_MONTH_STALE_MS : MONTH_STALE_MS;
