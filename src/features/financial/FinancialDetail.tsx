import { useEffect, useMemo, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { financialDetail, isIncomeConcept } from './financialDrilldown';
import { money, type FinancialAnalysis } from './financialCharts';
import type { FinancialDetailConcept } from './financialView';
import type { Filters, FinanceSettings } from './financialModel';
import type { DirectoryEntry } from './financialSource';

const sourceNames = { services: 'Servicios', incomes: 'Ingresos externos', expenses: 'Gastos adicionales y dirección' };
export function FinancialDetail({ result, settings, concept, filters, clients, onBack }: {
  result: FinancialAnalysis; settings: FinanceSettings; concept: FinancialDetailConcept; filters: Filters; clients: DirectoryEntry[]; onBack: () => void;
}) {
  const detail = useMemo(() => financialDetail(result, concept, settings), [result, concept, settings]);
  const income = isIncomeConcept(concept);
  const sources = income ? sourceNames : { ...sourceNames, services: 'Costes de servicios', incomes: 'Costes de ingresos externos' };
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [concept]);
  return <section className="min-w-0 rounded-2xl border border-violet-100 bg-white p-5 shadow-sm sm:p-6" aria-label="Desglose del gráfico">
    <Button variant="outline" onClick={onBack}><ArrowLeft className="mr-2 h-4 w-4" />Volver al gráfico</Button>
    <div className="my-5 flex flex-wrap items-start justify-between gap-3"><div>
      <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold text-[#310984]">{income ? 'Ingresos' : 'Gastos'} · desglose{concept !== 'revenue' && ` · ${detail.label}`}</h2>
      <p className="mt-1 text-sm text-slate-500">{filters.start.split('-').reverse().join('/')} – {filters.end.split('-').reverse().join('/')} · Mismos filtros del análisis · Sin IVA</p>
    </div><div className="rounded-xl bg-violet-50 px-5 py-3 text-right"><p className="text-xs text-violet-700">Total del concepto</p><strong className="text-2xl tabular-nums text-[#310984]">{money(detail.total)}</strong></div></div>
    {concept === 'personal' && <p className="mb-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-900">Incluye personal de servicios, costes externos de personal y dirección/estructura. Dirección y estructura: <strong>{money(result.total.costs.salary)}</strong>, ya incluidos en el total.</p>}
    <div className="mb-5 grid gap-3 sm:grid-cols-3">{detail.sources.map(source => <div key={source.id} className="rounded-xl bg-slate-50 p-3 text-sm"><p className="text-slate-500">{sources[source.id]}</p><strong className="tabular-nums">{money(source.amount)}</strong></div>)}</div>
    {!!result.total.pending && <p className="mb-4 text-sm text-amber-800">Hay registros con costes pendientes en este análisis. Se muestran los importes incluidos; el resultado sigue siendo provisional.</p>}
    {detail.rows.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">Importes que componen {detail.label} sin IVA</caption><thead className="bg-violet-50 text-[#310984]"><tr>{['Fecha', 'Concepto', 'Origen / cliente', 'Detalle', 'Importe sin IVA'].map(label => <th key={label} scope="col" className="p-3 text-left">{label}</th>)}</tr></thead>
      <tbody>{detail.rows.map(row => <tr key={row.id} className="border-b border-violet-50"><td className="whitespace-nowrap p-3">{row.date.split('-').reverse().join('/')}</td><th scope="row" className="p-3 text-left font-medium">{row.label}</th><td className="p-3">{sources[row.source]}<span className="block text-xs text-slate-500">{row.clientId ? clients.find(client => client.id === row.clientId)?.name || 'Cliente sin identificar' : 'General · sin cliente'}</span></td><td className="min-w-48 p-3 text-slate-500">{row.description}{row.pending.length > 0 && <span className="block text-xs text-amber-800">Costes pendientes del servicio: {row.pending.join(' · ')}</span>}</td><td className="whitespace-nowrap p-3 text-right font-semibold tabular-nums">{money(row.amount)}</td></tr>)}</tbody>
      <tfoot className="bg-violet-50 text-[#310984]"><tr><th colSpan={4} className="p-3 text-left">Total del desglose</th><td className="whitespace-nowrap p-3 text-right font-semibold">{money(detail.total)}</td></tr></tfoot></table></div> : <p className="py-8 text-center text-slate-500">No hay importes incluidos en este concepto con los filtros seleccionados.</p>}
  </section>;
}
