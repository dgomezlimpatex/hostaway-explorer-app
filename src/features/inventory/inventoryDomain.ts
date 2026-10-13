import type { StockLevel, StockProduct, StockWarehouse } from '@/types/stock';

export type MaterialFamily = 'linen' | 'supplies' | 'spares';
export const normalizeMaterial = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

/** Classification for the operational view; never rewrites the product or its consumption rules. */
export function materialFamily(product: Pick<StockProduct, 'name' | 'category' | 'is_consumable'>): MaterialFamily {
  const name = normalizeMaterial(product.name);
  if (/edredon|protector.*colchon|^almohadas?$/.test(name)) return 'spares';
  if (product.category?.kind === 'laundry') return 'linen';
  return product.is_consumable ? 'supplies' : 'spares';
}

export function centralWarehouse(warehouses: StockWarehouse[]): StockWarehouse | null {
  const active = warehouses.filter(w => w.is_active && w.location_type !== 'building_storage');
  const simon = active.filter(w => normalizeMaterial(w.name) === 'simon bolivar');
  if (simon.length === 1) return simon[0];
  const defaults = active.filter(w => w.is_default);
  if (defaults.length === 1) return defaults[0];
  const central = active.filter(w => w.location_type === 'central');
  return central.length === 1 ? central[0] : null;
}

export type InventoryState = 'shortage' | 'replenish' | 'unknown' | 'covered';
export function levelState(level: StockLevel, needed = 0): { state: InventoryState; label: string; missing: number } {
  const current = Number(level.current_quantity);
  if (!Number.isFinite(current) || !Number.isFinite(needed) || needed < 0) return { state: 'unknown', label: 'Pendiente de comprobar', missing: 0 };
  if (current < 0) return { state: 'unknown', label: 'Revisar saldo negativo', missing: 0 };
  if (needed > current) return { state: 'shortage', label: `Faltan ${quantity(needed - current)}`, missing: needed - current };
  const minimum = Math.max(0, level.minimum_quantity);
  const target = Math.max(minimum, level.target_quantity);
  if (target > current - needed) return { state: 'replenish', label: 'Reponer reserva', missing: target - (current - needed) };
  if (!target && !needed) return { state: 'unknown', label: 'Sin reserva definida', missing: 0 };
  return { state: 'covered', label: needed ? 'Alcanza según saldo' : 'Reserva cubierta', missing: 0 };
}

export const quantity = (value: number) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(value);
export const dayLabel = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.split('-').reverse().join('/') : date;
export const updatedLabel = (date: string | null | undefined) => date && Number.isFinite(Date.parse(date))
  ? new Date(date).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'short', timeStyle: 'short' }) : 'Sin fecha registrada';
export function addInventoryDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export interface InventoryBag {
  taskId: string;
  propertyId: string;
  propertyCode: string;
  date: string;
  warehouseId: string | null;
  state: 'pending' | 'prepared' | 'delivered' | 'issue' | 'review';
  issue: string | null;
  lines: Array<{ productId: string; name: string; quantity: number }>;
}

export function pendingDemand(bags: InventoryBag[]): Map<string, number> {
  const totals = new Map<string, number>();
  const seen = new Set<string>();
  for (const bag of bags) {
    if (seen.has(bag.taskId)) continue;
    seen.add(bag.taskId);
    if (bag.state === 'prepared' || bag.state === 'delivered') continue;
    for (const line of bag.lines) totals.set(line.productId, (totals.get(line.productId) ?? 0) + line.quantity);
  }
  return totals;
}

export function buildingInventory(warehouses: StockWarehouse[], levels: StockLevel[], bags: InventoryBag[], centralId?: string) {
  return warehouses.filter(w => w.is_active && w.id !== centralId && w.location_type !== 'central').map(warehouse => {
    const stored = levels.filter(l => l.warehouse_id === warehouse.id);
    const spares = stored.filter(l => l.product && materialFamily(l.product) === 'spares');
    const buildingBags = bags.filter(b => b.warehouseId === warehouse.id);
    const replenishments = spares.filter(l => ['shortage', 'replenish'].includes(levelState(l).state));
    const pending = buildingBags.filter(b => !['prepared', 'delivered'].includes(b.state)).length;
    return { warehouse, spares, stored, bags: buildingBags, replenishments, pending,
      needsAttention: replenishments.length > 0 || pending > 0,
      unconfigured: spares.filter(l => levelState(l).state === 'unknown').length };
  }).sort((a, b) => Number(b.needsAttention) - Number(a.needsAttention) || a.warehouse.name.localeCompare(b.warehouse.name, 'es'));
}
