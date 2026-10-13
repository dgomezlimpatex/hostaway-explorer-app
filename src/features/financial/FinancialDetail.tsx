import { useEffect, useMemo, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import './financialTheme.css';
import { financialDetail, isIncomeConcept } from './financialDrilldown';
import { money, type FinancialAnalysis } from './financialCharts';
import type { FinancialDetailConcept } from './financialView';
import type { Filters, FinanceSettings } from './financialModel';
import type { DirectoryEntry } from './financialSource';

import { financialName } from './financialFormat';

const sourceNames = { services: 'Servicios', incomes: 'Ingresos externos', expenses: 'Gastos adicionales y dirección' };
export function FinancialDetail({ result, settings, concept, filters, clients, onBack }: {
  result: FinancialAnalysis; settings: FinanceSettings; concept: FinancialDetailConcept; filters: Filters; clients: DirectoryEntry[]; onBack: () => void;
}) {
  const detail = useMemo(() => financialDetail(result, concept, settings), [result, concept, settings]);
  const income = isIncomeConcept(concept);
  const sources = income ? sourceNames : { ...sourceNames, services: 'Costes de servicios', incomes: 'Costes de ingresos externos' };
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [concept]);
  return <section className="min-w-0 rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-surface)] p-5 sm:p-6" aria-label="Desglose del gráfico">
    <button type="button" onClick={onBack} className="fin-focus inline-flex h-10 items-center gap-2 rounded-full border border-[var(--fin-line)] px-4 text-sm font-medium hover:bg-[var(--fin-sunk)]"><ArrowLeft aria-hidden className="h-4 w-4" />Volver al gráfico</button>
    <div className="my-5 flex flex-wrap items-start justify-between gap-3"><div>
      <h2 ref={heading} tabIndex={-1} className="fin-display text-2xl font-bold">{concept === 'result' ? 'Resultado' : income ? 'Ingresos' : 'Gastos'} · desglose{concept !== 'revenue' && concept !== 'result' && ` · ${financialName(detail.label)}`}</h2>
      <p className="fin-muted mt-1 text-sm">{filters.start.split('-').reverse().join('/')} – {filters.end.split('-').reverse().join('/')} · Mismos filtros del análisis · Sin IVA</p>
    </div><div className="rounded-2xl bg-[var(--fin-sunk)] px-5 py-3 text-right"><p className="fin-muted text-xs">Total del concepto</p><strong className="fin-display text-3xl tabular-nums">{money(detail.total)}</strong></div></div>
    {concept === 'personal' && <p className="mb-4 rounded-xl bg-[var(--fin-sunk)] p-3 text-sm">Incluye personal de servicios, costes externos de personal y dirección/estructura. Dirección y estructura: <strong>{money(result.total.costs.salary)}</strong>, ya incluidos en el total.</p>}
    <div className="mb-5 grid gap-3 sm:grid-cols-3">{detail.sources.map(source => <div key={source.id} className="rounded-xl border border-[var(--fin-line)] p-3 text-sm"><p className="fin-muted">{sources[source.id]}</p><strong className="tabular-nums">{money(source.amount)}</strong></div>)}</div>
    {!!result.total.pending && <p className="mb-4 text-sm text-[var(--fin-expense-ink)]">Hay registros con costes pendientes en este análisis. Se muestran los importes incluidos; el resultado sigue siendo provisional.</p>}
    {detail.rows.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">Importes que componen {financialName(detail.label)} sin IVA</caption><thead><tr className="border-b border-[var(--fin-line)] text-xs text-[var(--fin-muted)]">{['Fecha', 'Concepto', 'Origen / cliente', 'Detalle', 'Importe sin IVA'].map(label => <th key={label} scope="col" className="p-2 text-left font-medium">{label}</th>)}</tr></thead>
      <tbody>{detail.rows.map(row => <tr key={row.id} className="border-b border-[var(--fin-line)]/70 hover:bg-[var(--fin-sunk)]/50"><td className="whitespace-nowrap p-3">{row.date.split('-').reverse().join('/')}</td><th scope="row" className="p-3 text-left font-medium">{financialName(row.label)}</th><td className="p-3">{sources[row.source]}<span className="block text-xs text-slate-500">{financialName(row.clientId ? clients.find(client => client.id === row.clientId)?.name || 'Cliente sin identificar' : 'General · sin cliente')}</span></td><td className="min-w-48 p-3 text-slate-500">{row.description}{row.pending.length > 0 && <span className="block text-xs text-amber-800">Costes pendientes del servicio: {row.pending.join(' · ')}</span>}</td><td className="whitespace-nowrap p-3 text-right font-semibold tabular-nums">{money(row.amount)}</td></tr>)}</tbody>
      <tfoot><tr className="font-bold"><th colSpan={4} className="p-2 text-left">Total del desglose</th><td className="whitespace-nowrap p-3 text-right font-semibold">{money(detail.total)}</td></tr></tfoot></table></div> : <p className="py-8 text-center text-slate-500">No hay importes incluidos en este concepto con los filtros seleccionados.</p>}
  </section>;
}
