import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { dayLabel, updatedLabel, type InventoryBag, type InventoryState } from './inventoryDomain';
import type { useInventoryWorkspace } from './useInventoryWorkspace';

const tones: Record<InventoryState, string> = {
  shortage: 'border-red-200 bg-red-50 text-red-800', replenish: 'border-amber-200 bg-amber-50 text-amber-900',
  unknown: 'border-slate-200 bg-slate-50 text-slate-600', covered: 'border-emerald-200 bg-emerald-50 text-emerald-800',
};
export function InventoryBadge({ state, children }: { state: InventoryState; children: ReactNode }) {
  return <span className={cn('inline-flex shrink-0 items-center rounded-lg border px-2 py-1 text-xs font-medium', tones[state])}>{children}</span>;
}
export function InventoryPanel({ title, description, children, action }: { title: string; description?: string; children: ReactNode; action?: ReactNode }) {
  return <section className="overflow-hidden rounded-2xl border border-border/70 bg-white"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 p-5"><div><h2 className="font-semibold text-slate-950">{title}</h2>{description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}</div>{action}</div>{children}</section>;
}
export function InventoryEmpty({ children }: { children: ReactNode }) { return <p className="p-6 text-sm text-muted-foreground">{children}</p>; }
export function InventoryLink({ to, children }: { to: string; children: ReactNode }) { return <Link to={to} className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">{children}<ArrowRight className="h-4 w-4" /></Link>; }
export function InventoryPeriod({ days, onChange, from, to }: { days: number; onChange: (days: number) => void; from: string; to: string }) {
  return <div className="flex flex-wrap items-center gap-3"><label className="text-sm font-medium">Preparación hasta <select aria-label="Período de preparación" value={days} onChange={e => onChange(Number(e.target.value))} className="ml-2 rounded-lg border bg-white px-3 py-2 text-sm"><option value={1}>Hoy</option><option value={3}>Próximos 3 días</option><option value={7}>Próximos 7 días</option></select></label><span className="text-xs text-muted-foreground">{dayLabel(from)} — {dayLabel(to)}</span></div>;
}
export function WorkspaceNotice({ workspace: w }: { workspace: ReturnType<typeof useInventoryWorkspace> }) {
  if (w.stockLoading) return <p role="status" className="rounded-xl border bg-white p-5 text-sm">Consultando inventario…</p>;
  if (w.stockError) return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5"><p className="font-semibold text-red-900">No se pudo consultar el inventario</p><p className="mt-1 text-sm">No se muestran ceros ni existencias anteriores como si fueran actuales.</p><Button variant="outline" className="mt-3" onClick={() => void w.refresh()}>Reintentar</Button></div>;
  return <div className="space-y-3">
    {!w.central && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">No hay un almacén central identificado. <Link className="font-semibold underline" to="/inventory/warehouses?manage=1">Revisar ubicaciones</Link></div>}
    <div className="flex items-start justify-between gap-3 rounded-xl border border-primary/10 bg-primary/[.035] p-4 text-sm"><div className="flex gap-3"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><div><p className="font-medium">Saldos registrados · comprueba las existencias antes de repartir</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{w.bagAccounting?.active ? 'El descuento por bolsas está activo. El saldo central es material suelto; las bolsas ya están descontadas. Los saldos parciales no incluyen el stock anterior pendiente de contar. ' : w.cycleActive ? 'El circuito completo está activo en las propiedades elegidas. Las reservas de bolsas se separan de la ropa disponible. ' : w.settings?.auto_consumption_enabled && !w.settings?.preparation_mode ? 'El descuento automático está habilitado. ' : w.settingsError ? 'No se pudo comprobar el descuento automático. ' : 'El descuento automático no está confirmado como activo. '}Una muda preparada no confirma su entrega. No se restan reservas de nuevo ni se suman los trasteros al almacén central.</p><p className="mt-2 text-[11px] text-muted-foreground">Última consulta: {updatedLabel(w.updatedAt ? new Date(w.updatedAt).toISOString() : null)}</p></div></div><Button variant="ghost" size="icon" aria-label="Actualizar inventario" onClick={() => void w.refresh()}><RefreshCw className="h-4 w-4" /></Button></div>
    {w.demandError && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">No se pudieron consultar las mudas. Las necesidades se muestran como pendientes de comprobar. <Button variant="link" onClick={() => void w.refresh()}>Reintentar</Button></p>}
    {w.demandReady && w.bags.some(bag => bag.state === 'review') && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">Hay mudas cuyo contenido necesita revisión. Las necesidades calculadas pueden estar incompletas. <Link to="/inventory/preparation" className="font-semibold underline">Revisar mudas</Link></p>}
  </div>;
}
const bagLabels: Record<InventoryBag['state'], string> = { pending: 'Por preparar', prepared: 'Preparada · entrega sin confirmar', delivered: 'Entrega confirmada', issue: 'Incidencia', review: 'Revisar contenido' };
export function BagList({ bags }: { bags: InventoryBag[] }) {
  return <div className="divide-y">{bags.map(bag => <details key={bag.taskId} className="group px-4 py-3"><summary className="cursor-pointer list-none rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><div className="flex flex-wrap items-center justify-between gap-2"><span><strong className="text-sm">{bag.propertyCode}</strong><span className="ml-3 text-xs text-muted-foreground">{dayLabel(bag.date)}</span></span><InventoryBadge state={bag.state === 'issue' ? 'shortage' : bag.state === 'review' || bag.state === 'pending' ? 'replenish' : bag.state === 'delivered' ? 'covered' : 'unknown'}>{bagLabels[bag.state]}</InventoryBadge></div><p className="mt-1 text-xs text-muted-foreground">{bag.issue || 'Ver contenido de la muda'}</p></summary><ul className="mt-3 grid gap-1 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-2">{bag.lines.map(line => <li key={line.productId}>{line.quantity} × {line.name}</li>)}</ul></details>)}</div>;
}
