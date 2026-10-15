import type { StockLevel, StockMovement, StockWarehouse } from '@/types/stock';
import { levelState, materialFamily, normalizeMaterial, quantity, type InventoryBag, type InventoryState, type MaterialFamily } from './inventoryDomain';

/** What a person must do with a level. Splits levelState's "unknown" without changing its rules. */
export type LevelTone = 'shortage' | 'replenish' | 'check' | 'partial' | 'undefined' | 'covered';
export function levelTone(level: StockLevel, needed = 0): { tone: LevelTone; label: string; missing: number } {
  const status = levelState(level, needed);
  if (status.state !== 'unknown') return { tone: status.state, label: status.label, missing: status.missing };
  if (level.quantity_basis === 'partial') return { tone: 'partial', label: status.label, missing: 0 };
  const available = Number(level.current_quantity) - Number(level.reserved_quantity ?? 0);
  if (!Number.isFinite(available) || available < 0 || !Number.isFinite(needed) || needed < 0) return { tone: 'check', label: status.label, missing: 0 };
  return { tone: 'undefined', label: status.label, missing: 0 };
}
export const toneState: Record<LevelTone, InventoryState> = { shortage: 'shortage', replenish: 'replenish', check: 'unknown', partial: 'unknown', undefined: 'unknown', covered: 'covered' };

export type StockStatusFilter = '' | 'attention' | 'check' | 'unknown' | 'empty' | 'low';
/** Same filters the central page already offered, plus "check" for discrepancies (negative or partial balances). */
export function matchesStockStatus(level: StockLevel, status: string, needed = 0): boolean {
  const available = level.current_quantity - (level.reserved_quantity ?? 0);
  if (status === 'attention') return ['shortage', 'replenish'].includes(levelState(level, needed).state);
  if (status === 'check') return ['check', 'partial'].includes(levelTone(level, needed).tone);
  if (status === 'unknown') return levelState(level).state === 'unknown';
  if (status === 'empty') return available <= 0;
  if (status === 'low') return available > 0 && level.minimum_quantity > 0 && available <= level.minimum_quantity;
  return true;
}

export const familyOrder: MaterialFamily[] = ['linen', 'supplies', 'spares'];
export const familyLabels: Record<MaterialFamily, string> = { linen: 'Ropa', supplies: 'Consumibles', spares: 'Repuestos' };
export function groupByFamily(levels: StockLevel[]) {
  return familyOrder.map(family => ({ family, label: familyLabels[family], levels: levels.filter(l => l.product && materialFamily(l.product) === family) })).filter(g => g.levels.length);
}

export const locationName = (name: string | null | undefined) => (name ?? 'Ubicación').replace(/^TRASTERO\s*-\s*/i, '');

export type BagFilter = 'pending' | 'prepared' | 'delivered' | 'issue' | 'all';
export function bagCounts(bags: InventoryBag[]) {
  return {
    pending: bags.filter(b => !['prepared', 'delivered'].includes(b.state)).length,
    prepared: bags.filter(b => b.state === 'prepared').length,
    delivered: bags.filter(b => b.state === 'delivered').length,
    issue: bags.filter(b => b.state === 'issue' || b.state === 'review').length,
    all: bags.length,
  };
}
export function matchesBagFilter(bag: InventoryBag, filter: string) {
  if (filter === 'pending') return !['prepared', 'delivered'].includes(bag.state);
  if (filter === 'issue') return bag.state === 'issue' || bag.state === 'review';
  if (filter === 'prepared' || filter === 'delivered') return bag.state === filter;
  return true;
}
/** Search by property code or destination building, accent-insensitive. */
export function filterBags(bags: InventoryBag[], filter: string, search: string, warehouses: StockWarehouse[]) {
  const term = normalizeMaterial(search);
  return bags.filter(bag => matchesBagFilter(bag, filter) && (!term || normalizeMaterial(bag.propertyCode).includes(term)
    || normalizeMaterial(locationName(warehouses.find(w => w.id === bag.warehouseId)?.name ?? '')).includes(term)));
}
export function groupBagsByDestination(bags: InventoryBag[], warehouses: StockWarehouse[]) {
  const ids = [...new Set(bags.map(b => b.warehouseId))];
  return ids.map(id => ({ id, name: id ? locationName(warehouses.find(w => w.id === id)?.name ?? 'Ubicación por comprobar') : 'Destino por comprobar', bags: bags.filter(b => b.warehouseId === id) }))
    .sort((a, b) => Number(!a.id) - Number(!b.id) || a.name.localeCompare(b.name, 'es'));
}
export const bagContent = (bag: InventoryBag) => bag.lines.map(line => `${quantity(line.quantity)} ${line.name}`).join(' · ');

const weekdays = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
/** Business date (YYYY-MM-DD) as "jue 15/10"; never converts through a timezone. */
export function shortDay(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const [y, m, d] = date.split('-').map(Number);
  return `${weekdays[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

/** Signed change of the origin balance; transfers report the moved quantity. */
export function movementChange(movement: Pick<StockMovement, 'movement_type' | 'quantity' | 'previous_quantity' | 'new_quantity'>) {
  if (movement.movement_type === 'transferencia') return { value: Number(movement.quantity), text: quantity(Number(movement.quantity)), sign: 0 as const };
  const delta = Number(movement.new_quantity) - Number(movement.previous_quantity);
  if (!Number.isFinite(delta)) return { value: NaN, text: '—', sign: 0 as const };
  const rounded = Math.round(delta * 100) / 100;
  return { value: rounded, text: rounded > 0 ? `+${quantity(rounded)}` : quantity(rounded), sign: Math.sign(rounded) as -1 | 0 | 1 };
}
export const movementLabels: Record<string, string> = { entrada: 'Entrada', salida: 'Salida', ajuste: 'Ajuste', consumo_automatico: 'Consumo automático', transferencia: 'Traslado' };
export const movementTime = (date: string) => Number.isFinite(Date.parse(date))
  ? new Date(date).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Sin fecha';
export function filterMovements(movements: StockMovement[], { search = '', type = 'all', warehouseId = '', productId = '' }: { search?: string; type?: string; warehouseId?: string; productId?: string }) {
  const term = normalizeMaterial(search);
  return movements.filter(m => (type === 'all' || m.movement_type === type)
    && (!warehouseId || m.warehouse_id === warehouseId || m.to_warehouse_id === warehouseId)
    && (!productId || m.product_id === productId)
    && (!term || [m.product?.name, m.warehouse?.name, m.to_warehouse?.name, m.reason].some(v => v && normalizeMaterial(v).includes(term))));
}

/** Simple adjustment preview: what the balance shown will become if nobody else changes it first. */
export function adjustmentResult(current: number, type: 'entrada' | 'salida' | 'ajuste', amount: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(amount) || amount < 0) return null;
  const value = type === 'entrada' ? current + amount : type === 'salida' ? current - amount : amount;
  return Math.round(value * 100) / 100;
}

export type ActionTone = 'shortage' | 'replenish' | 'check' | 'info';
export interface InventoryAction { id: string; tone: ActionTone; chip: string; title: string; reason: string; to: string; action: string }
interface ActionInput {
  central: StockWarehouse | null; centralLevels: StockLevel[]; demand: Map<string, number>; demandReady: boolean;
  bags: InventoryBag[]; buildings: Array<{ warehouse: StockWarehouse; replenishments: StockLevel[] }>; missingProducts: Array<{ id: string; name: string }>; to: string;
}
const names = (levels: StockLevel[]) => levels.slice(0, 3).map(l => l.product?.name ?? 'Producto').join(', ') + (levels.length > 3 ? ` y ${levels.length - 3} más` : '');
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
/** Ordered to-do list for the summary page. Only uses facts already computed by the workspace. */
export function inventoryActions(w: ActionInput): InventoryAction[] {
  const actions: InventoryAction[] = [];
  const centralTones = w.centralLevels.map(level => ({ level, ...levelTone(level, w.demandReady ? w.demand.get(level.product_id) ?? 0 : 0) }));
  if (w.demandReady) for (const item of centralTones.filter(i => i.tone === 'shortage')) {
    const available = item.level.current_quantity - (item.level.reserved_quantity ?? 0);
    actions.push({ id: `short-${item.level.id}`, tone: 'shortage', chip: 'Urgente', title: `Faltan ${quantity(item.missing)} ${item.level.product?.name ?? 'unidades'} para las mudas`,
      reason: `Disponible en ${w.central?.name ?? 'el almacén central'}: ${quantity(available)} · Para mudas por preparar: ${quantity(w.demand.get(item.level.product_id) ?? 0)}`,
      to: `/inventory/stock?product=${item.level.product_id}`, action: 'Ver en almacén' });
  }
  if (w.demandReady && w.missingProducts.length) actions.push({ id: 'missing', tone: 'check', chip: 'Comprobar', title: `${plural(w.missingProducts.length, 'producto necesario no tiene', 'productos necesarios no tienen')} saldo en el almacén central`,
    reason: `${w.missingProducts.slice(0, 3).map(p => p.name).join(', ')}. Las mudas los piden, pero no hay existencias registradas.`, to: '/inventory/stock', action: 'Revisar almacén' });
  if (w.demandReady) {
    const counts = bagCounts(w.bags);
    if (counts.issue) actions.push({ id: 'issues', tone: 'shortage', chip: 'Urgente', title: `${plural(counts.issue, 'muda tiene', 'mudas tienen')} incidencia o contenido por revisar`, reason: 'Las necesidades calculadas pueden estar incompletas hasta revisarlas.', to: '/inventory/preparation?estado=issue', action: 'Revisar mudas' });
    if (counts.pending) actions.push({ id: 'pending', tone: 'info', chip: 'Pendiente', title: `${plural(counts.pending, 'muda por preparar', 'mudas por preparar')}`, reason: `Limpiezas activas hasta el ${w.to.split('-').reverse().join('/')}${counts.issue ? `, incluidas ${counts.issue} por revisar` : ''}.`, to: '/inventory/preparation?estado=pending', action: 'Ver mudas' });
    if (counts.prepared) actions.push({ id: 'prepared', tone: 'info', chip: 'Pendiente', title: `${plural(counts.prepared, 'muda preparada', 'mudas preparadas')} sin entrega confirmada`, reason: 'Preparar no confirma la entrega en el edificio.', to: '/inventory/preparation?estado=prepared', action: 'Ver preparadas' });
  }
  const replenish = centralTones.filter(i => i.tone === 'replenish').map(i => i.level);
  if (replenish.length) actions.push({ id: 'replenish', tone: 'replenish', chip: 'Reponer', title: `Reponer la reserva de ${plural(replenish.length, 'producto', 'productos')} del almacén central`, reason: names(replenish), to: '/inventory/stock?status=attention', action: 'Ver necesidades' });
  const buildings = w.buildings.filter(b => b.replenishments.length);
  if (buildings.length) actions.push({ id: 'buildings', tone: 'replenish', chip: 'Reponer', title: `${plural(buildings.length, 'edificio necesita', 'edificios necesitan')} reponer repuestos`, reason: buildings.slice(0, 3).map(b => locationName(b.warehouse.name)).join(', ') + (buildings.length > 3 ? ` y ${buildings.length - 3} más` : ''), to: '/inventory/warehouses', action: 'Ver edificios' });
  const check = centralTones.filter(i => i.tone === 'check' || i.tone === 'partial').map(i => i.level);
  if (check.length) actions.push({ id: 'check', tone: 'check', chip: 'Comprobar', title: `${plural(check.length, 'saldo necesita', 'saldos necesitan')} comprobación`, reason: `${names(check)}. Saldo negativo o pendiente de recuento: cuéntalo antes de repartir.`, to: '/inventory/stock?status=check', action: 'Comprobar saldos' });
  const undefinedReserve = centralTones.filter(i => i.tone === 'undefined').length;
  if (undefinedReserve) actions.push({ id: 'undefined', tone: 'info', chip: 'Configurar', title: `${plural(undefinedReserve, 'producto sin reserva definida', 'productos sin reserva definida')}`, reason: 'No es una falta: sin reserva no se puede avisar de cuándo reponer.', to: '/inventory/stock?status=unknown', action: 'Definir reservas' });
  return actions;
}
