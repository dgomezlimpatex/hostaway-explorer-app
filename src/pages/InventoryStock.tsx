import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowDownToLine, ClipboardCheck, Package, Search, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StockLayout } from '@/components/stock/StockLayout';
import { StockAdjustmentDialog } from '@/components/stock/StockAdjustmentDialog';
import { StockBulkSetupDialog } from '@/components/stock/StockBulkSetupDialog';
import { StockCountDialog } from '@/components/stock/StockCountDialog';
import { StockProductDialog } from '@/components/stock/StockProductDialog';
import { StockTransferDialog } from '@/components/stock/StockTransferDialog';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import { useInventoryWorkspace } from '@/features/inventory/useInventoryWorkspace';
import { InventoryBadge, InventoryEmpty, InventoryPanel, InventoryPeriod, WorkspaceNotice } from '@/features/inventory/InventoryComponents';
import { levelState, materialFamily, normalizeMaterial, quantity, updatedLabel, type MaterialFamily } from '@/features/inventory/inventoryDomain';
import type { StockItemKind, StockLevel, StockProduct } from '@/types/stock';

interface InventoryStockProps { kind?: StockItemKind; title?: string; description?: string; }
export default function InventoryStock({ kind }: InventoryStockProps) {
  const [params, setParams] = useSearchParams();
  const [days, setDays] = useState(3);
  const w = useInventoryWorkspace(days);
  const { hasPermission, isAdminOrManager } = useRolePermissions();
  const canEdit = hasPermission('inventory', 'canEdit');
  const canCreate = hasPermission('inventory', 'canCreate');
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<'count' | 'setup' | 'adjust' | 'transfer' | 'product' | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<StockLevel | null>(null);
  const [product, setProduct] = useState<StockProduct | null>(null);
  const family = params.get('family') || (kind === 'laundry' ? 'linen' : kind === 'amenity' ? 'supplies' : 'all');
  const warehouse = params.has('warehouse') ? w.warehouses.find(item => item.id === params.get('warehouse')) : w.central;
  const levels = warehouse ? w.levels.filter(level => level.warehouse_id === warehouse.id) : [];
  const attention = params.get('status') === 'attention';
  const filtered = levels.filter(level => level.product && (family === 'all' || materialFamily(level.product) === family)
    && normalizeMaterial(level.product.name).includes(normalizeMaterial(search))
    && (!attention || ['shortage', 'replenish'].includes(levelState(level, warehouse?.id === w.central?.id ? w.demand.get(level.product_id) : 0).state))
    && (params.get('status') !== 'empty' || level.current_quantity - (level.reserved_quantity ?? 0) <= 0)
    && (params.get('status') !== 'unknown' || levelState(level).state === 'unknown')
    && (params.get('status') !== 'low' || level.current_quantity - (level.reserved_quantity ?? 0) > 0 && level.minimum_quantity > 0 && level.current_quantity - (level.reserved_quantity ?? 0) <= level.minimum_quantity));
  const setFilter = (key: string, value: string) => { const next = new URLSearchParams(params); if (!value) next.delete(key); else next.set(key, value); setParams(next); };
  const act = (level: StockLevel, action: typeof dialog) => { setSelectedLevel(level); setProduct(level.product ?? null); setDialog(action); };
  const families: Array<[MaterialFamily | 'all', string]> = [['all', 'Todo'], ['linen', 'Ropa'], ['supplies', 'Consumibles'], ['spares', 'Repuestos']];
  return <StockLayout title={warehouse && warehouse.id !== w.central?.id ? warehouse.name : 'Almacén central'} description={warehouse?.id === w.central?.id ? `${warehouse.name} · Ropa, consumibles y repuestos desde los que se abastece el reparto.` : 'Consulta una ubicación sin mezclar sus existencias con las demás.'}>
    <WorkspaceNotice workspace={w} />
    {!w.stockLoading && !w.stockError && warehouse && <>
      <div className="flex flex-wrap items-center justify-between gap-3"><InventoryPeriod days={days} onChange={setDays} from={w.from} to={w.to} /><div className="flex flex-wrap gap-2">{isAdminOrManager() && warehouse.id === w.central?.id && <Button asChild><Link to="/inventory/laundry/receipts"><ArrowDownToLine className="mr-2 h-4 w-4" />Recepciones de ropa</Link></Button>}{canEdit && <Button variant="outline" onClick={() => setDialog('count')} disabled={!filtered.length}><ClipboardCheck className="mr-2 h-4 w-4" />Contar existencias</Button>}</div></div>
      <InventoryPanel title={warehouse.name} description="El saldo registrado es una referencia. Por preparar excluye las mudas ya preparadas o entregadas.">
        <div className="space-y-4 border-b p-4"><div className="flex flex-wrap items-center gap-2">{families.map(([value, label]) => <Button key={value} variant={family === value ? 'default' : 'outline'} size="sm" aria-pressed={family === value} onClick={() => setFilter('family', value)}>{label}</Button>)}<Button size="sm" variant={attention ? 'secondary' : 'ghost'} aria-pressed={attention} onClick={() => setFilter('status', attention ? '' : 'attention')}>Solo necesidades</Button></div><div className="relative max-w-md"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" aria-label="Buscar producto" placeholder="Buscar producto…" value={search} onChange={e => setSearch(e.target.value)} /></div></div>
        {!filtered.length ? <InventoryEmpty>{levels.length ? 'No hay productos para estos filtros. Prueba con Todo o borra la búsqueda.' : 'No hay existencias registradas en esta ubicación. Revisa el catálogo antes de hacer un recuento.'}</InventoryEmpty> : <div className="divide-y">{filtered.map(level => {
          const needs = warehouse.id === w.central?.id && w.demandReady ? w.demand.get(level.product_id) ?? 0 : null;
          const status = levelState(level, needs ?? 0);
          return <details key={level.id} className="group p-4 sm:px-5" open={params.get('product') === level.product_id || undefined}>
            <summary className="cursor-pointer list-none rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><div className="grid items-center gap-3 sm:grid-cols-[minmax(160px,1fr)_100px_100px_170px]"><div><h3 className="font-semibold">{level.product?.name}</h3><p className="mt-1 text-xs text-muted-foreground">{level.product?.unit_of_measure} · Ver detalle y operaciones</p></div><div><p className="text-[11px] text-muted-foreground">Stock registrado</p><p className="text-xl font-semibold tabular-nums">{quantity(level.current_quantity)}</p></div><div><p className="text-[11px] text-muted-foreground">Por preparar</p><p className="text-xl font-semibold tabular-nums">{materialFamily(level.product!) === 'spares' ? '—' : needs === null ? '—' : quantity(needs)}</p></div><div><InventoryBadge state={status.state}>{status.label}</InventoryBadge></div></div></summary>
            <div className="mt-4 space-y-3 rounded-xl bg-slate-50 p-4">{level.reserved_quantity !== undefined && <p className="text-sm"><strong>{quantity(level.current_quantity - level.reserved_quantity)}</strong> disponibles · <strong>{quantity(level.reserved_quantity)}</strong> reservadas en bolsas, incluidas en el stock registrado.</p>}<p className="text-xs text-muted-foreground">Último movimiento del saldo: {updatedLabel(level.last_updated)}. Esta fecha no equivale a un recuento físico.</p><div className="flex flex-wrap gap-x-6 gap-y-2 text-sm"><span>Reserva mínima: <strong>{quantity(level.minimum_quantity)}</strong></span><span>Reserva deseada: <strong>{quantity(level.target_quantity)}</strong></span><span>Coste unitario: <strong>{level.cost_per_unit === null ? 'Sin configurar' : new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(level.cost_per_unit)}</strong></span></div>{canEdit && <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => act(level, 'adjust')}>Registrar entrada o salida</Button><Button size="sm" variant="outline" onClick={() => act(level, 'transfer')}>Mover a otra ubicación</Button><Button size="sm" variant="ghost" onClick={() => act(level, 'product')}>Editar producto</Button></div>}</div>
          </details>;
        })}</div>}
      </InventoryPanel>
      <details className="rounded-xl border bg-white p-4"><summary className="cursor-pointer text-sm font-semibold text-muted-foreground">Otras ubicaciones y configuración</summary><div className="mt-4 flex flex-wrap gap-3"><label className="text-sm">Consultar ubicación <select aria-label="Consultar ubicación" className="ml-2 max-w-full rounded-lg border p-2" value={warehouse.id} onChange={e => setFilter('warehouse', e.target.value === w.central?.id ? '' : e.target.value)}>{w.warehouses.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{canEdit && <Button variant="outline" size="sm" onClick={() => setDialog('setup')}><SlidersHorizontal className="mr-2 h-4 w-4" />Configurar reservas</Button>}{canCreate && <Button variant="outline" size="sm" onClick={() => { setProduct(null); setDialog('product'); }}><Package className="mr-2 h-4 w-4" />Nuevo producto</Button>}</div></details>
      <StockCountDialog open={dialog === 'count'} onOpenChange={open => !open && setDialog(null)} levels={filtered} />
      <StockBulkSetupDialog open={dialog === 'setup'} onOpenChange={open => !open && setDialog(null)} levels={filtered} />
      <StockAdjustmentDialog open={dialog === 'adjust'} onOpenChange={open => !open && setDialog(null)} level={selectedLevel} />
      <StockTransferDialog open={dialog === 'transfer'} onOpenChange={open => !open && setDialog(null)} level={selectedLevel} />
      <StockProductDialog open={dialog === 'product'} onOpenChange={open => !open && setDialog(null)} product={product} initialWarehouseId={warehouse.id} />
    </>}
    {!w.stockLoading && !w.stockError && !warehouse && params.has('warehouse') && <InventoryEmpty>Esta ubicación ya no está disponible. <Link to="/inventory/stock" className="text-primary underline">Volver al almacén central</Link></InventoryEmpty>}
  </StockLayout>;
}
