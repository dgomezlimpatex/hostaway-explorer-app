export type DayTimes = Record<number, { startTime: string; endTime: string }>;

export const buildDaySchedules = (days: number[], times: DayTimes, startTime: string, endTime: string) =>
  [1, 2, 3, 4, 5, 6, 0].filter(day => days.includes(day)).map(day => ({
    daysOfWeek: [day],
    ...(times[day] || { startTime, endTime }),
  }));

export const validDaySchedules = (rows: ReturnType<typeof buildDaySchedules>) => rows.length > 0 &&
  rows.every(row => /^\d{2}:\d{2}$/.test(row.startTime) && /^\d{2}:\d{2}$/.test(row.endTime) && row.endTime > row.startTime);
