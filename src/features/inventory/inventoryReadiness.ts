import { supabase } from '@/integrations/supabase/client';
import { getLegacyFieldForStockProduct } from '@/components/properties/forms/propertyStockConsumption';
import { isNotCountCleaner } from '@/utils/laundryExclusions';
import { isTrashSack } from '@/utils/trashSacks';
import { materialFamily, type InventoryBag } from './inventoryDomain';
import type { StockProduct, StockWarehouse } from '@/types/stock';

type Row = Record<string, unknown>;
type Result = { data: Row[] | null; error: { message: string } | null };
// Deliberately read-only interface: no RPC, write method, tokens or service credentials.
export interface ReadQuery extends PromiseLike<Result> {
  select(columns: string): ReadQuery;
  eq(column: string, value: string | boolean): ReadQuery;
  gte(column: string, value: string): ReadQuery;
  lte(column: string, value: string): ReadQuery;
  in(column: string, values: string[]): ReadQuery;
  order(column: string, options?: { ascending: boolean }): ReadQuery;
  range(from: number, to: number): ReadQuery;
}
const db = supabase as unknown as { from(table: string): ReadQuery };
export async function readAll(makeQuery: () => ReadQuery): Promise<Row[]> {
  const rows: Row[] = [];
  for (let start = 0; start < 20000; start += 500) {
    const { data, error } = await makeQuery().range(start, start + 499);
    if (error) throw new Error(error.message);
    if (!data) throw new Error('La consulta no devolvió datos.');
    rows.push(...data);
    if (data.length < 500) return rows;
  }
  throw new Error('Hay demasiados resultados. Reduce el período de consulta.');
}

const row = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const amount = (value: unknown) => Math.max(0, Number(value) || 0);
const fields: Record<string, string> = {
  numeroSabanas: 'numero_sabanas', numeroSabanasRequenas: 'numero_sabanas_pequenas', numeroSabanasSuite: 'numero_sabanas_suite',
  numeroFundasAlmohada: 'numero_fundas_almohada', numeroToallasGrandes: 'numero_toallas_grandes', numeroTotallasPequenas: 'numero_toallas_pequenas',
  numeroAlfombrines: 'numero_alfombrines', kitAlimentario: 'kit_alimentario', amenitiesBano: 'amenities_bano', amenitiesCocina: 'amenities_cocina',
  cantidadRollosPapelHigienico: 'papel_higienico', cantidadRollosPapelCocina: 'papel_cocina', bayetasCocina: 'bayetas_cocina', bolsasBasura: 'bolsas_basura',
};
const snapshotKeys: Record<string, [string, string]> = {
  numeroSabanas: ['textiles', 'sheets'], numeroSabanasRequenas: ['textiles', 'sheetsSmall'], numeroSabanasSuite: ['textiles', 'sheetsSuite'],
  numeroFundasAlmohada: ['textiles', 'pillowCases'], numeroToallasGrandes: ['textiles', 'towelsLarge'], numeroTotallasPequenas: ['textiles', 'towelsSmall'],
  numeroAlfombrines: ['textiles', 'bathMats'], kitAlimentario: ['amenities', 'foodKit'], amenitiesBano: ['amenities', 'bathroomAmenities'],
  amenitiesCocina: ['amenities', 'kitchenAmenities'], cantidadRollosPapelHigienico: ['amenities', 'toiletPaper'],
  cantidadRollosPapelCocina: ['amenities', 'kitchenPaper'], bayetasCocina: ['amenities', 'kitchenCloths'], bolsasBasura: ['amenities', 'trashBags'],
};

export function buildBags(tasks: Row[], preparations: Row[], deliveries: Row[], assignments: Row[], products: StockProduct[], warehouses: StockWarehouse[], includeCompleted = false): InventoryBag[] {
  const prepByTask = new Map(preparations.map(p => [String(p.task_id), p]));
  const delivered = new Map<string, number>();
  for (const delivery of deliveries) {
    const date = Date.parse(String(delivery.delivered_at ?? ''));
    if (delivery.status === 'delivered' && Number.isFinite(date)) delivered.set(String(delivery.task_id), Math.max(delivered.get(String(delivery.task_id)) ?? 0, date));
  }
  const result: InventoryBag[] = [];
  const seen = new Set<string>();
  for (const task of tasks) {
    const id = String(task.id);
    if (seen.has(id) || ['cancelled', 'canceled'].includes(String(task.status)) || (!includeCompleted && task.status === 'completed') || isNotCountCleaner(String(task.cleaner ?? ''))) continue;
    seen.add(id);
    const property = row(task.properties);
    const client = row(property.clients);
    if ((property.is_active ?? client.is_active ?? true) !== true || (property.linen_control_enabled ?? client.linen_control_enabled ?? false) !== true) continue;
    const propertyId = String(property.id ?? task.propiedad_id ?? '');
    if (!propertyId) continue;
    const rules = (Array.isArray(property.stock_property_consumption_rules) ? property.stock_property_consumption_rules : []).map(row).filter(r => r.is_active === true);
    const relevantProducts = products.filter(p => p.is_active && materialFamily(p) !== 'spares');
    const unmappedContent = Object.entries(fields).some(([field, column]) => amount(property[column]) > 0
      && !relevantProducts.some(product => getLegacyFieldForStockProduct(product) === field))
      || rules.some(rule => amount(rule.quantity_per_cleaning) > 0 && !relevantProducts.some(product => product.id === rule.product_id));
    const lines = relevantProducts.map(product => {
      const field = getLegacyFieldForStockProduct(product);
      const rule = rules.find(r => r.product_id === product.id);
      // Linen quantities follow the current preparation route. Custom consumables follow per-property rules.
      const value = product.category?.kind === 'laundry' && field ? property[fields[field]]
        : rule ? rule.quantity_per_cleaning : isTrashSack(product) ? 0 : field ? property[fields[field]] : 0;
      return { productId: product.id, name: product.name, quantity: amount(value) };
    }).filter(l => l.quantity > 0);
    const preparation = prepByTask.get(id);
    const snapshot = row(preparation?.content_snapshot);
    const changed = preparation?.status === 'prepared' && (!Object.keys(snapshot).length || String(snapshot.propertyId ?? '') !== propertyId || relevantProducts.some(product => {
      const current = lines.find(l => l.productId === product.id)?.quantity ?? 0;
      const field = getLegacyFieldForStockProduct(product);
      const key = isTrashSack(product) ? ['amenities', 'trashSacks100L'] : field ? snapshotKeys[field] : null;
      const custom = (Array.isArray(snapshot.stockConsumables) ? snapshot.stockConsumables : []).map(row).find(r => r.productId === product.id);
      const previous = custom ? amount(custom.quantity) : key ? amount(row(snapshot[key[0]])[key[1]]) : 0;
      return current !== previous;
    }));
    const groupIds = new Set(assignments.filter(a => a.property_id === propertyId).map(a => String(a.property_group_id)));
    const destinations = warehouses.filter(w => w.is_active && w.location_type === 'building_storage' && w.property_group_id && groupIds.has(w.property_group_id));
    const resetAt = Math.max(...['prepared_at', 'undone_at', 'cancelled_at'].map(key => Date.parse(String(preparation?.[key] ?? '')) || 0));
    const deliveryConfirmed = !changed && !unmappedContent && delivered.has(id) && delivered.get(id)! >= resetAt;
    result.push({ taskId: id, propertyId, propertyCode: String(property.codigo ?? task.property ?? 'Propiedad'), date: String(task.date),
      warehouseId: destinations.length === 1 ? destinations[0].id : null,
      state: preparation?.status === 'issue' ? 'issue' : unmappedContent || changed || !lines.length ? 'review' : deliveryConfirmed ? 'delivered' : preparation?.status === 'prepared' ? 'prepared' : 'pending',
      issue: preparation?.status === 'issue' ? String(preparation.issue_reason ?? 'Revisar incidencia') : unmappedContent ? 'Contenido sin correspondencia en el catálogo: necesidades incompletas' : changed ? 'El contenido necesita revisión' : !lines.length ? 'Sin contenido configurado' : null, lines });
  }
  return result.sort((a, b) => a.date.localeCompare(b.date) || a.propertyCode.localeCompare(b.propertyCode, 'es'));
}

export async function readInventoryBags(sedeId: string, from: string, to: string, products: StockProduct[], warehouses: StockWarehouse[], includeCompleted = false) {
  const tasks = await readAll(() => db.from('tasks').select(`id,property,date,status,cleaner,propiedad_id,
    properties:propiedad_id(id,codigo,sede_id,is_active,linen_control_enabled,numero_sabanas,numero_sabanas_pequenas,numero_sabanas_suite,
      numero_fundas_almohada,numero_toallas_grandes,numero_toallas_pequenas,numero_alfombrines,kit_alimentario,amenities_bano,amenities_cocina,
      papel_higienico,papel_cocina,bayetas_cocina,bolsas_basura,clients:cliente_id(is_active,linen_control_enabled),
      stock_property_consumption_rules(product_id,quantity_per_cleaning,is_active))`)
    .eq('sede_id', sedeId).eq('type', 'limpieza-turistica').gte('date', from).lte('date', to).order('id'));
  const preparations: Row[] = [], deliveries: Row[] = [], assignments: Row[] = [];
  for (let start = 0; start < tasks.length; start += 100) {
    const chunk = tasks.slice(start, start + 100);
    const taskIds = chunk.map(t => String(t.id));
    const propertyIds = [...new Set(chunk.map(t => t.propiedad_id).filter((id): id is string => typeof id === 'string' && !!id))];
    const [p, d, a] = await Promise.all([
      readAll(() => db.from('laundry_bag_preparations').select('task_id,status,issue_reason,content_snapshot,prepared_at,undone_at,cancelled_at').in('task_id', taskIds).order('task_id')),
      readAll(() => db.from('laundry_delivery_tracking').select('id,task_id,status,delivered_at').in('task_id', taskIds).order('id')),
      propertyIds.length ? readAll(() => db.from('property_group_assignments').select('id,property_id,property_group_id').in('property_id', propertyIds).order('id')) : Promise.resolve([]),
    ]);
    preparations.push(...p); deliveries.push(...d); assignments.push(...a);
  }
  return buildBags(tasks, preparations, deliveries, assignments, products, warehouses, includeCompleted);
}
