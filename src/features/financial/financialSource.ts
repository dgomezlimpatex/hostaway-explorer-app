import { isTrashSack, TRASH_SACK_START } from '@/utils/trashSacks';
import type { FinancialService, Quantities } from './financialModel';
import { formatMadridDate } from '@/utils/date';
import { getWindowDurationMinutes } from '@/utils/cleaning-planning/capacity';

export interface SourceTask {
  type: string;
  id: string; date: string; status: string; coste: number | null; cliente_id: string | null; propiedad_id: string | null;
  property: string; cleaner_id: string | null; cleaner: string | null; start_time: string; end_time: string;
  duracion?: number | null;
  task_assignments: { cleaner_id: string; cleaner_name: string }[];
}
export interface SourceBuilding { id: string; name: string; display_name?: string | null; is_active: boolean }
export interface SourceProperty {
  property_group_assignments?: { property_group_id: string; group: SourceBuilding | SourceBuilding[] | null }[];
  id: string; nombre: string; cliente_id: string; coste_servicio: number | null; duracion_servicio: number | null;
  numero_sabanas?: number; numero_sabanas_pequenas?: number; numero_sabanas_suite?: number;
  numero_fundas_almohada?: number; numero_toallas_grandes?: number; numero_toallas_pequenas?: number;
  numero_alfombrines?: number; amenities_cocina?: number; amenities_bano?: number; kit_alimentario?: number;
  cantidad_rollos_papel_higienico?: number;
  amenities_control_enabled?: boolean | null;
}
export interface ConsumptionRule { property_id: string; quantity_per_cleaning: number; product: { name: string } | null }
export interface DirectoryEntry { id: string; name: string; amenitiesControlEnabled?: boolean }
const quantityFields = {
  doubleSheet: 'numero_sabanas', singleSheet: 'numero_sabanas_pequenas', suiteSheet: 'numero_sabanas_suite',
  pillowcase: 'numero_fundas_almohada', bathTowel: 'numero_toallas_grandes', handTowel: 'numero_toallas_pequenas',
  bathMat: 'numero_alfombrines', kitchenKit: 'amenities_cocina', bathKit: 'amenities_bano',
  foodKit: 'kit_alimentario', toiletPaper: 'cantidad_rollos_papel_higienico',
} as const;
export function buildServices(tasks: SourceTask[], properties: SourceProperty[], clients: DirectoryEntry[],
  workers: DirectoryEntry[] = [], today = formatMadridDate(new Date()), rules: ConsumptionRule[] = []): FinancialService[] {
  const propertyMap = new Map(properties.map(property => [property.id, property]));
  const clientMap = new Map(clients.map(client => [client.id, client.name]));
  const isNotCount = (name: string) => name.trim().toUpperCase() === 'NOT COUNT';
  const excludedWorkerIds = new Set(workers.filter(worker => isNotCount(worker.name)).map(worker => worker.id));
  return tasks.flatMap(task => {
    if (task.status === 'cancelled' || task.status === 'canceled') return [];
    const assignmentMap = new Map((task.task_assignments || []).filter(assignment => !!assignment.cleaner_id)
      .map(assignment => [assignment.cleaner_id, assignment.cleaner_name]));
    if (!assignmentMap.size && task.cleaner_id) assignmentMap.set(task.cleaner_id, task.cleaner || 'Trabajador');
    if ([...assignmentMap].some(([id, name]) => excludedWorkerIds.has(id) || isNotCount(name))) return [];
    if (!assignmentMap.size && task.date < today) return [];
    const property = propertyMap.get(task.propiedad_id || '');
    const clientId = task.cliente_id || property?.cliente_id || '';
    const quantities: Quantities = { trashSack100L: 0 };
    const unpricedConsumptions: string[] = [];
    if (property) for (const [item, field] of Object.entries(quantityFields)) {
      const value = property[field];
      if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) quantities[item] = value;
    }
    // Active property rules replace the corresponding legacy field; do not add both.
    for (const rule of rules.filter(rule => rule.property_id === task.propiedad_id)) {
      // Bags are covered by the products percentage; workers supply their own cloths.
      if (coveredConsumption(rule.product?.name || '')) continue;
      if (isTrashSack(rule.product || {}) && (task.date < TRASH_SACK_START || !/^(limpieza|cleaning)/i.test(task.type))) continue;
      const item = consumptionItem(rule.product?.name || '');
      if (item && Number.isFinite(Number(rule.quantity_per_cleaning)) && Number(rule.quantity_per_cleaning) >= 0) quantities[item] = Number(rule.quantity_per_cleaning);
      if (!item && Number(rule.quantity_per_cleaning) > 0) unpricedConsumptions.push(rule.product?.name || 'Producto sin identificar');
    }
    const amenitiesEnabled = property?.amenities_control_enabled ?? clients.find(client => client.id === clientId)?.amenitiesControlEnabled;
    if (amenitiesEnabled === false) for (const item of ['kitchenKit', 'bathKit', 'foodKit']) quantities[item] = 0;
    const windowMinutes = getWindowDurationMinutes(task.start_time, task.end_time);
    const propertyMinutes = property?.duracion_servicio;
    const positiveDuration = (value: number | null | undefined) => typeof value === 'number' && Number.isFinite(value) && value > 0;
    // The property holds total work; planner-saved task duration may already be per person.
    const totalMinutes = positiveDuration(propertyMinutes) ? propertyMinutes! : positiveDuration(task.duracion) ? task.duracion!
      : windowMinutes > 0 ? windowMinutes : null;
    // Duration is the team's total work, never a separate full duration for each person.
    const plannedMinutes = totalMinutes !== null && assignmentMap.size ? totalMinutes / assignmentMap.size : null;
    const workers = [...assignmentMap].map(([id, name]) => ({ id, name, minutes: plannedMinutes, actual: false }));
    const propertyRevenue = property?.coste_servicio;
    const revenueValue = propertyRevenue;
    return [{ id: task.id, type: task.type || '', date: task.date, clientId, clientName: clientMap.get(clientId) || 'Sin cliente identificado',
      propertyId: task.propiedad_id || '', propertyName: property?.nombre || task.property, buildingIds: property?.property_group_assignments?.map(group => group.property_group_id) || [], workers, quantities, unpricedConsumptions,
      revenue: typeof revenueValue === 'number' && Number.isFinite(revenueValue) && revenueValue >= 0 ? Math.round(revenueValue * 100) : null,
      revenueEstimated: true }];
  });
}

export function coveredConsumption(name: string): boolean {
  const key = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  return ['bolsas basura', 'bolsas de basura 10l', 'bolsas de basura 30l', 'bayetas cocina'].includes(key);
}

export function consumptionItem(name: string): string | undefined {
  if (isTrashSack({ name })) return 'trashSack100L';
  const key = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  return ({ 'sabanas matrimonio':'doubleSheet', 'sabanas individuales':'singleSheet', 'sabanas suite':'suiteSheet',
    'fundas de almohada':'pillowcase', 'toallas grandes':'bathTowel', 'toallas pequenas':'handTowel', 'alfombrines ducha':'bathMat',
    'edredones':'duvet', 'almohadas':'pillow', 'protectores de colchon':'mattressCover', 'panos de cocina':'kitchenCloth',
    'amenities bano':'bathKit', 'amenities de bano':'bathKit', 'amenities cocina':'kitchenKit', 'amenities de cocina':'kitchenKit',
    'kit alimentario':'foodKit', 'amenities de alimentacion':'foodKit', 'papel higienico':'toiletPaper' } as Record<string,string>)[key];
}

export async function readAllPages<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < 100000; from += 500) {
    const result = await page(from, from + 499);
    if (result.error) throw new Error(result.error.message);
    if (!result.data) throw new Error('Respuesta incompleta al leer el análisis');
    rows.push(...result.data);
    if (result.data.length < 500) return rows;
  }
  throw new Error('El periodo contiene demasiados registros. Reduce el intervalo de fechas.');
}
