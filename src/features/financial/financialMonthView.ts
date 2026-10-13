import type { Summary } from './financialModel';
import { groupedCosts } from './financialCharts';
import { kpiChange } from './financialInsights';
import { money, percent } from './financialFormat';

// Pure view-model for the monthly summary: no amounts are computed here beyond
// positions; every figure comes from the same Summary the tables use.
export type WaterfallId = 'revenue' | 'personal' | 'laundry' | 'supplies' | 'products' | 'other' | 'result';
export interface WaterfallRow {
  id: WaterfallId; label: string; kind: 'income' | 'expense' | 'result';
  amount: number; left: number; width: number; origin: 'left' | 'right'; share: number | null;
}
const costLabels = { personal: 'Personal', laundry: 'Lavandería', supplies: 'Amenities y consumibles', products: 'Productos de limpieza', other: 'Otros gastos' } as const;
const MIN_WIDTH = 0.8;

export function waterfallRows(total: Pick<Summary, 'revenue' | 'costs' | 'result'>) {
  const costs = groupedCosts(total.costs);
  const visible = (Object.keys(costLabels) as (keyof typeof costLabels)[]).filter(id => costs[id] !== 0 || id === 'personal');
  // Every bar starts on the same zero line, so lengths read directly as a staircase
  // from billing down to the profit that remains.
  const amounts = [total.revenue, ...visible.map(id => costs[id]), total.result];
  const min = Math.min(0, ...amounts), max = Math.max(0, ...amounts), range = max - min || 1;
  const pos = (value: number) => (value - min) / range * 100;
  const geometry = (amount: number) => ({ left: pos(Math.min(0, amount)), width: amount === 0 ? 0 : Math.max(Math.abs(pos(amount) - pos(0)), MIN_WIDTH) });
  const origin = (amount: number) => amount < 0 ? 'right' as const : 'left' as const;
  const rows: WaterfallRow[] = [
    { id: 'revenue', label: 'Facturación', kind: 'income', amount: total.revenue, ...geometry(total.revenue), origin: origin(total.revenue), share: null },
    ...visible.map(id => ({ id, label: costLabels[id], kind: 'expense' as const, amount: costs[id], ...geometry(costs[id]), origin: origin(costs[id]),
      share: total.revenue > 0 ? costs[id] / total.revenue * 100 : null })),
    { id: 'result', label: 'Beneficio', kind: 'result', amount: total.result, ...geometry(total.result), origin: origin(total.result), share: total.revenue > 0 ? total.result / total.revenue * 100 : null },
  ];
  return { rows, zero: min < 0 ? pos(0) : null };
}

const monthName = (date: string) => {
  const name = new Intl.DateTimeFormat('es-ES', { month: 'long', timeZone: 'Europe/Madrid' }).format(new Date(date + 'T12:00:00Z'));
  return name.charAt(0).toUpperCase() + name.slice(1);
};
export const monthTitle = (date: string) => {
  const text = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' }).format(new Date(date + 'T12:00:00Z'));
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export interface MonthHeadline {
  kicker: string; revenue: string; profit: string; sentence: string;
  revenueCompare: string | null; revenueDirection: 'better' | 'worse' | 'same' | null;
  profitCompare: string | null; profitDirection: 'better' | 'worse' | 'same' | null;
  tone: 'gain' | 'loss' | 'flat';
}
// Billing leads; profit is the line right below it.
export function monthHeadline(input: { total: Summary; previous: Summary | null; start: string; singleMonth: boolean; partial: boolean; comparisonLabel: string | null }): MonthHeadline {
  const { total, previous, start, singleMonth, partial, comparisonLabel } = input;
  const subject = singleMonth ? `de ${monthName(start).toLowerCase()}` : 'del periodo';
  const compare = (key: 'revenue' | 'result') => {
    const change = kpiChange(total, previous, key);
    if (!change || !comparisonLabel) return { text: null, direction: change ? change.direction : null };
    const signed = (change.delta > 0 ? '+' : '') + money(change.delta);
    return { text: `${signed}${change.relative === null ? '' : ` · ${percent(change.relative)}`} ${comparisonLabel}`, direction: change.direction };
  };
  const revenue = compare('revenue'), profit = compare('result');
  return {
    kicker: `Facturación ${subject}${partial ? ' · en curso' : ''}`,
    revenue: money(total.revenue),
    profit: money(total.result),
    sentence: `Los gastos suman ${money(total.expense)}${total.margin === null ? '' : `; el margen es del ${percent(total.margin)}`}.`,
    revenueCompare: revenue.text, revenueDirection: revenue.direction,
    profitCompare: profit.text, profitDirection: profit.direction,
    tone: total.result < 0 ? 'loss' : total.result === 0 ? 'flat' : 'gain',
  };
}

export interface StripBar { start: string; label: string; revenue: number; result: number; height: number; profitHeight: number; loss: boolean; selected: boolean }
// Bar height is the month's billing on a zero-based scale shared by all months;
// the darker part of each bar is the profit that remains from it. With `zoom` the
// scale starts below the smallest month so close figures can be told apart; the
// profit part is then dropped because it would no longer be proportional.
export const ZOOM_FLOOR = 0.8;
export function stripBars(rows: { start: string; revenue: number; result: number }[], selectedMonth: string, zoom = false): StripBar[] {
  const peak = Math.max(1, ...rows.map(row => row.revenue));
  const positive = rows.map(row => row.revenue).filter(value => value > 0);
  const floor = zoom && positive.length ? Math.min(...positive) * ZOOM_FLOOR : 0;
  const span = Math.max(1, peak - floor);
  return rows.map(row => {
    const height = row.revenue <= 0 ? 2 : zoom ? Math.max(6, (row.revenue - floor) / span * 100) : Math.max(6, row.revenue / peak * 100);
    return {
      start: row.start, revenue: row.revenue, result: row.result, loss: row.result < 0, selected: row.start.slice(0, 7) === selectedMonth,
      height, profitHeight: !zoom && row.result > 0 ? Math.min(height, Math.max(2, row.result / peak * 100)) : 0,
      label: new Intl.DateTimeFormat('es-ES', { month: 'short', timeZone: 'Europe/Madrid' }).format(new Date(row.start + 'T12:00:00Z')).replace('.', ''),
    };
  });
}
