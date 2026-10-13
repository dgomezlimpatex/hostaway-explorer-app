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
  const levels: number[] = [0, total.revenue, total.result];
  let running = total.revenue;
  const spans = visible.map(id => { const before = running; running -= costs[id]; levels.push(running); return { id, before, after: running }; });
  const min = Math.min(...levels), max = Math.max(...levels), range = max - min || 1;
  const pos = (value: number) => (value - min) / range * 100;
  const geometry = (a: number, b: number) => {
    const left = pos(Math.min(a, b)), width = Math.abs(pos(a) - pos(b));
    return { left, width: a === b ? 0 : Math.max(width, MIN_WIDTH) };
  };
  const rows: WaterfallRow[] = [
    { id: 'revenue', label: 'Ingresos', kind: 'income', amount: total.revenue, ...geometry(0, total.revenue), origin: 'left', share: null },
    ...spans.map(span => ({ id: span.id, label: costLabels[span.id], kind: 'expense' as const, amount: costs[span.id], ...geometry(span.before, span.after),
      origin: 'right' as const, share: total.revenue > 0 ? costs[span.id] / total.revenue * 100 : null })),
    { id: 'result', label: 'Resultado', kind: 'result', amount: total.result, ...geometry(0, total.result), origin: total.result < 0 ? 'right' : 'left', share: total.revenue > 0 ? total.result / total.revenue * 100 : null },
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

export interface MonthHeadline { kicker: string; value: string; sentence: string; compare: string | null; tone: 'gain' | 'loss' | 'flat'; direction: 'better' | 'worse' | 'same' | null }
export function monthHeadline(input: { total: Summary; previous: Summary | null; start: string; singleMonth: boolean; partial: boolean; comparisonLabel: string | null }): MonthHeadline {
  const { total, previous, start, singleMonth, partial, comparisonLabel } = input;
  const change = kpiChange(total, previous, 'result');
  const subject = singleMonth ? `de ${monthName(start).toLowerCase()}` : 'del periodo';
  const signed = (text: string) => (change && change.delta > 0 ? '+' : '') + text;
  return {
    kicker: `Resultado ${subject}${partial ? ' · en curso' : ''}`,
    value: money(total.result),
    sentence: `Entran ${money(total.revenue)} y salen ${money(total.expense)}${total.margin === null ? '' : `; el margen es del ${percent(total.margin)}`}.`,
    compare: change && comparisonLabel ? `${signed(money(change.delta))}${change.relative === null ? '' : ` · ${percent(change.relative)}`} ${comparisonLabel}` : null,
    tone: total.result < 0 ? 'loss' : total.result === 0 ? 'flat' : 'gain',
    direction: change ? change.direction : null,
  };
}

export interface StripBar { start: string; label: string; result: number; height: number; negative: boolean; selected: boolean }
export function stripBars(rows: { start: string; result: number }[], selectedMonth: string): StripBar[] {
  const peak = Math.max(1, ...rows.map(row => Math.abs(row.result)));
  return rows.map(row => ({
    start: row.start, result: row.result, negative: row.result < 0, selected: row.start.slice(0, 7) === selectedMonth,
    height: row.result === 0 ? 4 : Math.max(8, Math.abs(row.result) / peak * 100),
    label: new Intl.DateTimeFormat('es-ES', { month: 'short', timeZone: 'Europe/Madrid' }).format(new Date(row.start + 'T12:00:00Z')).replace('.', ''),
  }));
}
