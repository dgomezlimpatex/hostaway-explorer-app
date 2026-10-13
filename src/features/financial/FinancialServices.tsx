import { useMemo, useState } from 'react';
import { CheckCircle2, ChevronRight, CircleAlert, Search, TrendingDown } from 'lucide-react';
import './financialTheme.css';
import { financialName, money, percent } from './financialFormat';
import type { FinancialAnalysis } from './financialCharts';
import type { CalculatedService } from './financialModel';
import { matchesProfit, type ProfitFilter } from './financialServiceFilter';

const STEP = 50;
const dateText = (date: string) => date.split('-').reverse().join('/');
const filters: [ProfitFilter, string][] = [['all', 'Todos los servicios'], ['negative', 'Resultado negativo'], ['low', 'Margen inferior al 10%']];

// The ledger behind every figure: one row per service with what it billed and what it cost.
export function FinancialServices({ result, filter, onFilter, onProperty, onEdit }: {
  result: FinancialAnalysis; filter: ProfitFilter; onFilter: (filter: ProfitFilter) => void; onProperty: (propertyId: string) => void; onEdit: (service: CalculatedService) => void;
}) {
  const [query, setQuery] = useState(''), [limit, setLimit] = useState(STEP);
  const counts = useMemo(() => ({ all: result.services.length, negative: result.services.filter(service => matchesProfit(service, 'negative')).length, low: result.services.filter(service => matchesProfit(service, 'low')).length }), [result.services]);
  const needle = query.trim().toLowerCase();
  const rows = result.services.filter(service => matchesProfit(service, filter)
    && (!needle || [service.propertyName, service.clientName, ...service.workers.map(worker => worker.name)].some(text => financialName(text).toLowerCase().includes(needle))));
  const shown = rows.slice(0, limit);
  const head = 'p-2 font-medium';
  return <section aria-label="Servicios" className="min-w-0 space-y-4 rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-surface)] p-5 sm:p-6">
    <div><h2 className="fin-display text-2xl font-bold">Servicios · origen de cada importe</h2>
      <p className="fin-muted mt-0.5 text-sm">{rows.length} de {result.services.length} servicios contabilizados · sin IVA</p></div>
    <div className="flex flex-wrap items-center gap-2">
      {filters.map(([id, label]) => <button key={id} type="button" aria-pressed={filter === id} onClick={() => { onFilter(id); setLimit(STEP); }}
        className={`fin-focus inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[13px] transition-colors ${filter === id ? 'border-[var(--fin-ink)] bg-[var(--fin-ink)] text-white' : 'border-[var(--fin-line)] hover:bg-[var(--fin-sunk)]'}`}>{label}<span aria-hidden="true" className="tabular-nums opacity-70">{counts[id]}</span></button>)}
      {result.services.length > 8 && <label className="relative ml-auto block w-full sm:w-64"><Search aria-hidden className="fin-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" /><span className="sr-only">Buscar servicios</span>
        <input value={query} onChange={event => { setQuery(event.target.value); setLimit(STEP); }} placeholder="Propiedad, cliente o persona" className="fin-focus h-9 w-full rounded-full border border-[var(--fin-line)] bg-[var(--fin-surface)] pl-9 pr-3 text-sm" /></label>}
    </div>
    {!rows.length ? <p className="fin-muted py-8 text-center">No hay servicios contabilizables con estos filtros.</p> : <div className="overflow-x-auto"><table className="w-full text-[13px] sm:text-sm [&_td]:px-1.5 [&_th]:px-1.5 sm:[&_td]:px-2 sm:[&_th]:px-2">
      <thead><tr className="border-b border-[var(--fin-line)] text-left text-xs text-[var(--fin-muted)]">
        <th scope="col" className={head}>Fecha / propiedad</th><th scope="col" className={`${head} hidden md:table-cell`}>Cliente / equipo</th><th scope="col" className={`${head} text-right`}>Facturación</th>
        {['Personal', 'Lavandería', 'Consumibles', 'Productos'].map(title => <th key={title} scope="col" className={`${head} hidden text-right lg:table-cell`}>{title}</th>)}
        <th scope="col" className={`${head} text-right`}>Beneficio</th><th scope="col" className={`${head} hidden text-right sm:table-cell`}>Margen</th><th scope="col" className={`${head} text-right`}><span className="sr-only sm:not-sr-only">Revisión</span><span className="sm:hidden" aria-hidden="true">Rev.</span></th></tr></thead>
      <tbody>{shown.map(service => {
        const status = service.pending.length ? 'Datos pendientes' : service.estimated ? 'Estimado' : 'Revisado';
        const loss = service.result !== null && service.result < 0;
        return <tr key={service.id} className="border-b border-[var(--fin-line)]/70 align-top transition-colors hover:bg-[var(--fin-sunk)]/50">
          <td className="p-2 tabular-nums"><span className="fin-muted block text-xs"><span className="sm:hidden">{dateText(service.date).slice(0, 5)}</span><span className="hidden sm:inline">{dateText(service.date)}</span></span>
            <button type="button" className="fin-focus rounded text-left font-semibold hover:underline disabled:no-underline" onClick={() => onProperty(service.propertyId)} disabled={!service.propertyId}>{service.propertyName}</button>
            <span className="fin-muted hidden text-xs sm:block md:hidden">{financialName(service.clientName)}</span></td>
          <td className="hidden p-2 md:table-cell">{service.clientName}<span className="fin-muted block text-xs">{service.workers.map(worker => worker.name).join(', ') || 'Sin asignar'}</span></td>
          <td className="p-2 text-right tabular-nums">{service.revenue === null ? <span className="text-[var(--fin-expense-ink)]">Pendiente</span> : money(service.revenue)}</td>
          {[service.costs.personal, service.costs.laundry, service.costs.supplies, service.costs.products].map((value, index) => <td key={index} className="fin-muted hidden p-2 text-right tabular-nums lg:table-cell">{money(value)}</td>)}
          <td className={`p-2 text-right font-semibold tabular-nums ${service.result === null ? 'fin-muted' : loss ? 'text-[var(--fin-loss)]' : 'text-[var(--fin-gain)]'}`}><span className="inline-flex items-center justify-end gap-1">{loss && <TrendingDown aria-hidden className="h-3.5 w-3.5" />}{service.result === null ? '—' : money(service.result)}</span></td>
          <td className="hidden p-2 text-right tabular-nums sm:table-cell">{service.revenue ? percent((service.result || 0) / service.revenue * 100) : '—'}</td>
          <td className="p-2 text-right"><button type="button" aria-label="Revisar costes" onClick={() => onEdit(service)} className="fin-focus inline-flex h-8 items-center gap-1 rounded-full border border-[var(--fin-line)] px-2.5 text-[13px] font-medium hover:bg-[var(--fin-sunk)] sm:px-3"><span className="sm:hidden">Revisar</span><span className="hidden sm:inline">Revisar costes</span><ChevronRight aria-hidden className="h-3.5 w-3.5" /></button>
            <span className={`mt-1 flex items-center justify-end gap-1 text-xs ${status === 'Datos pendientes' ? 'text-[var(--fin-expense-ink)]' : 'fin-muted'}`}>{status === 'Revisado' ? <CheckCircle2 aria-hidden className="h-3.5 w-3.5" /> : <CircleAlert aria-hidden className="h-3.5 w-3.5" />}<span className="sr-only sm:not-sr-only">{status}</span></span></td>
        </tr>;
      })}</tbody></table></div>}
    {rows.length > limit && <button type="button" onClick={() => setLimit(value => value + STEP)} className="fin-focus rounded-full border border-[var(--fin-line)] px-4 py-1.5 text-sm font-medium hover:bg-[var(--fin-sunk)]">Mostrar {Math.min(STEP, rows.length - limit)} más · quedan {rows.length - limit}</button>}
  </section>;
}

export function FinancialExternalIncomes({ result, onManage }: { result: FinancialAnalysis; onManage: () => void }) {
  if (!result.incomes.length) return null;
  return <section aria-label="Ingresos externos" className="min-w-0 rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-surface)] p-5 sm:p-6">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="fin-display text-xl font-bold">Ingresos externos de esta selección</h2>
      <button type="button" onClick={onManage} className="fin-focus inline-flex h-9 items-center gap-1 rounded-full border border-[var(--fin-line)] px-4 text-sm font-medium hover:bg-[var(--fin-sunk)]">Gestionar ingresos<ChevronRight aria-hidden className="h-4 w-4" /></button></div>
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-[var(--fin-line)] text-left text-xs text-[var(--fin-muted)]">{['Concepto', 'Ingresos', 'Gastos', 'Resultado provisional'].map((label, index) => <th key={label} scope="col" className={`p-2 font-medium ${index ? 'text-right' : ''}`}>{label}</th>)}</tr></thead>
      <tbody>{result.incomes.map(row => <tr key={row.id} className="border-b border-[var(--fin-line)]/70"><th scope="row" className="p-2 text-left font-medium">{financialName(row.propertyName)}<span className="fin-muted block text-xs font-normal">{row.date.slice(0, 7)}{row.pending.length > 0 && ' · Coste pendiente'}</span></th>
        <td className="p-2 text-right tabular-nums">{money(row.revenue ?? 0)}</td><td className="p-2 text-right tabular-nums">{money(row.expense)}</td><td className="p-2 text-right font-semibold tabular-nums">{money(row.result ?? 0)}</td></tr>)}</tbody></table></div>
    <p className="fin-muted mt-3 text-xs">Los fijos mensuales se prorratean por los días seleccionados. Estos importes ya están incluidos en el resumen.</p>
  </section>;
}
