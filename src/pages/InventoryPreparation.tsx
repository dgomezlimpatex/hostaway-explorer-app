import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StockLayout } from '@/components/stock/StockLayout';
import { useInventoryWorkspace } from '@/features/inventory/useInventoryWorkspace';
import { useInventoryDays } from '@/features/inventory/useInventoryDays';
import { BagRows, EmptyState, ErrorState, PeriodSelect, SearchBox, Section, Segmented, StatusChip, TextLink, WorkspaceStatus } from '@/features/inventory/InventoryComponents';
import { quantity } from '@/features/inventory/inventoryDomain';
import { bagCounts, filterBags, groupBagsByDestination, levelTone, type BagFilter } from '@/features/inventory/inventoryViews';
import { cn } from '@/lib/utils';

const filters: Array<[BagFilter, string]> = [['pending', 'Por preparar'], ['prepared', 'Preparadas'], ['delivered', 'Entrega confirmada'], ['issue', 'Incidencias'], ['all', 'Todas']];
export default function InventoryPreparation() {
  const [params, setParams] = useSearchParams();
  const [days, setDays] = useInventoryDays();
  const [search, setSearch] = useState('');
  const [materialOpen, setMaterialOpen] = useState(() => typeof window === 'undefined' || window.matchMedia?.('(min-width: 1024px)').matches !== false);
  const w = useInventoryWorkspace(days);
  const requested = params.get('estado') as BagFilter | null;
  const filter: BagFilter = requested && filters.some(([value]) => value === requested) ? requested : 'pending';
  const setFilter = (value: BagFilter) => { const next = new URLSearchParams(params); next.set('estado', value); setParams(next, { replace: true }); };
  const counts = bagCounts(w.bags);
  const bags = filterBags(w.bags, filter, search, w.warehouses);
  const groups = groupBagsByDestination(bags, w.warehouses);
  const material = [...w.demand.entries()].map(([productId, amount]) => ({ productId, amount, product: w.products.find(p => p.id === productId), level: w.centralLevels.find(l => l.product_id === productId) }))
    .sort((a, b) => (a.product?.name ?? '').localeCompare(b.product?.name ?? '', 'es'));
  return <StockLayout title="Mudas y reparto" description="Qué hay que preparar para cada limpieza y qué se ha entregado. Una misma muda aparece una sola vez.">
    <div className="flex flex-wrap items-center justify-between gap-3"><PeriodSelect days={days} onChange={setDays} from={w.from} to={w.to} /><Button asChild><Link to="/lavanderia/nuevo-sistema">Abrir ruta de preparación</Link></Button></div>
    <WorkspaceStatus workspace={w} />
    {!w.stockLoading && !w.stockError && <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section aria-label="Mudas" className="inv-surface order-2 overflow-hidden lg:order-1">
        <div className="space-y-2 border-b p-3"><Segmented label="Estado de las mudas" options={filters.map(([value, label]) => ({ value, label, count: w.demandReady ? counts[value] : null }))} value={filter} onChange={setFilter} />
          <SearchBox className="sm:w-80" label="Buscar propiedad o edificio" placeholder="Buscar propiedad o edificio" value={search} onChange={setSearch} /></div>
        {!w.demandReady ? (w.demandError ? <div className="p-4"><ErrorState title="No se pudieron cargar las mudas" onRetry={() => void w.refresh()}>Reintenta la consulta. No se muestran como cero.</ErrorState></div> : <p role="status" className="px-4 py-6 text-sm text-muted-foreground">Consultando limpiezas y preparación…</p>)
          : !bags.length ? <EmptyState action={search || filter !== 'all' ? <Button variant="outline" size="sm" onClick={() => { setSearch(''); setFilter('all'); }}>Ver todas las mudas</Button> : undefined}>No hay mudas con estos filtros en el período seleccionado.</EmptyState>
          : groups.map(group => <div key={group.id ?? 'sin-destino'}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50/70 px-4 py-2"><h2 className="text-sm font-semibold text-slate-900">{group.name} <span className="font-normal text-muted-foreground">· {group.bags.length} {group.bags.length === 1 ? 'muda' : 'mudas'}</span></h2>
              {group.id ? <TextLink to={`/inventory/warehouses?edificio=${group.id}`} className="text-[13px]">Ver edificio</TextLink> : <span className="text-[13px] text-orange-900">Revisa la asignación del edificio</span>}</div>
            <BagRows bags={group.bags} />
          </div>)}
      </section>
      <section aria-labelledby="material-title" className="inv-surface order-1 overflow-hidden lg:order-2">
        <button type="button" className="inv-row-button flex w-full items-center justify-between gap-3 px-4 py-3 text-left" aria-expanded={materialOpen} aria-controls="material-list" onClick={() => setMaterialOpen(open => !open)}>
          <span><span id="material-title" className="block text-[15px] font-semibold text-slate-950">Material para preparar</span><span className="block text-[13px] text-muted-foreground">Suma de las mudas por preparar del período</span></span>
          <ChevronDown aria-hidden className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', materialOpen && 'rotate-180')} /></button>
        {materialOpen && <div id="material-list" className="border-t">
          {!w.demandReady ? <p className="px-4 py-4 text-sm text-muted-foreground">{w.demandError ? 'Sin datos de mudas: no se puede calcular.' : 'Consultando…'}</p>
            : !material.length ? <p className="px-4 py-4 text-sm text-muted-foreground">No hay material pendiente de preparar.</p>
            : <table className="w-full"><caption className="sr-only">Material necesario y disponible en el almacén central</caption><thead><tr className="text-left text-muted-foreground"><th className="px-4 py-2 font-semibold">Producto</th><th className="px-2 py-2 text-right font-semibold">Necesario</th><th className="px-4 py-2 text-right font-semibold">En central</th></tr></thead>
              <tbody className="divide-y">{material.map(item => { const tone = item.level ? levelTone(item.level, item.amount) : null; return <tr key={item.productId}>
                <th scope="row" className="px-4 py-2 text-left font-medium text-slate-900">{item.product?.name ?? 'Producto'}{tone && ['shortage', 'check', 'partial'].includes(tone.tone) && <StatusChip tone={tone.tone} className="mt-1 flex w-fit">{tone.label}</StatusChip>}{!item.level && <StatusChip tone="check" className="mt-1 flex w-fit">Sin saldo en el almacén central</StatusChip>}</th>
                <td className="px-2 py-2 text-right align-top tabular-nums font-semibold">{quantity(item.amount)}</td>
                <td className="px-4 py-2 text-right align-top tabular-nums">{item.level ? quantity(item.level.current_quantity - (item.level.reserved_quantity ?? 0)) : '—'}</td></tr>; })}</tbody></table>}
          <p className="border-t px-4 py-2.5 text-[13px] text-muted-foreground">«En central» es el saldo registrado disponible, no un recuento. Preparar y entregar se registran en la ruta de preparación; esta página no cambia bolsas ni existencias.</p>
        </div>}
      </section>
    </div>}
  </StockLayout>;
}
