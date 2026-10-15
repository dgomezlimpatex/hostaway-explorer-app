import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertOctagon, ArrowRight, Check, CircleDashed, Hourglass, Info, PackageCheck, RefreshCw, Search, TriangleAlert, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { dayLabel, updatedLabel, type InventoryBag } from './inventoryDomain';
import { bagContent, shortDay, type ActionTone, type LevelTone } from './inventoryViews';
import type { useInventoryWorkspace } from './useInventoryWorkspace';

type ChipTone = LevelTone | ActionTone | 'pending' | 'prepared' | 'delivered';
const chipStyles: Record<ChipTone, [string, typeof Check]> = {
  shortage: ['border-red-200 bg-red-50 text-red-800', AlertOctagon],
  replenish: ['border-amber-200 bg-amber-50 text-amber-900', TriangleAlert],
  check: ['border-orange-200 bg-orange-50 text-orange-900', Search],
  partial: ['border-slate-200 bg-slate-50 text-slate-700', Hourglass],
  undefined: ['border-slate-200 bg-white text-slate-600', CircleDashed],
  covered: ['border-emerald-200 bg-emerald-50 text-emerald-800', Check],
  info: ['border-primary/15 bg-primary/[.04] text-primary', Info],
  pending: ['border-amber-200 bg-amber-50 text-amber-900', CircleDashed],
  prepared: ['border-primary/20 bg-primary/[.05] text-primary', PackageCheck],
  delivered: ['border-emerald-200 bg-emerald-50 text-emerald-800', Truck],
};
/** Status with icon and text, never colour alone. */
export function StatusChip({ tone, children, className }: { tone: ChipTone; children: ReactNode; className?: string }) {
  const [style, Icon] = chipStyles[tone];
  return <span className={cn('inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 text-[13px] font-medium leading-5', style, className)}><Icon aria-hidden className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{children}</span></span>;
}

const bagLabels: Record<InventoryBag['state'], string> = { pending: 'Por preparar', prepared: 'Preparada · entrega sin confirmar', delivered: 'Entrega confirmada', issue: 'Incidencia', review: 'Revisar contenido' };
const bagTones: Record<InventoryBag['state'], ChipTone> = { pending: 'pending', prepared: 'prepared', delivered: 'delivered', issue: 'shortage', review: 'check' };
export const BagChip = ({ bag }: { bag: InventoryBag }) => <StatusChip tone={bagTones[bag.state]}>{bagLabels[bag.state]}</StatusChip>;

export function Section({ title, meta, action, children, className, id }: { title: ReactNode; meta?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return <section aria-labelledby={id} className={cn('inv-surface overflow-hidden', className)}>
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-3"><div className="min-w-0"><h2 id={id} className="text-[15px] font-semibold text-slate-950">{title}</h2>{meta && <p className="mt-0.5 text-[13px] text-muted-foreground">{meta}</p>}</div>{action}</div>
    {children}
  </section>;
}
export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return <div className="px-4 py-6 text-sm text-muted-foreground"><p>{children}</p>{action && <div className="mt-3">{action}</div>}</div>;
}
export function ErrorState({ title, children, onRetry, retryLabel = 'Reintentar' }: { title: string; children?: ReactNode; onRetry?: () => void; retryLabel?: string }) {
  return <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm"><p className="font-semibold text-red-900">{title}</p>{children && <p className="mt-1 text-red-900/80">{children}</p>}{onRetry && <Button variant="outline" size="sm" className="mt-3 bg-white" onClick={onRetry}><RefreshCw className="mr-2 h-4 w-4" />{retryLabel}</Button>}</div>;
}
export function TextLink({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return <Link to={to} className={cn('inline-flex items-center gap-1.5 rounded text-sm font-semibold text-primary hover:underline', className)}>{children}<ArrowRight aria-hidden className="h-4 w-4" /></Link>;
}
export function PeriodSelect({ days, onChange, from, to }: { days: number; onChange: (days: number) => void; from: string; to: string }) {
  return <label className="flex items-center gap-2 text-sm text-muted-foreground"><span className="whitespace-nowrap">Mudas hasta</span>
    <select aria-label="Período de preparación" value={days} onChange={e => onChange(Number(e.target.value))} className="inv-control font-medium text-slate-900"><option value={1}>Hoy</option><option value={3}>Próximos 3 días</option><option value={7}>Próximos 7 días</option></select>
    <span className="hidden whitespace-nowrap text-[13px] sm:inline">{from === to ? dayLabel(from) : `${dayLabel(from)} – ${dayLabel(to)}`}</span></label>;
}
export function Segmented<T extends string>({ label, options, value, onChange }: { label: string; options: Array<{ value: T; label: string; count?: number | null }>; value: T; onChange: (value: T) => void }) {
  return <div role="group" aria-label={label} className="inv-segmented">{options.map(option => <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)}>
    {option.label}{option.count !== undefined && <span className="tabular-nums">{option.count ?? '—'}</span>}</button>)}</div>;
}
export function SearchBox({ label, value, onChange, placeholder, className }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; className?: string }) {
  return <div className={cn('relative', className)}><Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input type="search" aria-label={label} className="h-10 bg-white pl-9" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} /></div>;
}

/** One compact line about what the figures mean; the full explanation stays one tap away. */
export function WorkspaceStatus({ workspace: w }: { workspace: ReturnType<typeof useInventoryWorkspace> }) {
  if (w.stockLoading) return <p role="status" className="inv-surface flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground"><RefreshCw aria-hidden className="h-4 w-4 animate-spin motion-reduce:animate-none" />Consultando inventario…</p>;
  if (w.stockError) return <ErrorState title="No se pudo consultar el inventario" onRetry={() => void w.refresh()}>No se muestran ceros ni existencias anteriores como si fueran actuales.</ErrorState>;
  const mode = w.bagAccounting?.active ? 'El descuento por bolsas está activo. El saldo central es material suelto; las bolsas ya están descontadas. Los saldos parciales no incluyen el stock anterior pendiente de contar. '
    : w.cycleActive ? 'El circuito completo está activo en las propiedades elegidas. Las reservas de bolsas se separan de la ropa disponible. '
    : w.settings?.auto_consumption_enabled && !w.settings?.preparation_mode ? 'El descuento automático está habilitado. '
    : w.settingsError ? 'No se pudo comprobar el descuento automático. ' : 'El descuento automático no está confirmado como activo. ';
  return <div className="space-y-2">
    {!w.central && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">No hay un almacén central identificado: no se pueden calcular las necesidades. <Link className="font-semibold underline" to="/inventory/warehouses?manage=1">Revisar ubicaciones</Link></p>}
    {w.demandError && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950"><span>No se pudieron consultar las mudas. Las necesidades quedan pendientes de comprobar, no a cero.</span><Button variant="outline" size="sm" className="bg-white" onClick={() => void w.refresh()}>Reintentar mudas</Button></div>}
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
      <span className="font-medium text-slate-700">Saldos registrados: compruébalos antes de repartir</span>
      <span aria-hidden className="hidden sm:inline">·</span><span>Consultado {updatedLabel(w.updatedAt ? new Date(w.updatedAt).toISOString() : null)}</span>
      <Button variant="ghost" size="sm" className="h-8 px-2 text-primary" onClick={() => void w.refresh()}><RefreshCw aria-hidden className="mr-1.5 h-3.5 w-3.5" />Actualizar</Button>
      <details className="inv-explain w-full sm:w-auto"><summary className="cursor-pointer rounded font-medium text-primary">Cómo leer estas cifras</summary>
        <p className="mt-2 max-w-3xl leading-relaxed">{mode}Una muda preparada no confirma su entrega. No se restan reservas de nuevo ni se suman los trasteros al almacén central. Una reserva sin definir no es una falta.</p></details>
    </div>
  </div>;
}

/** Bags with their content visible, so nobody has to open each one to compare. */
export function BagRows({ bags, showDate = true }: { bags: InventoryBag[]; showDate?: boolean }) {
  return <ul className="divide-y">{bags.map(bag => <li key={bag.taskId} className="grid gap-x-4 gap-y-1 px-4 py-2.5 sm:grid-cols-[minmax(7rem,10rem)_minmax(0,1fr)_auto] sm:items-center">
    <div className="flex items-baseline gap-2"><strong className="text-sm font-semibold text-slate-950">{bag.propertyCode}</strong>{showDate && <span className="text-[13px] text-muted-foreground">{shortDay(bag.date)}</span>}</div>
    <p className="min-w-0 text-[13px] text-slate-600">{bag.lines.length ? bagContent(bag) : 'Sin contenido configurado'}{bag.issue && <span className="block font-medium text-orange-900">{bag.issue}</span>}</p>
    <div className="sm:justify-self-end"><BagChip bag={bag} /></div>
  </li>)}</ul>;
}
