import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Search, TrendingDown } from 'lucide-react';
import './financialTheme.css';
import { financialName, money, percent } from './financialFormat';
import { FinancialHelp } from './FinancialHelp';
import { sortFinancialClients, type ClientRow, type ClientSort } from './financialClientSorting';
import { propertyResults } from './financialAnalytics';
import type { FinancialAnalysis } from './financialCharts';
import type { DirectoryEntry } from './financialSource';
import { filterProfitability, LOW_MARGIN, quickCounts, withoutStructure, type Quick } from './financialProfitabilityRows';

type Mode = 'clients' | 'properties';
const VISIBLE_ROWS = 10;

// One ledger for "who gives me money and who takes it": clients or properties,
// sorted by what matters, with billing/profit drawn the same way as the month strip.
export function FinancialProfitability({ result, clients, properties, onClient, onProperty }: {
  result: FinancialAnalysis; clients: DirectoryEntry[]; properties: DirectoryEntry[]; onClient: (id: string) => void; onProperty: (id: string) => void;
}) {
  const [mode, setMode] = useState<Mode>('clients');
  const [sort, setSort] = useState<{ key: ClientSort; descending: boolean }>({ key: 'result', descending: true });
  const [quick, setQuick] = useState<Quick>('all');
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const all = useMemo<ClientRow[]>(() => mode === 'clients'
    ? result.clients.map(row => withoutStructure({ ...row, name: financialName(clients.find(entry => entry.id === row.id)?.name || row.name) }))
    : propertyResults(result, properties).map(row => withoutStructure({ ...row, name: financialName(row.name) })), [mode, result, clients, properties]);
  const total = withoutStructure(result.total);
  const peak = Math.max(1, ...all.map(row => row.revenue));
  const counts = quickCounts(all);
  const filtered = filterProfitability(all, quick, query);
  const ordered = sortFinancialClients(filtered, sort.key, sort.descending);
  const shown = showAll ? ordered : ordered.slice(0, VISIBLE_ROWS);
  const noun = mode === 'clients' ? 'clientes' : 'propiedades';
  const unassigned = mode === 'clients' ? withoutStructure(result.general) : {
    ...total, revenue: total.revenue - all.reduce((sum, row) => sum + row.revenue, 0), expense: total.expense - all.reduce((sum, row) => sum + row.expense, 0),
    result: total.result - all.reduce((sum, row) => sum + row.result, 0), margin: null,
  };
  const choose = (next: Mode) => { setMode(next); setQuick('all'); setQuery(''); setShowAll(false); };
  const header = (key: ClientSort, label: string, className = '') => {
    const active = sort.key === key, Icon = !active ? ArrowUpDown : sort.descending ? ArrowDown : ArrowUp;
    return <th scope="col" aria-sort={active ? sort.descending ? 'descending' : 'ascending' : 'none'} className={`p-2 font-medium ${className}`}>
      <button type="button" aria-label={`Ordenar por ${label}`} onClick={() => { setSort({ key, descending: active ? !sort.descending : key !== 'name' }); setShowAll(false); }}
        className={`fin-focus inline-flex items-center gap-1.5 rounded ${active ? 'text-[var(--fin-ink)]' : 'fin-muted'} hover:text-[var(--fin-ink)]`}>{label}<Icon aria-hidden className="h-3.5 w-3.5" /></button></th>;
  };
  const chips: [Quick, string][] = [['all', 'Todos'], ['loss', 'Con pérdidas'], ['low', `Margen bajo (<${LOW_MARGIN} %)`], ['pending', 'Datos pendientes']];
  const resultCell = (row: { result: number }) => <span className={`inline-flex items-center justify-end gap-1 font-semibold ${row.result < 0 ? 'text-[var(--fin-loss)]' : 'text-[var(--fin-gain)]'}`}>{row.result < 0 && <TrendingDown aria-hidden className="h-3.5 w-3.5" />}{money(row.result)}</span>;
  return <section aria-label="Rentabilidad" className="min-w-0 space-y-4 rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-surface)] p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="fin-display text-2xl font-bold">Rentabilidad</h2><p role="status" className="sr-only">{all.length} {noun} con actividad · sin IVA</p></div>
      <div className="flex items-center gap-2">
        <div role="group" aria-label="Agrupar por" className="inline-flex rounded-full border border-[var(--fin-line)] bg-[var(--fin-bg)] p-1">{([['clients', 'Clientes'], ['properties', 'Propiedades']] as const).map(([id, label]) =>
          <button key={id} type="button" aria-pressed={mode === id} onClick={() => choose(id)} className={`fin-focus rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${mode === id ? 'bg-[var(--fin-ink)] text-white' : 'fin-muted hover:text-[var(--fin-ink)]'}`}>{label}</button>)}</div>
        <FinancialHelp section="Rentabilidad"><p>Facturación, gastos y beneficio sin IVA de cada {mode === 'clients' ? 'cliente' : 'propiedad'}. La barra es la facturación; su parte oscura, el beneficio que queda.</p>
          <p>El margen se pondera por ingresos, no es una media de porcentajes. Los gastos generales siguen la opción de reparto elegida y el remanente se muestra aparte.</p>
          <p>Pulsa una fila para ver sus servicios e ingresos externos.</p>
          <p>No incluye la dirección y estructura (el salario de dirección): es un gasto de Personal de la empresa y se ve en el resumen, no en un cliente ni en una propiedad.</p></FinancialHelp>
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      {chips.map(([id, label]) => <button key={id} type="button" aria-pressed={quick === id} onClick={() => { setQuick(id); setShowAll(false); }}
        className={`fin-focus rounded-full border px-3 py-1 text-[13px] transition-colors ${quick === id ? 'border-[var(--fin-ink)] bg-[var(--fin-ink)] text-white' : 'border-[var(--fin-line)] hover:bg-[var(--fin-sunk)]'}`}>{label} · {counts[id]}</button>)}
      {all.length > 8 && <label className="relative ml-auto block w-full sm:w-56"><Search aria-hidden className="fin-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" /><span className="sr-only">Buscar {noun}</span>
        <input value={query} onChange={event => { setQuery(event.target.value); setShowAll(false); }} placeholder={`Buscar ${mode === 'clients' ? 'cliente' : 'propiedad'}`} className="fin-focus h-9 w-full rounded-full border border-[var(--fin-line)] bg-[var(--fin-surface)] pl-9 pr-3 text-sm" /></label>}
    </div>
    <div className="overflow-x-auto"><table className="w-full text-[13px] sm:text-sm [&_td]:px-1.5 [&_th]:px-1.5 sm:[&_td]:px-2 sm:[&_th]:px-2"><caption className="sr-only">Facturación, gastos y beneficio por {mode === 'clients' ? 'cliente' : 'propiedad'} sin IVA</caption>
      <thead><tr className="border-b border-[var(--fin-line)] text-left text-xs">{header('name', mode === 'clients' ? 'Cliente' : 'Propiedad')}{header('revenue', 'Facturación', 'w-[34%]')}{header('expense', 'Gastos', 'hidden text-right sm:table-cell')}{header('result', 'Beneficio', 'text-right')}{header('margin', 'Margen', 'hidden text-right sm:table-cell')}</tr></thead>
      <tbody>{shown.map(row => <tr key={row.id} className="border-b border-[var(--fin-line)]/70 transition-colors hover:bg-[var(--fin-sunk)]/50">
        <th scope="row" className="max-w-[6.5rem] p-2 text-left font-medium sm:max-w-[16rem]"><button type="button" onClick={() => (mode === 'clients' ? onClient : onProperty)(row.id)} aria-label={`Ver detalle de ${row.name} · ${money(row.result)}${row.pending ? ' · Datos pendientes' : ''}`}
          className="fin-focus block w-full truncate rounded text-left hover:underline">{row.name}</button></th>
        <td className="p-2"><span className="block text-right tabular-nums sm:text-left">{money(row.revenue)}</span>
          <span aria-hidden="true" className="mt-1 hidden h-1.5 overflow-hidden rounded-full bg-[var(--fin-sunk)] sm:block"><span className="relative block h-full rounded-full" style={{ width: `${Math.max(2, row.revenue / peak * 100)}%`, background: row.result < 0 ? 'var(--fin-loss)' : 'var(--fin-income)' }}>
            <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${row.revenue > 0 ? Math.min(100, Math.max(0, row.result) / row.revenue * 100) : 0}%`, background: 'var(--fin-income-ink)' }} /></span></span></td>
        <td className="hidden p-2 text-right tabular-nums sm:table-cell">{money(row.expense)}</td>
        <td className="p-2 text-right tabular-nums">{resultCell(row)}</td>
        <td className="hidden p-2 text-right tabular-nums sm:table-cell">{percent(row.margin)}</td>
      </tr>)}
      {!shown.length && <tr><td colSpan={5} className="fin-muted p-6 text-center">Ningún {mode === 'clients' ? 'cliente' : 'propiedad'} coincide con estos filtros.</td></tr>}</tbody>
      <tfoot className="text-sm"><tr className="border-b border-[var(--fin-line)]/70"><th scope="row" className="fin-muted p-2 text-left font-medium">{mode === 'clients' ? 'Actividad general · sin repartir' : 'Sin propiedad asignada'}</th><td className="p-2 tabular-nums">{money(unassigned.revenue)}</td><td className="hidden p-2 text-right tabular-nums sm:table-cell">{money(unassigned.expense)}</td><td className="p-2 text-right tabular-nums">{resultCell(unassigned)}</td><td className="hidden p-2 sm:table-cell" /></tr>
        <tr className="font-bold"><th scope="row" className="p-2 text-left">Total de la actividad</th><td className="p-2 tabular-nums">{money(total.revenue)}</td><td className="hidden p-2 text-right tabular-nums sm:table-cell">{money(total.expense)}</td><td className="p-2 text-right tabular-nums">{resultCell(total)}</td><td className="hidden p-2 text-right tabular-nums sm:table-cell">{percent(total.margin)}</td></tr></tfoot>
    </table></div>
    {ordered.length > VISIBLE_ROWS && <button type="button" onClick={() => setShowAll(value => !value)} className="fin-focus rounded-full border border-[var(--fin-line)] px-4 py-1.5 text-sm font-medium hover:bg-[var(--fin-sunk)]">{showAll ? 'Ver menos' : `Ver todos (${ordered.length})`}</button>}
  </section>;
}
