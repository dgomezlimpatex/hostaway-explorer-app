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
export interface SourceProperty {
  id: string; nombre: string; cliente_id: string; coste_servicio: number | null; duracion_servicio: number | null;
  numero_sabanas?: number; numero_sabanas_pequenas?: number; numero_sabanas_suite?: number;
  numero_fundas_almohada?: number; numero_toallas_grandes?: number; numero_toallas_pequenas?: number;
  numero_alfombrines?: number; amenities_cocina?: number; amenities_bano?: number; kit_alimentario?: number;
  cantidad_rollos_papel_higienico?: number;
}
export interface DirectoryEntry { id: string; name: string }
const quantityFields = {
  doubleSheet: 'numero_sabanas', singleSheet: 'numero_sabanas_pequenas', suiteSheet: 'numero_sabanas_suite',
  pillowcase: 'numero_fundas_almohada', bathTowel: 'numero_toallas_grandes', handTowel: 'numero_toallas_pequenas',
  bathMat: 'numero_alfombrines', kitchenKit: 'amenities_cocina', bathKit: 'amenities_bano',
  foodKit: 'kit_alimentario', toiletPaper: 'cantidad_rollos_papel_higienico',
} as const;
export function buildServices(tasks: SourceTask[], properties: SourceProperty[], clients: DirectoryEntry[],
  workers: DirectoryEntry[] = [], today = formatMadridDate(new Date())): FinancialService[] {
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
    const quantities: Quantities = {};
    if (property) for (const [item, field] of Object.entries(quantityFields)) {
      const value = property[field];
      if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) quantities[item] = value;
    }
    const windowMinutes = getWindowDurationMinutes(task.start_time, task.end_time);
    const propertyMinutes = property?.duracion_servicio;
    const positiveDuration = (value: number | null | undefined) => typeof value === 'number' && Number.isFinite(value) && value > 0;
    // The property holds total work; planner-saved task duration may already be per person.
    const totalMinutes = positiveDuration(propertyMinutes) ? propertyMinutes! : positiveDuration(task.duracion) ? task.duracion!
      : windowMinutes > 0 ? windowMinutes : null;
    // Duration is the team's total work, never a separate full duration for each person.
    const plannedMinutes = totalMinutes !== null && assignmentMap.size ? totalMinutes / assignmentMap.size : null;
    const workers = [...assignmentMap].map(([id, name]) => ({ id, name, minutes: plannedMinutes, actual: false }));
    const hasRevenue = typeof task.coste === 'number' && Number.isFinite(task.coste) && task.coste >= 0;
    const propertyRevenue = property?.coste_servicio;
    const positivePropertyRevenue = typeof propertyRevenue === 'number' && Number.isFinite(propertyRevenue) && propertyRevenue > 0;
    const usePropertyRevenue = !hasRevenue || (task.coste === 0 && positivePropertyRevenue);
    const revenueValue = usePropertyRevenue ? propertyRevenue : task.coste;
    return [{ id: task.id, type: task.type || '', date: task.date, clientId, clientName: clientMap.get(clientId) || 'Sin cliente identificado',
      propertyId: task.propiedad_id || '', propertyName: property?.nombre || task.property, workers, quantities,
      revenue: typeof revenueValue === 'number' && Number.isFinite(revenueValue) && revenueValue >= 0 ? Math.round(revenueValue * 100) : null,
      revenueEstimated: usePropertyRevenue }];
  });
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
