import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addCivilDays, buildStaffingMonthlyView, getMonthlyForecastRange } from '../src/features/staffing/monthly';
import type { StaffingDay, StaffingResult, StaffingWeek } from '../src/features/staffing/types';

const addDays = (date: string, count: number) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + count);
  return value.toISOString().slice(0, 10);
};
const weekStart = (date: string) => {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return addDays(date, -((day + 6) % 7));
};
const makeResult = (from: string, to: string): StaffingResult => {
  const days: StaffingDay[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    days.push({ date, knownMinutes: 60, estimatedMinutes: date.startsWith('2026-10') ? 30 : 0, capacityMinutes: 120, uncoveredMinutes: date === '2026-10-20' ? 90 : 0, assignments: [], reasons: [], rests: [] });
  }
  const weeks: StaffingWeek[] = [];
  for (let week = weekStart(from); week <= weekStart(to); week = addDays(week, 7)) {
    const matching = days.filter(day => week <= day.date && day.date <= addDays(week, 6));
    weeks.push({ week, knownMinutes: matching.reduce((sum, day) => sum + day.knownMinutes, 0), estimatedMinutes: matching.reduce((sum, day) => sum + day.estimatedMinutes, 0), capacityMinutes: matching.reduce((sum, day) => sum + day.capacityMinutes, 0), contractedMinutes: matching.length * 120, uncoveredMinutes: matching.reduce((sum, day) => sum + day.uncoveredMinutes, 0), criticalDays: matching.filter(day => day.uncoveredMinutes > day.estimatedMinutes).length, idleMinutes: 0, cost: null });
  }
  return { days, weeks, centers: [], issues: [] };
};

test('builds three consecutive civil months and reconciles days through crossing weeks', () => {
  const result = makeResult('2026-08-31', '2026-12-06');
  const view = buildStaffingMonthlyView(result, '2026-09-16', 3, '2026-09-16');
  assert.deepEqual(view.months.map(month => month.month), ['2026-09', '2026-10', '2026-11']);
  assert.equal(view.months[0].status, 'current-partial');
  assert.equal(view.months[0].includedFrom, '2026-09-16');
  assert.equal(view.months[0].pastKnownMinutes, 15 * 60);
  assert.equal(view.months[0].knownMinutes, 15 * 60);
  assert.equal(view.months[1].knownMinutes, 31 * 60);
  assert.equal(view.months[1].estimatedMinutes, 31 * 30);
  assert.equal(view.months[1].capacityMinutes, 31 * 120);
  assert.equal(view.months[1].knownUncoveredMinutes, 60);
  const crossing = view.months[1].weeks.find(week => week.week === '2026-09-28');
  assert.deepEqual(crossing && [crossing.segmentStart, crossing.segmentEnd, crossing.crossesMonth], ['2026-10-01', '2026-10-04', true]);
  assert.equal(crossing?.knownMinutes, 4 * 60);
  assert.equal(crossing?.fullWeekKnownMinutes, 7 * 60);
  assert.equal(view.months.reduce((sum, month) => sum + month.knownMinutes, 0), 15 * 60 + 31 * 60 + 30 * 60);
  assert.equal(view.months.flatMap(month => month.weeks).reduce((sum, week) => sum + week.knownMinutes, 0), view.months.reduce((sum, month) => sum + month.knownMinutes, 0));
  assert.equal(new Set(view.months.flatMap(month => month.days)).size, 76);
});

test('keeps February leap day and month boundaries stable without timezone rollover', () => {
  const result = makeResult('2028-01-31', '2028-05-01');
  const view = buildStaffingMonthlyView(result, '2028-02-15', 3, '2028-02-15');
  assert.deepEqual(view.months.map(month => [month.month, month.startDate, month.endDate]), [
    ['2028-02', '2028-02-01', '2028-02-29'],
    ['2028-03', '2028-03-01', '2028-03-31'],
    ['2028-04', '2028-04-01', '2028-04-30'],
  ]);
  assert.equal(view.months[0].days.at(-1), '2028-02-29');
  assert.equal(getMonthlyForecastRange('2028-02-15', 3).weeks, 13);
});

test('returns a bounded fetch range aligned to complete weeks around three months', () => {
  assert.deepEqual(getMonthlyForecastRange('2026-09-16', 3), { from: '2026-08-31', to: '2026-12-06', weeks: 14 });
});

test('supports six complete calendar months with weekly context', () => {
  const range = getMonthlyForecastRange('2026-09-16', 6);
  assert.deepEqual(range, { from: '2026-08-31', to: '2027-02-28', weeks: 26 });
  const result = makeResult(range.from, range.to);
  const view = buildStaffingMonthlyView(result, '2026-09-16', 6, '2026-09-16');
  assert.deepEqual(view.months.map(month => month.month), ['2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02']);
  assert.equal(view.months[5].endDate, '2027-02-28');
});

test('supports the maximum six-month range without dropping the final week', () => {
  assert.deepEqual(getMonthlyForecastRange('2026-03-01', 6), { from: '2026-02-23', to: '2026-09-06', weeks: 28 });
});

test('handles December to February and Madrid DST as civil dates', () => {
  const view = buildStaffingMonthlyView({ days: [], weeks: [], centers: [], issues: [] }, '2026-12-15', 3, '2026-12-15');
  assert.deepEqual(view.months.map(month => month.month), ['2026-12', '2027-01', '2027-02']);
  assert.equal(addCivilDays('2026-10-24', 1), '2026-10-25');
  assert.equal(addCivilDays('2026-10-25', 1), '2026-10-26');
  assert.equal(getMonthlyForecastRange('2026-10-25', 3).weeks, 14);
});

test('rejects invalid civil inputs instead of normalizing them', () => {
  assert.throws(() => buildStaffingMonthlyView({ days: [], weeks: [], centers: [], issues: [] }, '2026-02-30', 3, '2026-02-30'), /Fecha civil inválida/);
  assert.throws(() => buildStaffingMonthlyView({ days: [], weeks: [], centers: [], issues: [] }, '2026-09-01', 0, '2026-09-01'), /meses/);
});

test('publishes monthly data-quality diagnostics as common issues', () => {
  const day: StaffingDay = { date: '2026-09-14', knownMinutes: 60, estimatedMinutes: 0, capacityMinutes: 120, uncoveredMinutes: 0, assignments: [], reasons: [], rests: [] };
  const view = buildStaffingMonthlyView({ days: [day, { ...day }], weeks: [], centers: [], issues: [] }, '2026-09-01', 1, '2026-09-01');
  const issue = view.issues.find(item => item.code === 'monthly-data-quality');
  assert.ok(issue, 'monthly diagnostics must use the shared issue contract');
  assert.match(issue.message, /Día duplicado 2026-09-14/);
  assert.equal(view.months[0].issues[0], issue);
});

console.log('staffing-monthly-tests: loaded');
