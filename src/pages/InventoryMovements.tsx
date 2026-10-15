import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { StockLayout } from '@/components/stock/StockLayout';
import { useStockMovements, useStockProducts, useStockWarehouses } from '@/hooks/useStock';
import { EmptyState, ErrorState, SearchBox } from '@/features/inventory/InventoryComponents';
import { quantity } from '@/features/inventory/inventoryDomain';
import { filterMovements, locationName, movementChange, movementLabels, movementTime } from '@/features/inventory/inventoryViews';
import { cn } from '@/lib/utils';

const limit = 150;
export default function InventoryMovements() {
  const { data: movements = [], isLoading, isError, refetch } = useStockMovements(limit);
  const { data: warehouses = [] } = useStockWarehouses();
  const { data: products = [] } = useStockProducts();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const type = params.get('tipo') || 'all';
  const warehouseId = params.get('warehouse') || '';
  const productId = params.get('product') || '';
  const setParam = (key: string, value: string) => { const next = new URLSearchParams(params); next.set(key, value); setParams(next, { replace: true }); };
  const filtered = filterMovements(movements, { search, type, warehouseId, productId });
  const product = products.find(p => p.id === productId);
  const filtering = !!(search || type !== 'all' || warehouseId || productId);
  return <StockLayout title="Historial" description="Entradas, salidas, recuentos, consumos y traslados, con el saldo antes y después.">
    <section aria-label="Movimientos" className="inv-surface overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <SearchBox className="w-full sm:w-72" label="Buscar movimientos" placeholder="Producto, ubicación o motivo" value={search} onChange={setSearch} />
        <select aria-label="Tipo de movimiento" className="inv-control" value={type} onChange={e => setParam('tipo', e.target.value === 'all' ? '' : e.target.value)}><option value="all">Todos los tipos</option>{Object.entries(movementLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select aria-label="Ubicación" className="inv-control max-w-[14rem]" value={warehouseId} onChange={e => setParam('warehouse', e.target.value)}><option value="">Todas las ubicaciones</option>{warehouses.map(w => <option key={w.id} value={w.id}>{locationName(w.name)}</option>)}</select>
        {productId && <span className="inline-flex items-center gap-2 rounded-md border bg-primary/[.04] px-2 py-1 text-[13px]">Producto: <strong>{product?.name ?? 'seleccionado'}</strong></span>}
        {filtering && <Button variant="ghost" size="sm" className="h-10" onClick={() => { setSearch(''); setParams(new URLSearchParams(), { replace: true }); }}>Quitar filtros</Button>}
      </div>
      {isError ? <div className="p-4"><ErrorState title="No se pudo consultar el historial" onRetry={() => void refetch()}>Los movimientos no se muestran hasta poder consultarlos.</ErrorState></div>
        : isLoading ? <p role="status" className="px-4 py-6 text-sm text-muted-foreground">Consultando movimientos…</p>
        : !filtered.length ? <EmptyState>{movements.length ? 'Ningún movimiento coincide con estos filtros.' : 'No hay movimientos registrados.'}</EmptyState>
        : <>
          <div aria-hidden className="inv-head hidden grid-cols-[8.5rem_minmax(9rem,1fr)_9.5rem_minmax(9rem,1fr)_7.5rem_minmax(10rem,1.3fr)] gap-4 px-4 py-2 md:grid"><span>Fecha</span><span>Producto</span><span>Movimiento</span><span>Ubicación</span><span className="text-right">Saldo</span><span>Motivo</span></div>
          <ul className="divide-y">{filtered.map(m => { const change = movementChange(m); return <li key={m.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-0.5 px-4 py-2.5 md:grid-cols-[8.5rem_minmax(9rem,1fr)_9.5rem_minmax(9rem,1fr)_7.5rem_minmax(10rem,1.3fr)] md:items-center">
            <span className="order-3 text-[13px] text-muted-foreground md:order-none">{movementTime(m.created_at)}</span>
            <span className="order-1 text-sm font-semibold text-slate-950 md:order-none">{m.product?.name ?? 'Producto'}</span>
            <span className="order-2 justify-self-end text-sm md:order-none md:justify-self-start"><span className="text-muted-foreground">{movementLabels[m.movement_type] ?? m.movement_type}</span> <strong className={cn('tabular-nums', change.sign < 0 && 'text-red-700', change.sign > 0 && 'text-emerald-700')}>{change.text}</strong></span>
            <span className="order-5 col-span-2 text-[13px] text-slate-700 md:order-none md:col-span-1">{locationName(m.warehouse?.name)}{m.to_warehouse ? ` → ${locationName(m.to_warehouse.name)}` : ''}</span>
            <span className="order-4 justify-self-end text-right text-[13px] tabular-nums text-slate-700 md:order-none md:justify-self-stretch"><span className="text-muted-foreground md:sr-only">Saldo </span>{quantity(m.previous_quantity)} → <strong className="text-slate-950">{quantity(m.new_quantity)}</strong></span>
            <span className="order-6 col-span-2 text-[13px] text-muted-foreground md:order-none md:col-span-1">{m.reason || 'Sin motivo'}</span>
          </li>; })}</ul>
        </>}
      <p className="border-t px-4 py-2.5 text-[13px] text-muted-foreground">{isLoading || isError ? '' : `${filtered.length} de los últimos ${limit} movimientos de la sede. Para rangos de fechas completos, usa Informes.`}</p>
    </section>
  </StockLayout>;
}
