import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { QUANTITY_ITEMS, parseAmount, priceAt, type FinanceSettings, type FinancialService } from './financialModel';
import { decimal, financialName, money } from './financialFormat';
import { formatRate, rateMoney } from './financialRateFormat';
import './financialTheme.css';

const field = 'fin-focus h-10 w-full rounded-lg border border-[var(--fin-line)] bg-[var(--fin-surface)] px-3 text-sm';
type Adjustment = FinanceSettings['adjustments'][string];

export function ServiceEditor({ service, settings, onClose, onSave }: { service: FinancialService | null; settings: FinanceSettings; onClose: () => void; onSave: (adjustment: Adjustment) => void }) {
  return <Dialog open={!!service} onOpenChange={open => !open && onClose()}>
    <DialogContent className="fin-dialog max-h-[90vh] max-w-3xl gap-0 overflow-y-auto rounded-3xl border-[var(--fin-line)] bg-[var(--fin-surface)] p-0 text-[var(--fin-ink)]">
      <DialogHeader className="border-b border-[var(--fin-line)] p-5 text-left sm:p-6"><DialogTitle className="fin-display text-2xl font-bold">Revisar costes · {service && financialName(service.propertyName)}</DialogTitle>
        <DialogDescription className="fin-muted">{service ? `${service.date} · ${financialName(service.clientName)}` : ''}. Estos ajustes solo afectan al análisis. No cambian tareas, fichajes ni stock.</DialogDescription></DialogHeader>
      {service && <ServiceEditorForm key={service.id} service={service} settings={settings} onSave={onSave} />}
    </DialogContent></Dialog>;
}

function ServiceEditorForm({ service, settings, onSave }: { service: FinancialService; settings: FinanceSettings; onSave: (adjustment: Adjustment) => void }) {
  const adjustment = settings.adjustments[service.id];
  const [quantities, setQuantities] = useState<Record<string, string>>(() => Object.fromEntries(QUANTITY_ITEMS.map(item => [item.id, String(adjustment?.quantities?.[item.id] ?? service.quantities[item.id] ?? '')])));
  const [hours, setHours] = useState<Record<string, string>>(() => Object.fromEntries(service.workers.map(worker => [worker.id, adjustment?.minutes?.[worker.id] === undefined ? '' : String(adjustment.minutes[worker.id] / 60)])));
  const [reviewed, setReviewed] = useState(adjustment?.reviewed || false); const [error, setError] = useState('');
  const supplements = (service.additionalRevenue || 0) - (service.kitchenClothRevenue || 0);
  const chip = 'rounded-full bg-[var(--fin-sunk)] px-3 py-1 text-[13px]';
  return <form className="space-y-6 p-5 sm:p-6" onSubmit={event => { event.preventDefault(); const output: Adjustment = { quantities: {}, minutes: {}, reviewed };
    for (const [key, value] of Object.entries(quantities)) { if (!value.trim()) { if (reviewed) { setError('Completa todas las cantidades; indica 0 cuando no se haya utilizado el artículo.'); return; } continue; } const amount = parseAmount(value, 1); if (amount === null || amount % 10 || amount > 1000000) { setError('Las cantidades deben ser unidades enteras entre 0 y 100.000.'); return; } output.quantities![key] = amount / 10; }
    for (const [id, value] of Object.entries(hours)) { if (!value.trim()) continue; const amount = parseAmount(value, 2); if (amount === null || amount > 2400 || amount % 25) { setError('Las horas deben ir en tramos de 0,25, entre 0 y 24 por trabajador.'); return; } output.minutes![id] = amount / 100 * 60; }
    onSave(output);
  }}>
    <p className="flex flex-wrap gap-2"><span className={chip}>Tarifa de propiedad: {service.revenue === null ? 'pendiente' : money(service.revenue - (service.additionalRevenue || 0))}{!!supplements && ` · otros suplementos: ${money(supplements)}`}{!!service.kitchenClothRevenue && ` · paño de cocina: ${money(service.kitchenClothRevenue)}`}</span></p>
    {!!service.unpricedConsumptions?.length && <p role="alert" className="rounded-xl bg-[var(--fin-sunk)] p-3 text-sm text-[var(--fin-expense-ink)]">Productos configurados sin tarifa: {service.unpricedConsumptions.join(', ')}. Su coste queda pendiente; no se interpreta como gratuito.</p>}
    <section className="space-y-3"><h3 className="fin-display text-lg font-bold">Personal · horas por trabajador</h3>
      {service.workers.map(worker => <label className="grid items-center gap-2 rounded-xl border border-[var(--fin-line)] p-3 text-sm sm:grid-cols-[1fr_14rem]" key={worker.id}><span><strong>{worker.name}</strong><span className="fin-muted ml-2 text-xs">{worker.minutes === null ? 'Sin horas' : `${decimal(worker.minutes / 60, 2)} h ${worker.actual ? 'de reporte' : 'previstas'}`} · {rateMoney(priceAt(settings.rates, 'labor', service.date, worker.id))}/h</span></span>
        <input className={field} inputMode="decimal" placeholder="Mantener horas de la app" value={hours[worker.id]} onChange={event => setHours({ ...hours, [worker.id]: event.target.value })} /></label>)}
      {!service.workers.length && <p className="text-sm text-[var(--fin-expense-ink)]">No hay trabajadores identificados. El coste de personal queda pendiente.</p>}
      <p className="fin-muted text-sm">Productos de limpieza: {formatRate('products', priceAt(settings.rates, 'products', service.date))} del importe de cada limpieza sin IVA. Se calcula automáticamente; no se añade a las cantidades.</p></section>
    <section className="space-y-3"><h3 className="fin-display text-lg font-bold">Lavandería y consumibles · unidades utilizadas</h3>
      <div className="grid gap-3 sm:grid-cols-2">{QUANTITY_ITEMS.map(item => <label className="text-sm" key={item.id}>{item.label}<span className="fin-muted ml-1 text-xs">{rateMoney(priceAt(settings.rates, item.id, service.date))}</span>
        <input className={`${field} mt-1`} inputMode="numeric" placeholder="Cantidad pendiente" value={quantities[item.id]} onChange={event => setQuantities({ ...quantities, [item.id]: event.target.value })} /></label>)}</div></section>
    <div className="sticky bottom-0 -mx-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--fin-line)] bg-[var(--fin-surface)] px-5 py-4 sm:-mx-6 sm:px-6">
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[var(--fin-ink)]" checked={reviewed} onChange={event => setReviewed(event.target.checked)} />He revisado todas las cantidades de este servicio</label>
      <div className="flex items-center gap-3">{error && <p role="alert" className="text-sm text-[var(--fin-loss)]">{error}</p>}<button type="submit" className="fin-focus h-11 rounded-full bg-[var(--fin-ink)] px-6 text-sm font-semibold text-white">Guardar ajustes del análisis</button></div></div>
  </form>;
}
