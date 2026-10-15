import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowDownToLine, ChevronDown, ClipboardCheck, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { StockLayout } from '@/components/stock/StockLayout';
import { StockAdjustmentDialog } from '@/components/stock/StockAdjustmentDialog';
import { StockBulkSetupDialog } from '@/components/stock/StockBulkSetupDialog';
import { StockCountDialog } from '@/components/stock/StockCountDialog';
import { StockProductDialog } from '@/components/stock/StockProductDialog';
import { StockTransferDialog } from '@/components/stock/StockTransferDialog';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import { useInventoryWorkspace } from '@/features/inventory/useInventoryWorkspace';
import { useInventoryDays } from '@/features/inventory/useInventoryDays';
import { EmptyState, PeriodSelect, SearchBox, Segmented, StatusChip, WorkspaceStatus } from '@/features/inventory/InventoryComponents';
import { materialFamily, normalizeMaterial, quantity, updatedLabel, type MaterialFamily } from '@/features/inventory/inventoryDomain';
import { groupByFamily, levelTone, locationName, matchesStockStatus } from '@/features/inventory/inventoryViews';
import { cn } from '@/lib/utils';
import type { StockItemKind, StockLevel, StockProduct } from '@/types/stock';

type Dialog = 'count' | 'setup' | 'adjust' | 'transfer' | 'product' | null;
interface InventoryStockProps { kind?: StockItemKind; title?: string; description?: string; }
export default function InventoryStock({ kind }: InventoryStockProps) {
  const [params, setParams] = useSearchParams();
  const [days, setDays] = useInventoryDays();
  const w = useInventoryWorkspace(days);
  const { hasPermission, isAdminOrManager } = useRolePermissions();
  const canEdit = hasPermission('inventory', 'canEdit');
  const canCreate = hasPermission('inventory', 'canCreate');
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [selectedLevel, setSelectedLevel] = useState<StockLevel | null>(null);
  const [product, setProduct] = useState<StockProduct | null>(null);
  const family = params.get('family') || (kind === 'laundry' ? 'linen' : kind === 'amenity' ? 'supplies' : 'all');
  const warehouse = params.has('warehouse') ? w.warehouses.find(item => item.id === params.get('warehouse')) : w.central;
  const isCentral = !!warehouse && warehouse.id === w.central?.id;
  const levels = warehouse ? w.levels.filter(level => level.warehouse_id === warehouse.id) : [];
  const status = params.get('status') ?? '';
  const needed = (level: StockLevel) => isCentral ? w.demand.get(level.product_id) ?? 0 : 0;
  const term = normalizeMaterial(search);
  const inFamily = levels.filter(level => level.product && (family === 'all' || materialFamily(level.product) === family)
    && (normalizeMaterial(level.product.name).includes(term) || normalizeMaterial(level.product.sku ?? '').includes(term)));
  const filtered = inFamily.filter(level => matchesStockStatus(level, status, needed(level)));
  const setFilter = (key: string, value: string) => { const next = new URLSearchParams(params); if (!value) next.delete(key); else next.set(key, value); setParams(next); };
  const act = (level: StockLevel, action: Dialog) => { setSelectedLevel(level); setProduct(level.product ?? null); setDialog(action); };
  const families: Array<{ value: MaterialFamily | 'all'; label: string }> = [{ value: 'all', label: 'Todo' }, { value: 'linen', label: 'Ropa' }, { value: 'supplies', label: 'Consumibles' }, { value: 'spares', label: 'Repuestos' }];
  const count = (filter: string) => inFamily.filter(level => matchesStockStatus(level, filter, needed(level))).length;
  const statuses = [{ value: '', label: 'Todos', count: inFamily.length }, { value: 'attention', label: 'Necesitan atención', count: count('attention') }, { value: 'check', label: 'Comprobar saldo', count: count('check') }, { value: 'unknown', label: 'Sin reserva o por revisar', count: count('unknown') }];
  const showNeeds = isCentral;
  const grid = showNeeds ? 'md:grid-cols-[minmax(11rem,1.5fr)_6.5rem_6rem_8.5rem_minmax(10.5rem,1fr)_10rem]' : 'md:grid-cols-[minmax(11rem,1.5fr)_6.5rem_8.5rem_minmax(10.5rem,1fr)_10rem]';
  const clearFilters = () => { setSearch(''); setParams(warehouse && !isCentral ? new URLSearchParams({ warehouse: warehouse.id }) : new URLSearchParams()); };
  const storage = w.warehouses.filter(item => item.is_active && item.location_type === 'building_storage');
  const others = w.warehouses.filter(item => item.is_active && item.location_type !== 'building_storage');
  return <StockLayout title={warehouse && !isCentral ? locationName(warehouse.name) : 'Almacén central'} description={isCentral ? `${warehouse.name} · Existencias desde las que se prepara el reparto.` : warehouse ? 'Existencias de esta ubicación, sin mezclarlas con las demás.' : undefined}>
    <WorkspaceStatus workspace={w} />
    {!w.stockLoading && !w.stockError && warehouse && <>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">Ubicación
          <select aria-label="Consultar ubicación" className="inv-control w-56 font-medium text-slate-900" value={warehouse.id} onChange={e => setFilter('warehouse', e.target.value === w.central?.id ? '' : e.target.value)}>
            <optgroup label="Almacenes">{others.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>
            {storage.length > 0 && <optgroup label="Trasteros de edificios">{storage.map(item => <option key={item.id} value={item.id}>{locationName(item.name)}</option>)}</optgroup>}
          </select></label>
        {showNeeds && <PeriodSelect days={days} onChange={setDays} from={w.from} to={w.to} />}
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          {isAdminOrManager() && isCentral && <Button asChild><Link to="/inventory/laundry/receipts"><ArrowDownToLine className="mr-2 h-4 w-4" />Recepciones de ropa</Link></Button>}
          {canEdit && <Button variant="outline" onClick={() => setDialog('count')} disabled={!filtered.length}><ClipboardCheck className="mr-2 h-4 w-4" />Contar existencias</Button>}
          {(canEdit || canCreate) && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline"><MoreHorizontal className="mr-2 h-4 w-4" />Más</Button></DropdownMenuTrigger><DropdownMenuContent align="end">
            {canEdit && <DropdownMenuItem disabled={!filtered.length} onSelect={() => setDialog('setup')}>Configurar reservas de la lista</DropdownMenuItem>}
            {canCreate && <DropdownMenuItem onSelect={() => { setProduct(null); setDialog('product'); }}>Nuevo producto</DropdownMenuItem>}
          </DropdownMenuContent></DropdownMenu>}
        </div>
      </div>
      <section aria-label={`Existencias de ${warehouse.name}`} className="inv-surface overflow-hidden">
        <div className="space-y-2 border-b p-3">
          <div className="flex flex-wrap items-center gap-2"><Segmented label="Tipo de material" options={families} value={family as MaterialFamily | 'all'} onChange={value => setFilter('family', value)} /><SearchBox className="w-full sm:ml-auto sm:w-72" label="Buscar producto" placeholder="Buscar producto o referencia" value={search} onChange={setSearch} /></div>
          <Segmented label="Estado" options={statuses} value={status} onChange={value => setFilter('status', value)} />
        </div>
        {!filtered.length ? <EmptyState action={levels.length ? <Button variant="outline" size="sm" onClick={clearFilters}>Quitar filtros</Button> : canCreate ? <Button variant="outline" size="sm" onClick={() => { setProduct(null); setDialog('product'); }}>Nuevo producto</Button> : undefined}>
          {levels.length ? 'Ningún producto coincide con estos filtros.' : 'No hay existencias registradas en esta ubicación.'}</EmptyState> : <>
          <div aria-hidden className={cn('inv-head hidden gap-4 px-4 py-2 md:grid', grid)}><span>Producto</span><span className="text-right">Stock</span>{showNeeds && <span className="text-right">Para mudas</span>}<span className="text-right">Reserva mín.–deseada</span><span>Estado</span><span /></div>
          {groupByFamily(filtered).map(group => <div key={group.family}>
            {family === 'all' && <h2 className="border-b bg-slate-50/70 px-4 py-1.5 text-[13px] font-semibold text-slate-700">{group.label} <span className="font-normal text-muted-foreground">· {group.levels.length}</span></h2>}
            <ul className="divide-y">{group.levels.map(level => <StockRow key={level.id} level={level} grid={grid} showNeeds={showNeeds} needed={isCentral && w.demandReady ? w.demand.get(level.product_id) ?? 0 : null}
              open={params.get('product') === level.product_id} onToggle={() => setFilter('product', params.get('product') === level.product_id ? '' : level.product_id)} canEdit={canEdit} onAction={action => act(level, action)} />)}</ul>
          </div>)}
          <p className="border-t px-4 py-2.5 text-[13px] text-muted-foreground">{filtered.length} de {levels.length} productos · El stock es el saldo registrado{showNeeds ? '; «Para mudas» suma las mudas aún sin preparar del período' : ''}.</p>
        </>}
      </section>
      <StockCountDialog open={dialog === 'count'} onOpenChange={open => !open && setDialog(null)} levels={filtered} />
      <StockBulkSetupDialog open={dialog === 'setup'} onOpenChange={open => !open && setDialog(null)} levels={filtered} />
      <StockAdjustmentDialog open={dialog === 'adjust'} onOpenChange={open => !open && setDialog(null)} level={selectedLevel} />
      <StockTransferDialog open={dialog === 'transfer'} onOpenChange={open => !open && setDialog(null)} level={selectedLevel} />
      <StockProductDialog open={dialog === 'product'} onOpenChange={open => !open && setDialog(null)} product={product} initialWarehouseId={warehouse.id} />
    </>}
    {!w.stockLoading && !w.stockError && !warehouse && params.has('warehouse') && <EmptyState>Esta ubicación ya no está disponible. <Link to="/inventory/stock" className="text-primary underline">Volver al almacén central</Link></EmptyState>}
  </StockLayout>;
}

const basis = (level: StockLevel) => level.quantity_basis === 'partial' ? 'Saldo parcial' : level.quantity_basis === 'counted' ? 'Contado' : 'Registrado';
const euros = (value: number | null) => value === null ? 'Sin configurar' : new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
function StockRow({ level, grid, showNeeds, needed, open, onToggle, canEdit, onAction }: { level: StockLevel; grid: string; showNeeds: boolean; needed: number | null; open: boolean; onToggle: () => void; canEdit: boolean; onAction: (action: Dialog) => void }) {
  const spare = !!level.product && materialFamily(level.product) === 'spares';
  const status = levelTone(level, needed ?? 0);
  const reserved = Number(level.reserved_quantity ?? 0);
  const transferLocked = !!level.bag_accounting_active || level.quantity_basis === 'partial';
  const detailId = `detalle-${level.id}`;
  const target = Math.max(level.minimum_quantity, level.target_quantity);
  return <li className={cn(open && 'inv-selected')}>
    <div className={cn('grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-2.5 md:min-h-12', grid)}>
      <button type="button" className="inv-row-button col-span-2 flex min-w-0 items-center gap-2 rounded text-left md:col-span-1" aria-expanded={open} aria-controls={detailId} onClick={onToggle}>
        <ChevronDown aria-hidden className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
        <span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-950">{level.product?.name}</span><span className="block text-[13px] text-muted-foreground">{level.product?.unit_of_measure}</span></span>
      </button>
      <p className="flex items-baseline gap-1.5 md:block md:text-right"><span className="text-[13px] text-muted-foreground md:sr-only">Stock</span><span className="inv-num">{quantity(level.current_quantity)}</span><span className="block text-xs text-muted-foreground">{basis(level)}{reserved > 0 ? ` · ${quantity(reserved)} en bolsas` : ''}</span></p>
      {showNeeds && <p className="flex items-baseline gap-1.5 justify-self-end md:block md:text-right"><span className="text-[13px] text-muted-foreground md:sr-only">Para mudas</span><span className="inv-num">{spare || needed === null ? '—' : quantity(needed)}</span>{spare && <span className="sr-only">No aplica a repuestos</span>}{!spare && needed === null && <span className="sr-only">Mudas sin consultar</span>}</p>}
      <p className="text-[13px] md:text-right"><span className="text-muted-foreground md:sr-only">Reserva: </span>{target > 0 ? <span className="tabular-nums text-slate-800">{quantity(level.minimum_quantity)} – {quantity(level.target_quantity)}</span> : <span className="text-muted-foreground">Sin definir</span>}</p>
      <div className="justify-self-end md:justify-self-start"><StatusChip tone={status.tone}>{status.label}</StatusChip></div>
      {canEdit ? <div className="hidden justify-self-end md:block"><Button size="sm" variant="ghost" className="text-primary hover:bg-primary/[.06] hover:text-primary" onClick={() => onAction('adjust')}>Registrar movimiento</Button></div> : <span className="hidden md:block" />}
    </div>
    {open && <div id={detailId} className="space-y-3 border-t border-dashed px-4 pb-4 pt-3 md:pl-10">
      <dl className="grid gap-x-8 gap-y-2 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
        {level.reserved_quantity !== undefined && <div><dt className="text-muted-foreground">Disponible</dt><dd><strong className="tabular-nums">{quantity(level.current_quantity - reserved)}</strong> · {quantity(reserved)} reservadas en bolsas, incluidas en el stock</dd></div>}
        <div><dt className="text-muted-foreground">Último movimiento del saldo</dt><dd>{updatedLabel(level.last_updated)}</dd></div>
        <div><dt className="text-muted-foreground">Recuento físico</dt><dd>{level.quantity_basis === 'partial' ? 'Stock anterior pendiente de contar. Las bolsas preparadas ya están descontadas.' : level.counted_at ? `Comprobado ${updatedLabel(level.counted_at)}` : 'Sin recuento: la fecha del saldo no equivale a un recuento.'}</dd></div>
        <div><dt className="text-muted-foreground">Coste unitario</dt><dd>{euros(level.cost_per_unit)}</dd></div>
      </dl>
      <div className="flex flex-wrap items-center gap-2">
        {canEdit && <Button size="sm" onClick={() => onAction('adjust')}>Registrar movimiento</Button>}
        {canEdit && <Button size="sm" variant="outline" disabled={transferLocked} aria-describedby={transferLocked ? `${detailId}-lock` : undefined} onClick={() => onAction('transfer')}>Mover a otra ubicación</Button>}
        {canEdit && <Button size="sm" variant="ghost" onClick={() => onAction('product')}>Editar producto</Button>}
        <Button size="sm" variant="ghost" asChild><Link to={`/inventory/movements?product=${level.product_id}&warehouse=${level.warehouse_id}`}>Ver historial</Link></Button>
      </div>
      {canEdit && transferLocked && <p id={`${detailId}-lock`} className="text-[13px] text-muted-foreground">Mover se habilita con la apertura del circuito físico: este saldo se lleva por bolsas o está pendiente de recuento.</p>}
    </div>}
  </li>;
}
