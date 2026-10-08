import type { Summary } from './financialModel';
export type ClientRow = Summary & { id: string; name: string };
export type ClientSort = 'name' | 'revenue' | 'expense' | 'result' | 'margin' | keyof Summary['costs'];
export function sortFinancialClients<T extends ClientRow>(rows: T[], key: ClientSort, descending: boolean): T[] {
  const value = (row: ClientRow) => key in row.costs ? row.costs[key as keyof Summary['costs']] : row[key as 'name' | 'revenue' | 'expense' | 'result' | 'margin'];
  return [...rows].sort((a, b) => {
    const first = value(a), second = value(b);
    if (first === null || second === null) return first === second ? a.id.localeCompare(b.id) : first === null ? 1 : -1;
    const diff = typeof first === 'string' && typeof second === 'string' ? first.localeCompare(second, 'es', { sensitivity: 'base', numeric: true }) : Number(first) - Number(second);
    return (descending ? -diff : diff) || a.name.localeCompare(b.name, 'es') || a.id.localeCompare(b.id);
  });
}
