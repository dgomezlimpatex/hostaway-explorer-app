import { financialName } from './financialFormat';
import type { ClientRow } from './financialClientSorting';
import type { Summary } from './financialModel';

export type Quick = 'all' | 'loss' | 'low' | 'pending';
export const LOW_MARGIN = 10;
// Direction and structure (the management salary) is a Personnel expense of the company, not of
// a client or a property: the ledger shows activity before it, the summary shows it in Personnel.
export function withoutStructure<T extends Pick<Summary, 'revenue' | 'costs' | 'expense' | 'result' | 'margin'>>(row: T): T {
  const salary = row.costs.salary, expense = row.expense - salary, result = row.revenue - expense;
  return { ...row, costs: { ...row.costs, salary: 0 }, expense, result, margin: row.revenue > 0 ? result / row.revenue * 100 : null };
}
export const isLoss = (row: ClientRow) => row.result < 0;
export const isLow = (row: ClientRow) => row.revenue > 0 && row.margin !== null && row.margin < LOW_MARGIN;
export const isPending = (row: ClientRow) => row.pending > 0;

export function quickCounts(rows: ClientRow[]): Record<Quick, number> {
  return { all: rows.length, loss: rows.filter(isLoss).length, low: rows.filter(isLow).length, pending: rows.filter(isPending).length };
}
// A row is shown when it matches the quick filter and the typed name (accents and case ignored).
export function filterProfitability(rows: ClientRow[], quick: Quick, query: string): ClientRow[] {
  const accents = new RegExp('[\\u0300-\\u036f]', 'g');
  const fold = (text: string) => financialName(text).normalize('NFD').replace(accents, '').toLowerCase();
  const needle = fold(query.trim());
  return rows.filter(row => (quick === 'all' || quick === 'loss' && isLoss(row) || quick === 'low' && isLow(row) || quick === 'pending' && isPending(row)) && fold(row.name).includes(needle));
}
