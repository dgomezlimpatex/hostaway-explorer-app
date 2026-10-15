import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { StockLayout } from '@/components/stock/StockLayout';
import WarehouseSettings from '@/components/stock/WarehouseSettings';
import { useInventoryWorkspace } from '@/features/inventory/useInventoryWorkspace';
import { useInventoryDays } from '@/features/inventory/useInventoryDays';
import { BagRows, EmptyState, PeriodSelect, SearchBox, Segmented, StatusChip, WorkspaceStatus } from '@/features/inventory/InventoryComponents';
import { materialFamily, normalizeMaterial, quantity } from '@/features/inventory/inventoryDomain';
import { levelTone, locationName } from '@/features/inventory/inventoryViews';
import { cn } from '@/lib/utils';

export default function InventoryWarehouses() {
  const [params] = useSearchParams();
  return params.get('manage') === '1' ? <WarehouseSettings /> : <BuildingInventory />;
}
type Building = ReturnType<typeof useInventoryWorkspace>['buildings'][number];
type BuildingFilter = 'attention' | 'unknown' | 'all';
export function BuildingInventory() {
  const [params, setParams] = useSearchParams();
  const [days, setDays] = useInventoryDays();
  const [filter, setFilter] = useState<BuildingFilter>('attention');
  const [search, setSearch] = useState('');
  const w = useInventoryWorkspace(days);
  const selectedId = params.get('edificio');
  const matches = (b: Building, f: BuildingFilter) => f === 'all' || f === 'unknown' && b.unconfigured > 0 || f === 'attention' && b.needsAttention;
  const buildings = w.buildings.filter(b => normalizeMaterial(locationName(b.warehouse.name)).includes(normalizeMaterial(search)) && (search || matches(b, filter) || b.warehouse.id === selectedId));
  const selected = w.buildings.find(b => b.warehouse.id === selectedId) ?? null;
  // On wide screens the first building is shown until another is chosen, so the panel is never empty.
  const shown = selected ?? buildings[0] ?? null;
  const select = (id: string | null) => { const next = new URLSearchParams(params); next.set('edificio', id ?? ''); setParams(next, { replace: true }); };
  const options = [{ value: 'attention' as const, label: 'Necesitan atención', count: w.buildings.filter(b => matches(b, 'attention')).length }, { value: 'unknown' as const, label: 'Por comprobar', count: w.buildings.filter(b => matches(b, 'unknown')).length }, { value: 'all' as const, label: 'Todos', count: w.buildings.length }];
  return <StockLayout title="Edificios" description="Mudas y repuestos del trastero de cada edificio. Las existencias compartidas se cuentan una sola vez.">
    <div className="flex flex-wrap items-center justify-between gap-3"><PeriodSelect days={days} onChange={setDays} from={w.from} to={w.to} /></div>
    <WorkspaceStatus workspace={w} />
    {!w.stockLoading && !w.stockError && <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <section aria-label="Lista de edificios" className="inv-surface overflow-hidden">
        <div className="space-y-2 border-b p-3"><Segmented<BuildingFilter> label="Filtrar edificios" options={options} value={filter} onChange={setFilter} /><SearchBox label="Buscar edificio" placeholder="Buscar edificio" value={search} onChange={setSearch} /></div>
        {!buildings.length ? <EmptyState action={filter !== 'all' ? <Button variant="outline" size="sm" onClick={() => { setSearch(''); setFilter('all'); }}>Ver todos los edificios</Button> : undefined}>{filter === 'attention' && !search ? 'Ningún edificio tiene mudas por preparar ni repuestos por reponer. En «Por comprobar» están los repuestos sin reserva definida.' : 'No hay edificios para estos filtros.'}</EmptyState>
          : <ul className="divide-y">{buildings.map(b => { const active = b.warehouse.id === selectedId; return <li key={b.warehouse.id} className={cn(active ? 'bg-primary/[.045] shadow-[inset_3px_0_0_hsl(var(--primary))]' : b === shown && 'lg:bg-primary/[.045] lg:shadow-[inset_3px_0_0_hsl(var(--primary))]')}>
            <button type="button" aria-pressed={active} onClick={() => select(active ? null : b.warehouse.id)} className="inv-row-button grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-2.5 text-left hover:bg-primary/[.03]">
              <span className="truncate text-sm font-semibold text-slate-950">{locationName(b.warehouse.name)}</span>
              {b.needsAttention ? <StatusChip tone="replenish">Necesita atención</StatusChip> : b.unconfigured ? <StatusChip tone="undefined">Por comprobar</StatusChip> : <StatusChip tone="covered">Al día</StatusChip>}
              <span className="col-span-2 text-[13px] text-muted-foreground">{w.demandReady ? `${b.pending} ${b.pending === 1 ? 'muda' : 'mudas'} por preparar` : 'Mudas sin consultar'} · {b.replenishments.length} {b.replenishments.length === 1 ? 'repuesto' : 'repuestos'} por reponer · {b.unconfigured} sin reserva</span>
            </button>
            {active && <div className="border-t lg:hidden"><BuildingDetail building={b} demandReady={w.demandReady} /></div>}
          </li>; })}</ul>}
        <p className="border-t px-4 py-2.5 text-[13px] text-muted-foreground">{buildings.length} de {w.buildings.length} edificios</p>
      </section>
      <section aria-label="Ficha del edificio seleccionado" className="inv-surface hidden overflow-hidden lg:sticky lg:top-4 lg:block">
        {shown ? <BuildingDetail building={shown} demandReady={w.demandReady} heading /> : <EmptyState>No hay ningún edificio en la lista con estos filtros.</EmptyState>}
      </section>
    </div>}
  </StockLayout>;
}

function BuildingDetail({ building: b, demandReady, heading = false }: { building: Building; demandReady: boolean; heading?: boolean }) {
  const other = b.stored.filter(l => !l.product || materialFamily(l.product) !== 'spares');
  return <div>
    {heading && <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3"><h2 className="text-[15px] font-semibold text-slate-950">{locationName(b.warehouse.name)}</h2>
      <div className="flex flex-wrap gap-2"><Button asChild size="sm" variant="outline"><Link to={`/inventory/stock?warehouse=${b.warehouse.id}`}>Abrir existencias del trastero</Link></Button>{b.warehouse.property_group_id && <Button asChild size="sm" variant="ghost"><Link to={`/planning/buildings/${b.warehouse.property_group_id}`}>Ficha del edificio</Link></Button>}</div></div>}
    {!heading && <div className="flex flex-wrap gap-2 px-4 pt-3"><Button asChild size="sm" variant="outline"><Link to={`/inventory/stock?warehouse=${b.warehouse.id}`}>Abrir existencias del trastero</Link></Button>{b.warehouse.property_group_id && <Button asChild size="sm" variant="ghost"><Link to={`/planning/buildings/${b.warehouse.property_group_id}`}>Ficha del edificio</Link></Button>}</div>}
    <h3 className="px-4 pb-1 pt-3 text-sm font-semibold text-slate-900">Mudas para próximas limpiezas</h3>
    {!demandReady ? <EmptyState>No se han podido confirmar las mudas de este edificio.</EmptyState> : b.bags.length ? <BagRows bags={b.bags} /> : <EmptyState>No hay mudas vinculadas a este edificio en el período. Comprueba la asignación del edificio si esperabas una.</EmptyState>}
    <h3 className="border-t px-4 pb-1 pt-3 text-sm font-semibold text-slate-900">Repuestos del trastero</h3>
    {b.spares.length ? <ul className="divide-y">{b.spares.map(level => { const status = levelTone(level); return <li key={level.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-2">
      <span className="text-sm text-slate-900">{level.product?.name}<span className="block text-[13px] text-muted-foreground"><strong className="tabular-nums text-slate-900">{quantity(level.current_quantity)}</strong> registradas · reserva {Math.max(level.minimum_quantity, level.target_quantity) > 0 ? `${quantity(level.minimum_quantity)} – ${quantity(level.target_quantity)}` : 'sin definir'}</span></span>
      <StatusChip tone={status.tone}>{status.label}</StatusChip></li>; })}</ul> : <EmptyState>Sin repuestos registrados.</EmptyState>}
    {other.length > 0 && <details className="border-t px-4 py-3 text-[13px] text-muted-foreground"><summary className="cursor-pointer font-medium text-primary">Otras existencias registradas en el trastero ({other.length})</summary>
      <p className="my-2">Los saldos anteriores de ropa se conservan en su ubicación. No se convierten automáticamente en mudas ni se trasladan al almacén central.</p>
      <ul className="space-y-1">{other.map(level => <li key={level.id} className="flex justify-between gap-3"><span>{level.product?.name}</span><span className="tabular-nums text-slate-900">{quantity(level.current_quantity)}</span></li>)}</ul></details>}
  </div>;
}
