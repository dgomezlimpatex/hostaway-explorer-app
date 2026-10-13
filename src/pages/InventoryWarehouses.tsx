import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StockLayout } from '@/components/stock/StockLayout';
import WarehouseSettings from '@/components/stock/WarehouseSettings';
import { useInventoryWorkspace } from '@/features/inventory/useInventoryWorkspace';
import { BagList, InventoryBadge, InventoryEmpty, InventoryLink, InventoryPeriod, WorkspaceNotice } from '@/features/inventory/InventoryComponents';
import { levelState, normalizeMaterial, quantity } from '@/features/inventory/inventoryDomain';
export default function InventoryWarehouses() {
  const [params] = useSearchParams();
  return params.get('manage') === '1' ? <WarehouseSettings /> : <BuildingInventory />;
}
export function BuildingInventory() {
  const [days, setDays] = useState(3);
  const [filter, setFilter] = useState('attention');
  const [search, setSearch] = useState('');
  const w = useInventoryWorkspace(days);
  const buildings = w.buildings.filter(b => normalizeMaterial(b.warehouse.name).includes(normalizeMaterial(search)) && (search || filter === 'all' || filter === 'unknown' && b.unconfigured > 0 || filter === 'attention' && b.needsAttention));
  return <StockLayout title="Mudas y repuestos por edificio" description="Abre un edificio cuando necesites comprobarlo. Las existencias compartidas se cuentan una sola vez.">
    <WorkspaceNotice workspace={w} />
    {!w.stockLoading && !w.stockError && <>
      <InventoryPeriod days={days} onChange={setDays} from={w.from} to={w.to} />
      <div className="flex flex-wrap items-center gap-2">{[['attention', 'Necesitan atención'], ['unknown', 'Por comprobar'], ['all', 'Todos los edificios']].map(([value, label]) => <Button key={value} size="sm" variant={filter === value ? 'default' : 'outline'} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</Button>)}<Input className="w-full sm:ml-auto sm:w-72" aria-label="Buscar edificio" placeholder="Buscar un edificio…" value={search} onChange={e => setSearch(e.target.value)} /></div>
      <p className="text-xs text-muted-foreground">{buildings.length} de {w.buildings.length} ubicaciones · {w.demandReady ? 'Mudas consultadas para el período seleccionado' : 'Mudas pendientes de comprobar'}</p>
      {!buildings.length && <InventoryEmpty>{filter === 'attention' && !search ? 'No hay necesidades conocidas en esta vista. En Por comprobar puedes revisar los repuestos sin reserva definida.' : 'No hay edificios para estos filtros.'}</InventoryEmpty>}
      <div className="space-y-3">{buildings.map(b => <details key={b.warehouse.id} className="rounded-2xl border bg-white"><summary className="cursor-pointer list-none rounded-2xl p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">{b.warehouse.name.replace(/^TRASTERO\s*-\s*/i, '')}</h2><InventoryBadge state={b.needsAttention ? 'replenish' : 'unknown'}>{b.needsAttention ? 'Necesita atención' : 'Ver comprobación'}</InventoryBadge></div><p className="mt-2 text-xs text-muted-foreground">{w.demandReady ? `${b.pending} mudas por preparar` : 'Mudas sin consultar'} · {b.replenishments.length} repuestos por reponer · {b.unconfigured} por comprobar</p></summary>
        <div className="space-y-5 border-t p-4 sm:p-5"><section><h3 className="mb-2 font-semibold">Mudas para próximas limpiezas</h3>{!w.demandReady ? <InventoryEmpty>No se han podido confirmar las mudas de este edificio.</InventoryEmpty> : b.bags.length ? <BagList bags={b.bags} /> : <InventoryEmpty>No hay mudas vinculadas a esta ubicación en el período. Comprueba la asignación del edificio si esperabas una.</InventoryEmpty>}</section>
          <section><h3 className="mb-3 font-semibold">Repuestos del edificio</h3>{b.spares.length ? <div className="divide-y rounded-xl border">{b.spares.map(level => { const status = levelState(level); return <Link key={level.id} to={`/inventory/stock?warehouse=${b.warehouse.id}&family=spares&product=${level.product_id}`} className="flex flex-wrap items-center justify-between gap-2 p-3 hover:bg-slate-50"><span className="text-sm">{level.product?.name} · <strong>{quantity(level.current_quantity)}</strong> registradas</span><InventoryBadge state={status.state}>{status.label}</InventoryBadge></Link>; })}</div> : <p className="text-sm text-muted-foreground">Sin repuestos registrados.</p>}</section>
          <div className="flex flex-wrap gap-4"><InventoryLink to={`/inventory/stock?warehouse=${b.warehouse.id}&family=spares`}>Comprobar o reponer</InventoryLink>{b.warehouse.property_group_id && <InventoryLink to={`/planning/buildings/${b.warehouse.property_group_id}`}>Ficha del edificio</InventoryLink>}</div>
          <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Consultar el resto de existencias registradas</summary><p className="my-2">Los saldos anteriores de ropa se conservan en su ubicación. No se convierten automáticamente en mudas ni se trasladan al almacén central.</p><InventoryLink to={`/inventory/stock?warehouse=${b.warehouse.id}`}>Ver existencias</InventoryLink></details>
        </div>
      </details>)}</div>
    </>}
  </StockLayout>;
}
