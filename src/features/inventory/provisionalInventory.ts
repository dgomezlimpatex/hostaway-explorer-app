import { formatMadridDate } from '@/utils/date';
import type { StockLevel, StockProduct } from '@/types/stock';

export type InventoryReadRow = Record<string, unknown>;
export interface ProvisionalReads {
  movements: InventoryReadRow[];
  preparations: InventoryReadRow[];
  mappings: InventoryReadRow[];
  estimates: InventoryReadRow[];
  levels?: InventoryReadRow[];
}
const textileFields: Record<string, string> = {
  numero_sabanas: 'sheets', numero_sabanas_pequenas: 'sheetsSmall',
  numero_sabanas_suite: 'sheetsSuite', numero_fundas_almohada: 'pillowCases',
  numero_toallas_grandes: 'towelsLarge', numero_toallas_pequenas: 'towelsSmall',
  numero_alfombrines: 'bathMats',
};
const object = (value: unknown): InventoryReadRow => value && typeof value === 'object' && !Array.isArray(value) ? value as InventoryReadRow : {};
const numeric = (value: unknown): number => {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) throw new Error('Hay cantidades incompletas en el historial.');
  return Number(value);
};
const instant = (value: unknown): number => {
  const time = Date.parse(String(value));
  if (!Number.isFinite(time)) throw new Error('Hay fechas incompletas en el historial.');
  return time;
};
export function validProvisionalDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}
export function receiptDate(movement: InventoryReadRow): string | null {
  const match = /^Recepción (\d{4}-\d{2}-\d{2}) v\d+\b/.exec(String(movement.reason ?? ''));
  return match && validProvisionalDate(match[1]) ? match[1] : null;
}
export function suggestedProvisionalDate(movements: InventoryReadRow[], fallback: string) {
  return movements.map(receiptDate).filter((day): day is string => !!day && day >= fallback).sort()[0] ?? fallback;
}

/** A comparison of recorded receipts and first known packings, never a physical stock level. */
export function buildProvisionalInventory(data: ProvisionalReads, products: StockProduct[], levels: StockLevel[], warehouseId: string, from: string) {
  if (!validProvisionalDate(from)) throw new Error('Elige una fecha de inicio válida.');
  const movements = data.movements.filter(m => m.warehouse_id === warehouseId);
  const inbound = new Map<string, number>();
  const receiptDays = new Set<string>();
  for (const movement of movements) {
    const day = receiptDate(movement);
    if (!day || day < from) continue;
    // Confirmed corrections are already movements of the difference, including negative corrections.
    const delta = numeric(movement.new_quantity) - numeric(movement.previous_quantity);
    const id = String(movement.product_id);
    inbound.set(id, (inbound.get(id) ?? 0) + delta);
    receiptDays.add(day);
  }
  const byTask = new Map<string, InventoryReadRow[]>();
  const eventIds = new Set<string>();
  for (const event of data.preparations) {
    if (event.action !== 'prepared' || eventIds.has(String(event.id))) continue;
    eventIds.add(String(event.id));
    const id = String(event.task_key ?? '');
    if (!id) throw new Error('Una preparación no tiene tarea identificada.');
    const group = byTask.get(id) ?? [];
    group.push(event); byTask.set(id, group);
  }
  const fresh: InventoryReadRow[] = [];
  let priorBags = 0, repeatedEvents = 0;
  for (const group of byTask.values()) {
    group.sort((a, b) => instant(a.happened_at) - instant(b.happened_at) || String(a.id).localeCompare(String(b.id)));
    const inPeriod = group.filter(e => formatMadridDate(new Date(instant(e.happened_at))) >= from);
    if (!inPeriod.length) continue;
    if (formatMadridDate(new Date(instant(group[0].happened_at))) < from) {
      const earlier = group.filter(e => formatMadridDate(new Date(instant(e.happened_at))) < from);
      const before = earlier[earlier.length - 1];
      const previous = object(object(before?.bag_items).textiles);
      const latest = object(object(group[group.length - 1].bag_items).textiles);
      if (Object.values(textileFields).some(key => previous[key] !== latest[key])) throw new Error('Cambió la ropa de una bolsa preparada antes del inicio. Revisa esa preparación antes de usar la diferencia.');
      priorBags++;
      continue;
    }
    fresh.push(group[group.length - 1]);
    repeatedEvents += inPeriod.length - 1;
  }
  const mappings = data.mappings.filter(m => m.is_active === true && (!m.warehouse_id || m.warehouse_id === warehouseId));
  const linen = products.filter(p => p.is_active && p.category?.kind === 'laundry').map(product => {
    const matching = mappings.filter(m => m.product_id === product.id && textileFields[String(m.property_field)]);
    const mapping = matching.length === 1 ? matching[0] : null;
    let packed: number | null = mapping ? 0 : null;
    for (const bag of fresh) {
      const snapshot = object(bag.bag_items);
      const textiles = object(snapshot.textiles);
      if (!mapping || !Object.prototype.hasOwnProperty.call(textiles, textileFields[String(mapping.property_field)])) { packed = null; break; }
      const multiplier = numeric(mapping.multiplier);
      if (multiplier <= 0) throw new Error('La correspondencia de ropa necesita revisión.');
      packed = (packed ?? 0) + numeric(textiles[textileFields[String(mapping.property_field)]]) * multiplier;
    }
    const received = inbound.get(product.id) ?? 0;
    return { productId: product.id, name: product.name, received, packed, difference: packed === null ? null : received - packed };
  });
  const supplies = products.filter(p => p.is_active && p.category?.kind === 'amenity').map(product => {
    const manual = movements.filter(m => m.product_id === product.id && ['entrada', 'ajuste'].includes(String(m.movement_type)) && !receiptDate(m))
      .sort((a, b) => instant(b.created_at) - instant(a.created_at) || String(b.id).localeCompare(String(a.id)))[0];
    const historical = data.estimates.filter(e => e.product_id === product.id && e.warehouse_id === warehouseId && e.state === 'applied'
      && formatMadridDate(new Date(instant(e.scheduled_end_at))) < from).reduce((sum, e) => sum + numeric(e.quantity), 0);
    const level = levels.find(l => l.product_id === product.id && l.warehouse_id === warehouseId);
    return { productId: product.id, name: product.name, entered: manual ? numeric(manual.new_quantity) : null,
      enteredAt: manual ? String(manual.created_at) : null, registered: level ? numeric(level.current_quantity) : null, historical };
  });
  return { linen, supplies, freshBags: fresh.length, priorBags, repeatedEvents, receiptDays: [...receiptDays].sort() };
}
