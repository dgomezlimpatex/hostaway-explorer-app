import { useMemo, useState, type ReactNode } from 'react';
import { ChevronRight, SlidersHorizontal } from 'lucide-react';
import './financialTheme.css';
import { FinancialHelp } from './FinancialHelp';
import { financialName, money, percent } from './financialFormat';
import { firstReviewKind, reviewLists, type ReviewKind } from './financialReviewRows';
import type { AlertRules } from './financialAnalytics';
import type { FinancialAnalysis } from './financialCharts';
import type { CalculatedService, FinancialService } from './financialModel';
import type { DirectoryEntry } from './financialSource';

const VISIBLE = 8;
const shortDate = (date: string) => date.split('-').reverse().join('/');
const rowClass = 'fin-focus flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[var(--fin-sunk)]';
const field = 'fin-focus h-10 w-full rounded-lg border border-[var(--fin-line)] bg-[var(--fin-surface)] px-3 text-sm';

// One inbox for everything that needs a person: thin services, pending costs,
// services outside the balance and clients below the margin threshold.
export function FinancialReview({ result, rules, today, clients, onRules, onClient, onEdit, onIncomes, onExcluded }: {
  result: FinancialAnalysis; rules: AlertRules; today: string; clients: DirectoryEntry[]; onRules: (rules: AlertRules) => void;
  onClient: (id: string) => void; onEdit: (service: CalculatedService) => void; onIncomes: () => void; onExcluded: (service: FinancialService) => void;
}) {
  const lists = useMemo(() => reviewLists(result, rules, today), [result, rules, today]);
  const [picked, setPicked] = useState<ReviewKind | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const kind = picked ?? firstReviewKind(lists.counts);
  const choose = (next: ReviewKind) => { setPicked(next); setExpanded(false); };
  const tabs: [ReviewKind, string][] = [['low', 'Margen bajo o negativo'], ['pending', 'Costes pendientes'], ['excluded', 'Fuera del balance'], ['clients', 'Clientes con margen bajo']];
  const total = lists.counts.low + lists.counts.pending + lists.counts.excluded + lists.counts.clients;
  const ageBadge = (age: number | null) => age !== null && <span className="ml-2 rounded-full bg-[var(--fin-sunk)] px-2 py-0.5 text-[11px] font-medium text-[var(--fin-expense-ink)]">hace {age} días</span>;
  const serviceRow = (service: CalculatedService, extra?: { age: number | null; reasons: string[] }) => <li key={service.id}>
    <button type="button" onClick={() => onEdit(service)} className={rowClass}>
      <span className="min-w-0"><strong className="block truncate text-sm">{financialName(service.propertyName)}{extra && ageBadge(extra.age)}</strong>
        <span className="fin-muted block text-xs">{shortDate(service.date)} · {financialName(service.clientName)}</span>
        {extra && extra.reasons.length > 0 && <span className="block text-xs text-[var(--fin-expense-ink)]">{extra.reasons.join(' · ')}</span>}</span>
      <span className="flex shrink-0 items-center gap-2 text-right"><span><strong className={`block text-sm tabular-nums ${(service.result ?? 0) < 0 ? 'text-[var(--fin-loss)]' : ''}`}>{money(service.result ?? 0)}</strong>
        <span className="fin-muted block text-xs tabular-nums">{service.revenue ? percent((service.result ?? 0) / service.revenue * 100) : '—'}</span></span>
        <span className="fin-muted hidden items-center text-xs sm:inline-flex">Revisar<ChevronRight aria-hidden className="h-4 w-4" /></span></span>
    </button></li>;
  const rows: ReactNode[] = kind === 'low' ? lists.low.map(service => serviceRow(service))
    : kind === 'pending' ? [...lists.pendingServices.map(({ service, age }) => serviceRow(service, { age, reasons: service.pending })),
      ...lists.pendingIncomes.map(({ income, age }) => <li key={income.id}><button type="button" onClick={onIncomes} className={rowClass}><span className="min-w-0"><strong className="block truncate text-sm">{financialName(income.propertyName)}{ageBadge(age)}</strong><span className="block text-xs text-[var(--fin-expense-ink)]">Coste externo pendiente</span></span><ChevronRight aria-hidden className="fin-muted h-4 w-4 shrink-0" /></button></li>)]
    : kind === 'excluded' ? lists.excluded.map(service => <li key={service.id}><button type="button" onClick={() => onExcluded(service)} className={rowClass}>
        <span className="min-w-0"><strong className="block truncate text-sm">{financialName(service.propertyName)}</strong><span className="fin-muted block text-xs">{shortDate(service.date)}</span></span>
        <strong className="shrink-0 text-sm">{service.revenue === null ? 'Precio pendiente' : 'Sin ingreso'}</strong></button></li>)
    : lists.clients.map(row => <li key={row.id}><button type="button" onClick={() => onClient(row.id)} className={rowClass}>
        <span className="min-w-0 truncate text-sm font-semibold">{financialName(clients.find(entry => entry.id === row.id)?.name || row.name)}</span>
        <span className="shrink-0 text-right text-sm tabular-nums"><strong className="block">{percent(row.margin)}</strong><span className="fin-muted block text-xs">{money(row.result)}</span></span></button></li>);
  const shown = expanded ? rows : rows.slice(0, VISIBLE);
  const empty = { low: 'No hay servicios con pérdidas o margen inferior al 10 % entre los costes incluidos.', pending: 'No hay costes pendientes identificados en los registros incluidos.', excluded: rules.zero ? 'No hay servicios excluidos por falta de ingresos.' : 'No hay servicios con precio pendiente. El aviso de ingreso cero está desactivado.', clients: 'Ningún cliente está por debajo del margen indicado.' }[kind];
  return <section aria-label="Qué revisar" className="min-w-0 space-y-4 rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-surface)] p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="fin-display text-2xl font-bold">Qué revisar</h2><p role="status" className="fin-muted mt-0.5 text-sm">{total ? `${total} avisos en este periodo` : 'Todo en orden en este periodo'} · se calculan con los filtros activos y no envían notificaciones</p></div>
      <div className="flex items-center gap-2">
        <button type="button" aria-expanded={adjusting} aria-controls="financial-review-rules" onClick={() => setAdjusting(value => !value)} className="fin-focus inline-flex h-9 items-center gap-2 rounded-full border border-[var(--fin-line)] px-3 text-[13px] font-medium hover:bg-[var(--fin-sunk)]"><SlidersHorizontal aria-hidden className="h-4 w-4" />Ajustar avisos</button>
        <FinancialHelp section="Qué revisar"><p>Avisos locales del análisis y de sus filtros; los umbrales se guardan para esta cuenta y sede en este navegador.</p><p>La antigüedad se cuenta desde la fecha del servicio, en días naturales de Madrid. Un servicio sin ingreso o con precio pendiente no suma ingresos ni costes: un precio pendiente debe revisarse, no implica que sea gratuito.</p></FinancialHelp>
      </div>
    </div>
    {adjusting && <div id="financial-review-rules" className="fin-rise grid items-end gap-3 rounded-2xl bg-[var(--fin-sunk)]/60 p-4 sm:grid-cols-3">
      <label className="text-sm">Avisar si el margen del cliente es inferior a (%)<input type="number" min="-100" max="100" step="0.1" className={`${field} mt-1`} value={rules.margin} onChange={event => { const margin = Number(event.target.value); if (event.target.value !== '' && Number.isFinite(margin) && margin >= -100 && margin <= 100) onRules({ ...rules, margin }); }} /></label>
      <label className="text-sm">Costes pendientes con más de (días)<input type="number" min="0" max="3650" step="1" className={`${field} mt-1`} value={rules.days} onChange={event => { const days = Number(event.target.value); if (event.target.value !== '' && Number.isInteger(days) && days >= 0 && days <= 3650) onRules({ ...rules, days }); }} /></label>
      <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[var(--fin-ink)]" checked={rules.zero} onChange={event => onRules({ ...rules, zero: event.target.checked })} />Avisar de servicios con ingreso cero</label>
    </div>}
    <div role="group" aria-label="Tipo de aviso" className="flex flex-wrap gap-2">{tabs.map(([id, label]) => <button key={id} type="button" aria-pressed={kind === id} onClick={() => choose(id)}
      className={`fin-focus rounded-full border px-3 py-1 text-[13px] transition-colors ${kind === id ? 'border-[var(--fin-ink)] bg-[var(--fin-ink)] text-white' : 'border-[var(--fin-line)] hover:bg-[var(--fin-sunk)]'}`}>{label} · {lists.counts[id]}</button>)}</div>
    {kind === 'excluded' && <p className="fin-muted text-sm">{lists.zero} con ingreso cero · {lists.unpriced} con precio pendiente. Estas tareas no aportan ingresos ni costes de personal, lavandería, consumibles o productos.{!rules.zero && ' Aviso desactivado.'}</p>}
    {kind === 'pending' && <p className="fin-muted text-sm">Antiguos (más de {rules.days} días): {lists.old}. El resultado es provisional mientras falten costes; un servicio puede aparecer en varias listas.</p>}
    {shown.length ? <ul className="space-y-0.5">{shown}</ul> : <p className="fin-muted py-4 text-sm">{empty}</p>}
    {rows.length > VISIBLE && <button type="button" onClick={() => setExpanded(value => !value)} className="fin-focus rounded-full border border-[var(--fin-line)] px-4 py-1.5 text-sm font-medium hover:bg-[var(--fin-sunk)]">{expanded ? 'Ver menos' : `Ver todos (${rows.length})`}</button>}
  </section>;
}
