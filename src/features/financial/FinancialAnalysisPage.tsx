import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, ChevronRight, Download, Plus, Settings2, Wallet } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSede } from '@/contexts/SedeContext';
import { formatMadridDate } from '@/utils/date';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useFinancialData } from './useFinancialData';
import { COST_ITEMS, QUANTITY_ITEMS, analyze, newSettings, parseAmount, priceAt, readSettings, setRate, validDate,
  type Category, type FinanceSettings, type FinancialService, type Filters, type Summary, type ItemId } from './financialModel';
import type { DirectoryEntry } from './financialSource';

const money = (cents: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cents / 100);
const rateMoney = (mills: number) => new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(mills / 1000) + ' €';
const formatRate = (item: ItemId, mills: number) => item === 'products' ? new Intl.NumberFormat('es-ES', { maximumFractionDigits: 3 }).format(mills / 1000) + ' %' : rateMoney(mills);
const categoryNames: Record<Category, string> = { personal: 'Personal', laundry: 'Lavandería', supplies: 'Amenities y consumibles', products: 'Productos de limpieza', salary: 'Salario dirección turismo', other: 'Otros gastos' };
const panel = 'min-w-0 rounded-2xl border border-violet-100 bg-white p-5 shadow-sm';
const selectClass = 'h-10 rounded-md border border-input bg-background px-3 text-sm w-full';
function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function MultiFilter({ label, entries, selected, onChange }: { label: string; entries: DirectoryEntry[]; selected: string[]; onChange: (ids: string[]) => void }) {
  return <details className="relative rounded-lg border border-violet-200 bg-white">
    <summary className="cursor-pointer px-3 py-2 text-sm">{label}: {selected.length ? `${selected.length} seleccionados` : 'Todos'}</summary>
    <div className="absolute z-20 mt-1 max-h-64 w-64 overflow-auto rounded-xl border bg-white p-3 shadow-xl">
      <button className="mb-2 text-sm text-[#310984] underline" onClick={() => onChange([])}>Mostrar todos</button>
      {entries.map(entry => <label key={entry.id} className="flex items-center gap-2 py-1.5 text-sm">
        <input type="checkbox" checked={selected.includes(entry.id)} onChange={event => onChange(event.target.checked ? [...selected, entry.id] : selected.filter(id => id !== entry.id))} />{entry.name}
      </label>)}{!entries.length && <p className="text-sm text-slate-500">Sin registros disponibles</p>}
    </div>
  </details>;
}
function Indicators({ summary }: { summary: Summary }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    {[['Ingresos de servicios', money(summary.revenue)], ['Gastos incluidos', money(summary.expense)],
      ['Resultado provisional', money(summary.result)], ['Margen provisional', summary.margin === null ? '—' : `${summary.margin.toFixed(1)} %`]].map(([label, value], index) =>
      <div key={label} className={index === 2 ? 'rounded-2xl bg-[#310984] p-5 text-white shadow-sm' : panel}>
        <p className={`text-sm ${index === 2 ? 'text-violet-200' : 'text-slate-500'}`}>{label}</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
        <p className={`mt-2 text-xs ${index === 2 ? 'text-violet-200' : 'text-slate-500'}`}>Sin IVA · periodo seleccionado</p>
      </div>)}
  </div>;
}
function ClientTable({ result, names, onClient }: { result: ReturnType<typeof analyze>; names: DirectoryEntry[]; onClient: (id: string) => void }) {
  const rows = [...result.clients.map(client => ({ ...client, name: names.find(entry => entry.id === client.id)?.name || client.name })),
    { id: '__general', name: 'Gastos generales · sin repartir', ...result.general }];
  return <div className="overflow-x-auto"><table className="w-full text-sm">
    <caption className="sr-only">Ingresos y gastos por cliente y gastos generales sin IVA</caption>
    <thead className="bg-violet-50 text-[#310984]"><tr>{['Cliente', 'Ingresos', 'Personal', 'Lavandería', 'Consumibles', 'Productos', 'Dirección turismo', 'Otros', 'Total gastos', 'Resultado', 'Margen'].map(title => <th key={title} scope="col" className="whitespace-nowrap p-3 text-left">{title}</th>)}</tr></thead>
    <tbody>{rows.map(row => <tr key={row.id} className="border-b border-violet-50">
      <th scope="row" className="p-3 text-left font-medium">{row.id !== '__general' ? <button className="inline-flex items-center gap-1 text-[#310984] hover:underline" onClick={() => onClient(row.id)}>{row.name}<ChevronRight className="h-4 w-4" /></button> : row.name}
        {!!row.pending && <span className="block text-xs font-normal text-amber-700">{row.pending} servicios incompletos</span>}</th>
      {[row.revenue, row.costs.personal, row.costs.laundry, row.costs.supplies, row.costs.products, row.costs.salary, row.costs.other, row.expense, row.result].map((amount, i) => <td key={i} className="whitespace-nowrap p-3 tabular-nums">{money(amount)}</td>)}
      <td className="p-3">{row.margin === null ? '—' : `${row.margin.toFixed(1)} %`}</td>
    </tr>)}</tbody>
    <tfoot className="bg-violet-50 font-semibold"><tr><th className="p-3 text-left">Total del análisis</th>{[result.total.revenue, result.total.costs.personal, result.total.costs.laundry, result.total.costs.supplies, result.total.costs.products, result.total.costs.salary, result.total.costs.other, result.total.expense, result.total.result].map((amount, i) => <td className="p-3" key={i}>{money(amount)}</td>)}<td className="p-3">{result.total.margin === null ? '—' : `${result.total.margin.toFixed(1)} %`}</td></tr></tfoot>
  </table></div>;
}

export default function FinancialAnalysisPage() {
  const { activeSede } = useSede();
  const { user } = useAuth();
  if (!activeSede || !user) return <div className="p-8">Selecciona una sede para consultar el análisis financiero.</div>;
  return <FinancialWorkspace key={`${user.id}:${activeSede.id}`} storageKey={`limpatex-financial-v1:${user.id}:${activeSede.id}`} sedeId={activeSede.id} sedeName={activeSede.nombre} />;
}

export function FinancialWorkspace({ storageKey, sedeId, sedeName }: { storageKey: string; sedeId: string; sedeName: string }) {
  const today = formatMadridDate(new Date());
  const [filters, setFilters] = useState<Filters>({ start: `${today.slice(0, 7)}-01`, end: today, clients: [], properties: [], workers: [] });
  const [loaded] = useState(() => {
    try { const saved = localStorage.getItem(storageKey); return { settings: saved ? readSettings(JSON.parse(saved)) : newSettings(), error: '' }; }
    catch { return { settings: newSettings(), error: 'No se pudo leer la configuración guardada. No se sobrescribirá. Puedes restaurar una copia válida.' }; }
  });
  const [settings, setSettings] = useState(loaded.settings);
  const [storageError, setStorageError] = useState(loaded.error);
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState<'general' | 'clients' | 'services' | 'expenses' | 'rates'>('general');
  const [editing, setEditing] = useState<FinancialService | null>(null);
  const [imported, setImported] = useState<FinanceSettings | null>(null);
  const query = useFinancialData(sedeId, filters.start, filters.end);
  const result = useMemo(() => analyze(query.data?.services || [], settings, filters), [query.data, settings, filters]);
  const data = query.data;
  const commit = (next: FinanceSettings, restoring = false) => {
    if (storageError && !restoring) { setMessage('Restaura una copia antes de guardar cambios.'); return false; }
    try { localStorage.setItem(storageKey, JSON.stringify(readSettings(next))); setSettings(next); setStorageError(''); setMessage('Cambios guardados en este navegador.'); return true; }
    catch { setMessage('No se pudieron guardar los cambios. Exporta una copia y comprueba el espacio del navegador.'); return false; }
  };
  const clientName = (id: string) => data?.clients.find(client => client.id === id)?.name || 'Sin cliente identificado';
  const selectClient = (id: string) => { setFilters({ ...filters, clients: [id] }); setTab('services'); };
  const updateFilter = (key: 'clients' | 'properties' | 'workers', ids: string[]) => setFilters(current => ({ ...current, [key]: ids }));
  const csv = () => {
    const cell = (text: string) => '"' + (/^[=+\-@]/.test(text) ? "'" + text : text).split('"').join('""') + '"';
    const rows = [['Concepto', 'Ingresos EUR', 'Personal EUR', 'Lavandería EUR', 'Consumibles EUR', 'Productos EUR', 'Dirección turismo EUR', 'Otros EUR', 'Gastos EUR', 'Resultado provisional EUR'],
      ...result.clients.map(client => [clientName(client.id), client.revenue, client.costs.personal, client.costs.laundry, client.costs.supplies, client.costs.products, client.costs.salary, client.costs.other, client.expense, client.result].map((value, i) => i ? (Number(value) / 100).toFixed(2) : String(value))),
      ['Gastos generales', '0', '0', '0', '0', '0', '0', '0']];
    rows[rows.length - 1] = ['Gastos generales', '0', ...Object.values(result.general.costs).map(value => (value / 100).toFixed(2)), (result.general.expense / 100).toFixed(2), (result.general.result / 100).toFixed(2)];
    rows.push(['TOTAL', (result.total.revenue / 100).toFixed(2), ...Object.values(result.total.costs).map(value => (value / 100).toFixed(2)), (result.total.expense / 100).toFixed(2), (result.total.result / 100).toFixed(2)]);
    rows.push(['Sin IVA · resultado provisional · cantidades de ficha estimadas · gastos generales excluidos al filtrar cliente/propiedad/trabajador']);
    download(`analisis-financiero-${filters.start}-${filters.end}.csv`, '\uFEFF' + rows.map(row => row.map(cell).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
  };
  return <main className="min-h-screen bg-[#f7f5fc] p-4 sm:p-6">
    <div className="mx-auto max-w-[1500px] space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3"><div className="rounded-2xl bg-[#310984] p-3 text-white"><BarChart3 className="h-6 w-6" /></div>
          <div><p className="text-xs font-semibold uppercase tracking-widest text-violet-600">APP GESTIÓN LIMPATEX · {sedeName}</p><h1 className="text-2xl font-bold text-[#310984] sm:text-3xl">Análisis financiero</h1><p className="text-sm text-slate-500">Toda la actividad, con detalle por cliente · siempre sin IVA</p></div></div>
        <div className="flex gap-2"><Button variant="outline" disabled={!data || query.isFetching || !!query.error} onClick={csv}><Download className="mr-2 h-4 w-4" />Exportar tabla</Button><Button variant="outline" asChild><Link to="/">Volver</Link></Button></div>
      </header>
      <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-[#310984]">
        Primera versión · Tarifas, cantidades corregidas y gastos adicionales guardados solo en este navegador y usuario. Exporta una copia desde «Tarifas». Los servicios se consultan desde la app.
      </div>
      {storageError && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-amber-900">{storageError}</p>}
      {message && <p role="status" className="text-sm text-[#310984]">{message}</p>}
      <section className={`${panel} space-y-3`} aria-label="Filtros del análisis">
        <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-sm font-medium">Desde<Input type="date" value={filters.start} onChange={event => setFilters({ ...filters, start: event.target.value })} /></label>
          <label className="text-sm font-medium">Hasta<Input type="date" value={filters.end} onChange={event => setFilters({ ...filters, end: event.target.value })} /></label>
          <MultiFilter label="Clientes" entries={data?.clients || []} selected={filters.clients} onChange={ids => updateFilter('clients', ids)} />
          <MultiFilter label="Propiedades" entries={data?.properties || []} selected={filters.properties} onChange={ids => updateFilter('properties', ids)} />
          <MultiFilter label="Trabajadores" entries={data?.workers || []} selected={filters.workers} onChange={ids => updateFilter('workers', ids)} />
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500"><button className="text-[#310984] underline" onClick={() => setFilters({ start: `${today.slice(0, 7)}-01`, end: today, clients: [], properties: [], workers: [] })}>Ver todo · mes actual</button>
          {!!filters.workers.length && <span>Servicios en los que participa el trabajador; ingreso único y coste de todo el equipo.</span>}
          {(!!filters.clients.length || !!filters.properties.length || !!filters.workers.length) && <span>Los gastos generales sin vínculo quedan fuera de estos filtros.</span>}
        </div>
      </section>
      {!filters.start || !filters.end || filters.start > filters.end ? <p role="alert">Selecciona un intervalo de fechas válido.</p> : query.error ?
        <div role="alert" className={panel}><p>No se pudieron cargar los datos. No se muestran totales parciales.</p><Button variant="outline" onClick={() => query.refetch()}>Reintentar</Button></div> : query.isPending || query.isFetching ?
          <p role="status" className={panel}>Cargando servicios y costes…</p> : <>
            <Indicators summary={result.total} />
            <p className="text-sm text-slate-600">{result.total.services} servicios completados · {result.total.estimated} con estimaciones · {result.total.pending} con datos pendientes.
              {' '}Ingresos por fecha del servicio; no representan facturas ni cobros. Horas reales cuando el reporte las incluye; en su defecto, horas previstas.
              {' '}Las cantidades de la ficha son estimaciones actuales; revísalas por servicio. El resultado no es definitivo mientras falten costes.</p>
            <nav aria-label="Vistas del análisis" className="flex gap-2 overflow-x-auto pb-1">{([['general', 'General'], ['clients', 'Por cliente'], ['services', 'Servicios'], ['expenses', 'Otros gastos'], ['rates', 'Tarifas']] as const).map(([id, title]) =>
              <Button key={id} aria-pressed={tab === id} variant={tab === id ? 'default' : 'outline'} className={tab === id ? 'bg-[#310984] hover:bg-[#45209a]' : ''} onClick={() => setTab(id)}>{title}</Button>)}</nav>
            {tab === 'general' && <div className="grid gap-5 lg:grid-cols-[1fr_2fr]">
              <section className={panel}><h2 className="mb-5 flex items-center gap-2 font-semibold text-[#310984]"><Wallet className="h-5 w-5" />Distribución de gastos</h2>
                {(Object.keys(categoryNames) as Category[]).map((category, i) => <div className="mb-4" key={category}><div className="flex justify-between gap-2 text-sm"><span>{categoryNames[category]}</span><strong>{money(result.total.costs[category])}</strong></div><div className="mt-2 h-2 rounded-full bg-violet-50"><div className={['bg-[#310984]', 'bg-violet-600', 'bg-violet-400', 'bg-violet-500', 'bg-[#6741b3]', 'bg-violet-300'][i] + ' h-2 rounded-full'} style={{ width: `${result.total.expense ? result.total.costs[category] / result.total.expense * 100 : 0}%` }} /></div></div>)}
                <div className="border-t pt-3 text-sm"><p>Gastos generales incluidos: <strong>{money(result.general.expense)}</strong></p><p className="mt-1 text-xs text-slate-500">Se cuentan una vez y no se reparten entre clientes. Dirección de turismo: 2.317 €/mes inicialmente, proporcional a los días seleccionados; editable en Tarifas.</p></div>
              </section>
              <section className={panel}><h2 className="mb-4 font-semibold text-[#310984]">Resultado por cliente</h2><ClientTable result={result} names={data?.clients || []} onClient={selectClient} /></section>
            </div>}
            {tab === 'clients' && <section className={panel}><h2 className="mb-4 font-semibold text-[#310984]">Todos los clientes del análisis</h2><ClientTable result={result} names={data?.clients || []} onClient={selectClient} /></section>}
            {tab === 'services' && <section className={panel}><h2 className="mb-4 font-semibold text-[#310984]">Servicios · origen de cada importe</h2>
              {!result.services.length ? <p className="py-8 text-center text-slate-500">No hay servicios completados con estos filtros.</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-violet-50 text-[#310984]"><tr>{['Fecha / propiedad', 'Cliente / equipo', 'Ingresos', 'Personal', 'Lavandería', 'Consumibles', 'Productos', 'Resultado', 'Revisión'].map(title => <th className="p-3 text-left" key={title}>{title}</th>)}</tr></thead><tbody>
                {result.services.map(service => <tr key={service.id} className="border-b"><td className="p-3"><p>{service.date.split('-').reverse().join('/')}</p><strong>{service.propertyName}</strong></td><td className="p-3">{service.clientName}<p className="text-xs text-slate-500">{service.workers.map(worker => worker.name).join(', ') || 'Sin asignar'}</p></td>
                  <td className="p-3">{service.revenue === null ? 'Pendiente' : money(service.revenue)}</td>{[service.costs.personal, service.costs.laundry, service.costs.supplies, service.costs.products].map((value, i) => <td key={i} className="p-3">{money(value)}</td>)}<td className="p-3">{service.result === null ? '—' : money(service.result)}</td>
                  <td className="p-3"><Button variant="outline" size="sm" onClick={() => setEditing(service)}>Revisar costes</Button><p className="mt-1 text-xs text-amber-700">{service.pending.length ? 'Datos pendientes' : service.estimated ? 'Estimado' : 'Revisado'}</p></td></tr>)}
              </tbody></table></div>}
            </section>}
            {tab === 'expenses' && <section className={panel}><h2 className="mb-2 font-semibold text-[#310984]">Gastos adicionales del análisis</h2><p className="mb-4 text-sm text-slate-500">Registra solo gastos no incluidos ya en los servicios. Sin cliente, se consideran generales. El salario de dirección de turismo se calcula automáticamente; no lo añadas de nuevo.</p>
              <ExpenseForm clients={data?.clients || []} properties={data?.properties || []} workers={data?.workers || []} date={today} onAdd={expense => commit({ ...settings, expenses: [...settings.expenses, expense] })} />
              <div className="mt-5 space-y-2">{result.expenses.map(expense => <div key={expense.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-violet-50 p-3 text-sm"><div><strong>{expense.label}</strong><p>{expense.date} · {expense.clientId ? clientName(expense.clientId) : 'General'} · {categoryNames[expense.category]}</p></div><div className="flex items-center gap-3"><strong>{money(expense.cents)}</strong><>{expense.automatic ? <span className="text-xs text-violet-700">Calculado desde Tarifas</span> : <Button size="sm" variant="outline" onClick={() => commit({ ...settings, expenses: settings.expenses.filter(item => item.id !== expense.id) })}>Quitar del análisis</Button>}</></div></div>)}{!result.expenses.length && <p className="text-sm text-slate-500">Sin gastos adicionales en este periodo.</p>}</div>
            </section>}
            {tab === 'rates' && <section className={`${panel} space-y-5`}><h2 className="flex items-center gap-2 font-semibold text-[#310984]"><Settings2 className="h-5 w-5" />Tarifas personalizables · sin IVA</h2><p className="text-sm text-slate-500">Conservamos tres decimales por unidad y redondeamos cada categoría por servicio a céntimos. Los precios iniciales se aplican hasta que exista una tarifa fechada.</p>
              <RateForm workers={data?.workers || []} today={today} onSave={rate => commit({ ...settings, rates: setRate(settings.rates, rate) })} />
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{COST_ITEMS.map(item => <div key={item.id} className="rounded-xl bg-violet-50 p-3 text-sm"><p className="font-medium">{item.label}</p><p className="text-[#310984]">{formatRate(item.id, priceAt(settings.rates, item.id, filters.end))} / {item.unit}</p></div>)}</div>
              <p className="text-xs text-slate-500">Tarifa general vigente al {filters.end}. Las excepciones por trabajador figuran en el historial.</p>
              <div className="space-y-2">{[...settings.rates].sort((a, b) => b.date.localeCompare(a.date)).map(rate => <p className="text-sm" key={`${rate.item}:${rate.date}:${rate.workerId || ''}`}>{rate.date} · {COST_ITEMS.find(item => item.id === rate.item)?.label} · {rate.workerId ? data?.workers.find(worker => worker.id === rate.workerId)?.name || 'Trabajador' : 'General'} · <strong>{formatRate(rate.item, rate.mills)}</strong></p>)}</div>
              <div className="flex flex-wrap items-center gap-3 border-t pt-4"><Button variant="outline" onClick={() => download('limpatex-costes-copia.json', JSON.stringify(settings, null, 2), 'application/json')}>Exportar copia de ajustes</Button>
                <label className="cursor-pointer rounded-md border bg-white px-4 py-2 text-sm">Restaurar copia<input className="sr-only" type="file" accept=".json,application/json" onChange={async event => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; try { if (file.size > 5000000) throw new Error('Archivo demasiado grande'); setImported(readSettings(JSON.parse(await file.text()))); } catch { setMessage('La copia no es válida. No se ha cambiado ningún dato.'); } }} /></label>
              </div>
            </section>}
          </>}
      <ServiceEditor service={editing} settings={settings} onClose={() => setEditing(null)} onSave={adjustment => {
        if (editing && commit({ ...settings, adjustments: { ...settings.adjustments, [editing.id]: adjustment } })) setEditing(null);
      }} />
      <Dialog open={!!imported} onOpenChange={open => !open && setImported(null)}><DialogContent><DialogHeader><DialogTitle>Restaurar copia de costes</DialogTitle></DialogHeader><p>Esta copia contiene {imported?.rates.length} tarifas y {imported?.expenses.length} gastos. Sustituirá los ajustes de este navegador, usuario y sede. Los servicios de la app no se modifican.</p><Button variant="outline" onClick={() => setImported(null)}>Cancelar</Button><Button onClick={() => { if (imported && commit(imported, true)) setImported(null); }}>Restaurar esta copia</Button></DialogContent></Dialog>
    </div>
  </main>;
}

function RateForm({ workers, today, onSave }: { workers: DirectoryEntry[]; today: string; onSave: (rate: FinanceSettings['rates'][number]) => boolean }) {
  const [item, setItem] = useState<ItemId>('labor'); const [date, setDate] = useState(today); const [amount, setAmount] = useState('15,50'); const [workerId, setWorkerId] = useState(''); const [error, setError] = useState('');
  return <form className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-5" onSubmit={event => { event.preventDefault(); const mills = parseAmount(amount); if (mills === null || !validDate(date) || (item === 'products' && mills > 100000)) { setError('Introduce una fecha y un valor válido con hasta tres decimales; el porcentaje debe estar entre 0 y 100.'); return; } if (onSave({ item, date, mills, ...(item === 'labor' && workerId ? { workerId } : {}) })) setError(''); }}>
    <label className="text-sm">Concepto<select aria-label="Concepto" className={selectClass} value={item} onChange={event => { const id = event.target.value as ItemId; setItem(id); setAmount(String(COST_ITEMS.find(cost => cost.id === id)!.mills / 1000)); }}>{COST_ITEMS.map(cost => <option key={cost.id} value={cost.id}>{cost.label}</option>)}</select></label>
    <label className="text-sm">{item === 'products' ? 'Porcentaje sobre limpieza' : item === 'tourismSalary' ? 'Coste de empresa mensual' : 'Precio unitario sin IVA'}<Input inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} /></label>
    <label className="text-sm">Aplicar desde<Input type="date" value={date} onChange={event => setDate(event.target.value)} /></label>
    <label className="text-sm">Trabajador<select disabled={item !== 'labor'} className={selectClass} value={workerId} onChange={event => setWorkerId(event.target.value)}><option value="">Todos · tarifa general</option>{workers.map(worker => <option value={worker.id} key={worker.id}>{worker.name}</option>)}</select></label>
    <Button className="bg-[#310984]" type="submit">Guardar tarifa</Button>{error && <p role="alert" className="col-span-full text-sm text-red-700">{error}</p>}
  </form>;
}

function ExpenseForm({ clients, properties, workers, date, onAdd }: { clients: DirectoryEntry[]; properties: (DirectoryEntry & { clientId: string })[]; workers: DirectoryEntry[]; date: string; onAdd: (expense: FinanceSettings['expenses'][number]) => boolean }) {
  const [label, setLabel] = useState(''); const [amount, setAmount] = useState(''); const [expenseDate, setDate] = useState(date); const [category, setCategory] = useState<Category>('other');
  const [clientId, setClient] = useState(''); const [propertyId, setProperty] = useState(''); const [workerId, setWorker] = useState(''); const [error, setError] = useState('');
  return <form className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={event => { event.preventDefault(); const cents = parseAmount(amount, 2); if (!label.trim() || cents === null || !validDate(expenseDate)) { setError('Completa el concepto, la fecha y el importe sin IVA.'); return; } if (onAdd({ id: crypto.randomUUID(), date: expenseDate, label: label.trim(), cents, category, clientId, propertyId, workerId })) { setLabel(''); setAmount(''); setError(''); } }}>
    <label className="text-sm">Concepto del gasto<Input value={label} maxLength={200} onChange={event => setLabel(event.target.value)} /></label><label className="text-sm">Importe sin IVA<Input inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} /></label>
    <label className="text-sm">Fecha del gasto<Input type="date" value={expenseDate} onChange={event => setDate(event.target.value)} /></label>
    <label className="text-sm">Categoría<select className={selectClass} value={category} onChange={event => setCategory(event.target.value as Category)}>{Object.entries(categoryNames).map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select></label>
    <label className="text-sm">Cliente del gasto<select className={selectClass} value={clientId} onChange={event => { setClient(event.target.value); setProperty(''); }}><option value="">General · sin cliente</option>{clients.map(client => <option value={client.id} key={client.id}>{client.name}</option>)}</select></label>
    <label className="text-sm">Propiedad del gasto<select className={selectClass} value={propertyId} onChange={event => { const id = event.target.value; setProperty(id); if (id) setClient(properties.find(property => property.id === id)!.clientId); }}><option value="">Sin propiedad</option>{properties.filter(property => !clientId || property.clientId === clientId).map(property => <option value={property.id} key={property.id}>{property.name}</option>)}</select></label>
    <label className="text-sm">Trabajador del gasto<select className={selectClass} value={workerId} onChange={event => setWorker(event.target.value)}><option value="">Sin trabajador</option>{workers.map(worker => <option value={worker.id} key={worker.id}>{worker.name}</option>)}</select></label>
    <Button className="bg-[#310984]" type="submit"><Plus className="mr-2 h-4 w-4" />Añadir al análisis</Button>{error && <p role="alert" className="col-span-full text-sm text-red-700">{error}</p>}
  </form>;
}

function ServiceEditor({ service, settings, onClose, onSave }: { service: FinancialService | null; settings: FinanceSettings; onClose: () => void; onSave: (adjustment: FinanceSettings['adjustments'][string]) => void }) {
  return <Dialog open={!!service} onOpenChange={open => !open && onClose()}><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>Revisar costes · {service?.propertyName}</DialogTitle></DialogHeader>{service && <ServiceEditorForm key={service.id} service={service} settings={settings} onSave={onSave} />}</DialogContent></Dialog>;
}
function ServiceEditorForm({ service, settings, onSave }: { service: FinancialService; settings: FinanceSettings; onSave: (adjustment: FinanceSettings['adjustments'][string]) => void }) {
  const adjustment = settings.adjustments[service.id];
  const [quantities, setQuantities] = useState<Record<string, string>>(() => Object.fromEntries(QUANTITY_ITEMS.map(item => [item.id, String(adjustment?.quantities?.[item.id] ?? service.quantities[item.id] ?? '')])));
  const [hours, setHours] = useState<Record<string, string>>(() => Object.fromEntries(service.workers.map(worker => [worker.id, adjustment?.minutes?.[worker.id] === undefined ? '' : String(adjustment.minutes[worker.id] / 60)])));
  const [reviewed, setReviewed] = useState(adjustment?.reviewed || false); const [error, setError] = useState('');
  return <form className="space-y-4" onSubmit={event => { event.preventDefault(); const output: FinanceSettings['adjustments'][string] = { quantities: {}, minutes: {}, reviewed };
    for (const [key, value] of Object.entries(quantities)) { if (!value.trim()) { if (reviewed) { setError('Completa todas las cantidades; indica 0 cuando no se haya utilizado el artículo.'); return; } continue; } const amount = parseAmount(value, 1); if (amount === null || amount % 10 || amount > 1000000) { setError('Las cantidades deben ser unidades enteras entre 0 y 100.000.'); return; } output.quantities![key] = amount / 10; }
    for (const [id, value] of Object.entries(hours)) { if (!value.trim()) continue; const amount = parseAmount(value, 2); if (amount === null || amount > 2400 || amount % 25) { setError('Las horas deben ir en tramos de 0,25, entre 0 y 24 por trabajador.'); return; } output.minutes![id] = amount / 100 * 60; }
    onSave(output);
  }}>
    <p className="text-sm text-slate-500">{service.date} · {service.clientName}. Estos ajustes solo afectan al análisis. No cambian tareas, fichajes ni stock.</p>
    <h3 className="font-semibold text-[#310984]">Personal · horas por trabajador</h3>
    {service.workers.map(worker => <label className="block text-sm" key={worker.id}>{worker.name}<span className="ml-2 text-xs text-slate-500">{worker.minutes === null ? 'Sin horas' : `${(worker.minutes / 60).toFixed(2)} h ${worker.actual ? 'de reporte' : 'previstas'}`} · {rateMoney(priceAt(settings.rates, 'labor', service.date, worker.id))}/h</span><Input inputMode="decimal" placeholder="Mantener horas de la app" value={hours[worker.id]} onChange={event => setHours({ ...hours, [worker.id]: event.target.value })} /></label>)}
    {!service.workers.length && <p className="text-sm text-amber-700">No hay trabajadores identificados. El coste de personal queda pendiente.</p>}
    <p className="rounded-lg bg-violet-50 p-3 text-sm text-[#310984]">Productos de limpieza: {formatRate('products', priceAt(settings.rates, 'products', service.date))} del importe de cada limpieza sin IVA. Se calcula automáticamente; no se añade a las cantidades.</p>
    <h3 className="font-semibold text-[#310984]">Lavandería y consumibles · unidades utilizadas</h3><div className="grid gap-3 sm:grid-cols-2">{QUANTITY_ITEMS.map(item => <label className="text-sm" key={item.id}>{item.label}<span className="ml-1 text-xs text-slate-500">{rateMoney(priceAt(settings.rates, item.id, service.date))}</span><Input inputMode="numeric" placeholder="Cantidad pendiente" value={quantities[item.id]} onChange={event => setQuantities({ ...quantities, [item.id]: event.target.value })} /></label>)}</div>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} />He revisado todas las cantidades de este servicio</label>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}<Button type="submit" className="bg-[#310984]">Guardar ajustes del análisis</Button>
  </form>;
}
