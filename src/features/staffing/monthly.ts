import type { StaffingDay, StaffingIssue, StaffingResult } from './types';

export type StaffingMonthStatus = 'current-partial' | 'complete' | 'future';

export interface StaffingMonthlyWeekSegment {
  week: string;
  segmentStart: string;
  segmentEnd: string;
  crossesMonth: boolean;
  knownMinutes: number;
  estimatedMinutes: number;
  capacityMinutes: number;
  knownUncoveredMinutes: number;
  criticalDays: number;
  fullWeekKnownMinutes: number;
  fullWeekCapacityMinutes: number;
}

export interface StaffingMonth {
  month: string;
  label: string;
  status: StaffingMonthStatus;
  startDate: string;
  endDate: string;
  includedFrom: string;
  includedTo: string;
  days: string[];
  pastDays: string[];
  knownMinutes: number;
  estimatedMinutes: number;
  capacityMinutes: number;
  knownUncoveredMinutes: number;
  criticalDays: number;
  pastKnownMinutes: number;
  missingDays: number;
  issues: StaffingIssue[];
  weeks: StaffingMonthlyWeekSegment[];
}

export interface StaffingMonthlyView {
  months: StaffingMonth[];
  issues: StaffingIssue[];
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function assertCivilDate(value: string): void {
  if (!DATE_PATTERN.test(value)) throw new RangeError('Fecha civil inválida.');
  const date = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new RangeError('Fecha civil inválida.');
}

export function addCivilDays(value: string, count: number): string {
  assertCivilDate(value);
  if (!Number.isInteger(count)) throw new RangeError('Desplazamiento civil inválido.');
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

export function monthStart(value: string): string {
  assertCivilDate(value);
  return `${value.slice(0, 7)}-01`;
}

export function monthEnd(value: string): string {
  const start = monthStart(value);
  return addCivilDays(addCivilMonths(start, 1), -1);
}

export function addCivilMonths(value: string, count: number): string {
  assertCivilDate(value);
  if (!Number.isInteger(count)) throw new RangeError('Desplazamiento mensual inválido.');
  const date = new Date(`${value.slice(0, 7)}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + count, 1);
  return date.toISOString().slice(0, 10);
}

function monday(value: string): string {
  assertCivilDate(value);
  const day = new Date(`${value}T12:00:00Z`).getUTCDay();
  return addCivilDays(value, -((day + 6) % 7));
}

function sunday(value: string): string {
  return addCivilDays(value, 6);
}

function rangeDays(from: string, to: string): string[] {
  const days: string[] = [];
  for (let date = from; date <= to; date = addCivilDays(date, 1)) days.push(date);
  return days;
}

function sum(days: StaffingDay[], selector: (day: StaffingDay) => number): number {
  return days.reduce((total, day) => total + (Number.isFinite(selector(day)) ? selector(day) : 0), 0);
}

function knownUncovered(day: StaffingDay): number {
  return Math.max(0, day.uncoveredMinutes - day.estimatedMinutes);
}

export function getMonthlyForecastRange(anchorDate: string, count = 3): { from: string; to: string; weeks: number } {
  assertCivilDate(anchorDate);
  if (!Number.isInteger(count) || count < 1 || count > 6) throw new RangeError('El número de meses debe estar entre 1 y 6.');
  const from = monday(monthStart(anchorDate));
  const to = sunday(monday(monthEnd(addCivilMonths(anchorDate, count - 1))));
  return { from, to, weeks: Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000 + 1) / 7 };
}

export function buildStaffingMonthlyView(result: StaffingResult, anchorDate: string, count = 3, asOf = anchorDate): StaffingMonthlyView {
  assertCivilDate(anchorDate);
  assertCivilDate(asOf);
  if (!Number.isInteger(count) || count < 1 || count > 6) throw new RangeError('El número de meses debe estar entre 1 y 6.');
  const dayByDate = new Map<string, StaffingDay>();
  const issues: StaffingIssue[] = [];
  for (const day of result.days) {
    if (dayByDate.has(day.date)) issues.push({ code: 'monthly-data-quality', message: `Día duplicado ${day.date}; se conserva una sola fila para no duplicar el total mensual.` });
    else dayByDate.set(day.date, day);
  }
  const weekByKey = new Map(result.weeks.map(week => [week.week, week]));
  const months: StaffingMonth[] = [];
  for (let index = 0; index < count; index++) {
    const startDate = addCivilMonths(monthStart(anchorDate), index);
    const endDate = monthEnd(startDate);
    const isCurrent = startDate.slice(0, 7) === asOf.slice(0, 7);
    const status: StaffingMonthStatus = isCurrent ? 'current-partial' : startDate > asOf ? 'future' : 'complete';
    const includedFrom = isCurrent ? (asOf > startDate ? asOf : startDate) : startDate;
    const includedTo = endDate;
    const monthIssues: StaffingIssue[] = [];
    for (const issue of issues) {
      if (issue.message.includes(startDate.slice(0, 7))) monthIssues.push(issue);
    }
    const pastDays = isCurrent ? rangeDays(startDate, addCivilDays(includedFrom, -1)) : [];
    const days = includedFrom <= includedTo ? rangeDays(includedFrom, includedTo) : [];
    const matching = days.map(date => dayByDate.get(date)).filter((day): day is StaffingDay => !!day);
    const missingDays = days.length - matching.length;
    if (missingDays) {
      const issue = { code: 'monthly-data-quality', message: `${startDate.slice(0, 7)}: faltan ${missingDays} días en el resultado; total parcial, no cero certificado.` };
      issues.push(issue);
      monthIssues.push(issue);
    }
    const pastRows = pastDays.map(date => dayByDate.get(date)).filter((day): day is StaffingDay => !!day);
    const weeks: StaffingMonthlyWeekSegment[] = [];
    const firstWeek = monday(startDate);
    for (let week = firstWeek; week <= endDate; week = addCivilDays(week, 7)) {
      const segmentStart = week > includedFrom ? week : includedFrom;
      const weekEnd = sunday(week);
      const segmentEnd = weekEnd < includedTo ? weekEnd : includedTo;
      if (segmentStart > segmentEnd) continue;
      const segmentRows = rangeDays(segmentStart, segmentEnd).map(date => dayByDate.get(date)).filter((day): day is StaffingDay => !!day);
      const full = weekByKey.get(week);
      weeks.push({
        week,
        segmentStart,
        segmentEnd,
        crossesMonth: week < startDate || weekEnd > endDate,
        knownMinutes: sum(segmentRows, day => day.knownMinutes),
        estimatedMinutes: sum(segmentRows, day => day.estimatedMinutes),
        capacityMinutes: sum(segmentRows, day => day.capacityMinutes),
        knownUncoveredMinutes: sum(segmentRows, knownUncovered),
        criticalDays: segmentRows.filter(day => knownUncovered(day) > 0).length,
        fullWeekKnownMinutes: full?.knownMinutes ?? sum(segmentRows, day => day.knownMinutes),
        fullWeekCapacityMinutes: full?.capacityMinutes ?? sum(segmentRows, day => day.capacityMinutes),
      });
    }
    months.push({
      month: startDate.slice(0, 7),
      label: MONTHS[Number(startDate.slice(5, 7)) - 1],
      status,
      startDate,
      endDate,
      includedFrom,
      includedTo,
      days,
      pastDays,
      knownMinutes: sum(matching, day => day.knownMinutes),
      estimatedMinutes: sum(matching, day => day.estimatedMinutes),
      capacityMinutes: sum(matching, day => day.capacityMinutes),
      knownUncoveredMinutes: sum(matching, knownUncovered),
      criticalDays: matching.filter(day => knownUncovered(day) > 0).length,
      pastKnownMinutes: sum(pastRows, day => day.knownMinutes),
      missingDays,
      issues: monthIssues,
      weeks,
    });
  }
  return { months, issues };
}
