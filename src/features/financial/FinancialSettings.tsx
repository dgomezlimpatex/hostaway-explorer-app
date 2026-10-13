import { useState } from 'react';
import { Download, FileUp, Plus, Upload } from 'lucide-react';
import './financialTheme.css';
import { COST_ITEMS, parseAmount, priceAt, readSettings, setRate, validDate, type Category, type FinanceSettings, type ItemId } from './financialModel';
import { categoryNames, type FinancialAnalysis } from './financialCharts';
import { ConsumptionPanel, IncomePanel } from './FinancialConfiguration';
import { financialName, money } from './financialFormat';
import { formatRate } from './financialRateFormat';
import type { DirectoryEntry } from './financialSource';

export type SettingsTab = 'rates' | 'incomes' | 'expenses';
type Property = DirectoryEntry & { clientId: string };
const field = 'fin-focus h-11 w-full rounded-lg border border-[var(--fin-line)] bg-[var(--fin-surface)] px-3 text-sm disabled:opacity-50';
const card = 'min-w-0 space-y-4 rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-surface)] p-5 sm:p-6';
const primary = 'fin-focus inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--fin-ink)] px-6 text-sm font-semibold text-white';
const secondary = 'fin-focus inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--fin-line)] px-4 text-sm font-medium hover:bg-[var(--fin-sunk)]';
const HISTORY = 8;

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function RateForm({ workers, today, onSave }: { workers: DirectoryEntry[]; today: string; onSave: (rate: FinanceSettings['rates'][number]) => boolean }) {
  const [item, setItem] = useState<ItemId>('labor'); const [date, setDate] = useState(today); const [amount, setAmount] = useState('14,50'); const [workerId, setWorkerId] = useState(''); const [error, setError] = useState('');
  return <form className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-5" onSubmit={event => { event.preventDefault(); const mills = parseAmount(amount); if (mills === null || !validDate(date) || (item === 'products' && mills > 100000)) { setError('Introduce una fecha y un valor válido con hasta tres decimales; el porcentaje debe estar entre 0 y 100.'); return; } if (onSave({ item, date, mills, ...(item === 'labor' && workerId ? { workerId } : {}) })) setError(''); }}>
    <label className="text-sm font-medium">Concepto<select aria-label="Concepto" className={`${field} mt-1 font-normal`} value={item} onChange={event => { const id = event.target.value as ItemId; setItem(id); setAmount(String(COST_ITEMS.find(cost => cost.id === id)!.mills / 1000)); }}>{COST_ITEMS.map(cost => <option key={cost.id} value={cost.id}>{cost.label}</option>)}</select></label>
    <label className="text-sm font-medium">{item === 'products' ? 'Porcentaje sobre limpieza' : item === 'tourismSalary' ? 'Coste de empresa mensual' : 'Precio unitario sin IVA'}<input className={`${field} mt-1 font-normal`} inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} /></label>
    <label className="text-sm font-medium">Aplicar desde<input className={`${field} mt-1 font-normal`} type="date" value={date} onChange={event => setDate(event.target.value)} /></label>
    <label className="text-sm font-medium">Trabajador<select disabled={item !== 'labor'} className={`${field} mt-1 font-normal`} value={workerId} onChange={event => setWorkerId(event.target.value)}><option value="">Todos · tarifa general</option>{workers.map(worker => <option value={worker.id} key={worker.id}>{worker.name}</option>)}</select></label>
    <button className={primary} type="submit">Guardar tarifa</button>{error && <p role="alert" className="col-span-full text-sm text-[var(--fin-loss)]">{error}</p>}
  </form>;
}

function ExpenseForm({ clients, properties, workers, date, onAdd }: { clients: DirectoryEntry[]; properties: Property[]; workers: DirectoryEntry[]; date: string; onAdd: (expense: FinanceSettings['expenses'][number]) => boolean }) {
  const [label, setLabel] = useState(''); const [amount, setAmount] = useState(''); const [expenseDate, setDate] = useState(date); const [category, setCategory] = useState<Category>('other');
  const [clientId, setClient] = useState(''); const [propertyId, setProperty] = useState(''); const [workerId, setWorker] = useState(''); const [error, setError] = useState('');
  const control = `${field} mt-1 font-normal`;
  return <form className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={event => { event.preventDefault(); const cents = parseAmount(amount, 2); if (!label.trim() || cents === null || !validDate(expenseDate)) { setError('Completa el concepto, la fecha y el importe sin IVA.'); return; } if (onAdd({ id: crypto.randomUUID(), date: expenseDate, label: label.trim(), cents, category, clientId, propertyId, workerId })) { setLabel(''); setAmount(''); setError(''); } }}>
    <label className="text-sm font-medium">Concepto del gasto<input className={control} value={label} maxLength={200} onChange={event => setLabel(event.target.value)} /></label>
    <label className="text-sm font-medium">Importe sin IVA<input className={control} inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} /></label>
    <label className="text-sm font-medium">Fecha del gasto<input className={control} type="date" value={expenseDate} onChange={event => setDate(event.target.value)} /></label>
    <label className="text-sm font-medium">Categoría<select className={control} value={category} onChange={event => setCategory(event.target.value as Category)}>{Object.entries(categoryNames).map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select></label>
    <label className="text-sm font-medium">Cliente del gasto<select className={control} value={clientId} onChange={event => { setClient(event.target.value); setProperty(''); }}><option value="">General · sin cliente</option>{clients.map(client => <option value={client.id} key={client.id}>{financialName(client.name)}</option>)}</select></label>
    <label className="text-sm font-medium">Propiedad del gasto<select className={control} value={propertyId} onChange={event => { const id = event.target.value; setProperty(id); if (id) setClient(properties.find(property => property.id === id)!.clientId); }}><option value="">Sin propiedad</option>{properties.filter(property => !clientId || property.clientId === clientId).map(property => <option value={property.id} key={property.id}>{property.name}</option>)}</select></label>
    <label className="text-sm font-medium">Trabajador del gasto<select className={control} value={workerId} onChange={event => setWorker(event.target.value)}><option value="">Sin trabajador</option>{workers.map(worker => <option value={worker.id} key={worker.id}>{worker.name}</option>)}</select></label>
    <button className={primary} type="submit"><Plus aria-hidden className="h-4 w-4" />Añadir al análisis</button>{error && <p role="alert" className="col-span-full text-sm text-[var(--fin-loss)]">{error}</p>}
  </form>;
}

export interface FinancialSettingsProps {
  tab: SettingsTab; onTab: (tab: SettingsTab) => void; settings: FinanceSettings; result: FinancialAnalysis; today: string; start: string; end: string;
  clients: DirectoryEntry[]; properties: Property[]; workers: DirectoryEntry[]; onCommit: (settings: FinanceSettings) => boolean;
  legacy: { error: string; hasLocal: boolean; settings: FinanceSettings }; onImport: (settings: FinanceSettings) => void; onMessage: (message: string) => void;
}
// Everything that feeds the analysis but is not a service: rates, outside income and extra expenses.
export function FinancialSettings({ tab, onTab, settings, result, today, start, end, clients, properties, workers, onCommit, legacy, onImport, onMessage }: FinancialSettingsProps) {
  const [allRates, setAllRates] = useState(false);
  const rates = [...settings.rates].sort((a, b) => b.date.localeCompare(a.date));
  const clientName = (id: string) => financialName(clients.find(client => client.id === id)?.name || 'Sin cliente identificado');
  const tabs: [SettingsTab, string][] = [['rates', 'Tarifas'], ['incomes', 'Otros ingresos'], ['expenses', 'Otros gastos']];
  return <div className="space-y-5">
    <div role="group" aria-label="Qué ajustar" className="fin-rise inline-flex max-w-full overflow-x-auto rounded-full border border-[var(--fin-line)] bg-[var(--fin-surface)] p-1">{tabs.map(([id, label]) =>
      <button key={id} type="button" aria-pressed={tab === id} onClick={() => onTab(id)} className={`fin-focus shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${tab === id ? 'bg-[var(--fin-ink)] text-white' : 'fin-muted hover:text-[var(--fin-ink)]'}`}>{label}</button>)}</div>

    {tab === 'incomes' && <IncomePanel settings={settings} result={result} clients={clients} properties={properties} workers={workers} date={start} onChange={onCommit} />}

    {tab === 'expenses' && <section className={card} aria-label="Otros gastos"><div><h2 className="fin-display text-2xl font-bold">Gastos adicionales del análisis</h2>
      <p className="fin-muted mt-1 text-sm">Registra solo gastos no incluidos ya en los servicios. Sin cliente, se consideran generales. El salario de dirección de turismo se calcula automáticamente; no lo añadas de nuevo.</p></div>
      <ExpenseForm clients={clients} properties={properties} workers={workers} date={today} onAdd={expense => onCommit({ ...settings, expenses: [...settings.expenses, expense] })} />
      <ul className="divide-y divide-[var(--fin-line)] border-t border-[var(--fin-line)]">{result.expenses.map(expense => <li key={expense.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
        <div><strong>{expense.label}</strong><p className="fin-muted text-xs">{expense.date} · {expense.clientId ? clientName(expense.clientId) : 'General'} · {categoryNames[expense.category]}</p></div>
        <div className="flex items-center gap-3"><strong className="fin-display tabular-nums">{money(expense.cents)}</strong>{expense.automatic ? <span className="fin-muted text-xs">Calculado desde Tarifas</span> : <button type="button" className={secondary} onClick={() => onCommit({ ...settings, expenses: settings.expenses.filter(item => item.id !== expense.id) })}>Quitar del análisis</button>}</div></li>)}
        {!result.expenses.length && <li className="fin-muted py-4 text-sm">Sin gastos adicionales en este periodo.</li>}</ul></section>}

    {tab === 'rates' && <>
      <section className={card} aria-label="Tarifas vigentes"><div><h2 className="fin-display text-2xl font-bold">Tarifas personalizables · sin IVA</h2>
        <p className="fin-muted mt-1 text-sm">Conservamos tres decimales por unidad y redondeamos cada categoría por servicio a céntimos. Los precios iniciales se aplican hasta que exista una tarifa fechada.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{COST_ITEMS.map(item => <div key={item.id} className="rounded-2xl border border-[var(--fin-line)] p-4 text-sm"><p className="fin-muted">{item.label}</p>
          <p className="fin-display mt-1 text-lg font-bold">{formatRate(item.id, priceAt(settings.rates, item.id, end))} / {item.unit}</p></div>)}</div>
        <p className="fin-muted text-xs">Tarifa general vigente al {end}. Las excepciones por trabajador figuran en el historial.</p></section>
      <section className={card} aria-label="Cambiar una tarifa"><h2 className="fin-display text-xl font-bold">Cambiar una tarifa</h2>
        <RateForm workers={workers} today={today} onSave={rate => onCommit({ ...settings, rates: setRate(settings.rates, rate) })} /></section>
      <section className={card} aria-label="Historial de tarifas"><h2 className="fin-display text-xl font-bold">Historial</h2>
        <ul className="divide-y divide-[var(--fin-line)]">{(allRates ? rates : rates.slice(0, HISTORY)).map(rate => <li className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm" key={`${rate.item}:${rate.date}:${rate.workerId || ''}`}>
          <span>{rate.date} · {COST_ITEMS.find(item => item.id === rate.item)?.label} · {rate.workerId ? workers.find(worker => worker.id === rate.workerId)?.name || 'Trabajador' : 'General'}</span><strong className="fin-display tabular-nums">{formatRate(rate.item, rate.mills)}</strong></li>)}
          {!rates.length && <li className="fin-muted py-3 text-sm">Todavía no hay tarifas fechadas: se aplican los precios iniciales.</li>}</ul>
        {rates.length > HISTORY && <button type="button" className={secondary} onClick={() => setAllRates(value => !value)}>{allRates ? 'Ver menos' : `Ver todo (${rates.length})`}</button>}</section>
      <section className={card} aria-label="Copia de seguridad"><div><h2 className="fin-display text-xl font-bold">Copia de seguridad</h2><p className="fin-muted mt-1 text-sm">Guarda o recupera todos los ajustes de esta sede. Al restaurar, el borrador se sustituye y hay que pulsar «Guardar cambios» para compartirlo.</p></div>
        <div className="flex flex-wrap items-center gap-3"><button type="button" className={secondary} onClick={() => download('limpatex-costes-copia.json', JSON.stringify(settings, null, 2), 'application/json')}><Download aria-hidden className="h-4 w-4" />Exportar copia de ajustes</button>
          {!legacy.error && legacy.hasLocal && <button type="button" className={secondary} onClick={() => onImport(legacy.settings)}><Upload aria-hidden className="h-4 w-4" />Importar ajustes antiguos de este navegador</button>}
          <label className={`${secondary} cursor-pointer`}><FileUp aria-hidden className="h-4 w-4" />Restaurar copia<input className="sr-only" type="file" accept=".json,application/json" onChange={async event => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; try { if (file.size > 5000000) throw new Error('Archivo demasiado grande'); onImport(readSettings(JSON.parse(await file.text()))); } catch { onMessage('La copia no es válida. No se ha cambiado ningún dato.'); } }} /></label></div></section>
      <section className={card} aria-label="Consumos personalizados"><ConsumptionPanel settings={settings} clients={clients} properties={properties} onChange={onCommit} /></section>
    </>}
  </div>;
}
