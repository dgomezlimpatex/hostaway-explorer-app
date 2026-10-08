import { validDate, type Filters, type Summary, type FinancialService, type FinanceSettings } from './financialModel';
import { adjacentMonth, annualTrend, monthlyTrend, trendPeriods } from './financialCharts';
import { financialMonthRange, financialYearRange, selectedFinancialYear } from './financialView';
import { analyzeWithAllocation, type Allocation } from './financialAnalytics';

type Period = Pick<Filters, 'start' | 'end'>;
const iso = (date: Date) => date.toISOString().slice(0, 10);
export function comparisonPeriod(filters: Period): (Period & { label: string }) | null {
  if (!validDate(filters.start) || !validDate(filters.end) || filters.start > filters.end) return null;
  const year = selectedFinancialYear(filters);
  if (year) {
    const previous = financialYearRange(String(Number(year) - 1).padStart(4, '0'));
    return previous && { ...previous, label: 'vs año anterior' };
  }
  if (filters.start.slice(0, 7) === filters.end.slice(0, 7)) {
    const previous = adjacentMonth(filters.start, -1), current = financialMonthRange(filters.start.slice(0, 7));
    if (!previous || !current) return null;
    // A full month compares against a full month; partial months keep the same
    // day interval and clamp to the previous month's final day.
    const lastDay = Number(previous.end.slice(8));
    return { start: previous.start.slice(0, 8) + String(Math.min(Number(filters.start.slice(8)), lastDay)).padStart(2, '0'),
      end: filters.start === current.start && filters.end === current.end ? previous.end : previous.start.slice(0, 8) + String(Math.min(Number(filters.end.slice(8)), lastDay)).padStart(2, '0'), label: 'vs mes anterior' };
  }
  const days = Math.round((Date.parse(filters.end) - Date.parse(filters.start)) / 86400000) + 1;
  const end = new Date(filters.start + 'T00:00:00Z'); end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - days + 1);
  return { start: iso(start), end: iso(end), label: 'vs periodo anterior equivalente' };
}

export function previousYearPeriod(filters: Period): (Period & { label: string }) | null {
  if (!validDate(filters.start) || !validDate(filters.end) || filters.start > filters.end) return null;
  const shift = (date: string) => {
    const year = Number(date.slice(0, 4)) - 1, month = date.slice(5, 7), range = financialMonthRange(`${String(year).padStart(4, '0')}-${month}`);
    return range ? range.start.slice(0, 8) + String(Math.min(Number(date.slice(8)), Number(range.end.slice(8)))).padStart(2, '0') : '';
  };
  const start = shift(filters.start), end = shift(filters.end);
  return start && end ? { start, end, label: 'vs mismo periodo del año anterior' } : null;
}
export function financialHistoryRange(filters: Filters, comparison: 'previous' | 'year' | 'budget' = 'previous'): Period {
  const previous = comparisonPeriod(filters);
  if (!previous) return { start: filters.start, end: filters.end };
  const periods = trendPeriods(filters.end, false, 12);
  return { start: [filters.start, previous.start, ...(comparison === 'year' ? [previousYearPeriod(filters)?.start || filters.start] : []), periods[0]?.start || filters.start].sort()[0],
    end: [filters.end, periods.at(-1)?.end || filters.end].sort().at(-1)! };
}
export function financialInsights(services: FinancialService[], settings: FinanceSettings, filters: Filters, allocation: Allocation = 'none', comparison: 'previous' | 'year' | 'budget' = 'previous') {
  const period = comparison === 'year' ? previousYearPeriod(filters) : comparisonPeriod(filters);
  const full = financialMonthRange(filters.end.slice(0, 7));
  const rows = selectedFinancialYear(filters) ? annualTrend(services, settings, filters, allocation) : monthlyTrend(services, settings, filters, filters.end !== full?.end, 12, allocation);
  return { period, previous: period ? analyzeWithAllocation(services, settings, { ...filters, ...period }, allocation).total : null, rows };
}
export type Kpi = 'revenue' | 'expense' | 'result' | 'margin';
export function kpiChange(current: Pick<Summary, Kpi>, previous: Pick<Summary, Kpi> | null, key: Kpi) {
  const now = current[key], before = previous?.[key];
  if (now === null || before === null || before === undefined) return null;
  const delta = now - before;
  return { delta, relative: key === 'margin' || before === 0 ? null : delta / Math.abs(before) * 100,
    direction: delta === 0 ? 'same' : (key === 'expense' ? delta < 0 : delta > 0) ? 'better' : 'worse' } as const;
}
