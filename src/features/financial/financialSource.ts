import type { FinancialService, Quantities } from './financialModel';
import { getCalendarTaskStatus, type CalendarProgressReport } from '@/utils/calendarTaskStatus';
import { getWindowDurationMinutes } from '@/utils/cleaning-planning/capacity';

export interface SourceTask {
  type: string;
  id: string; date: string; status: string; coste: number | null; cliente_id: string | null; propiedad_id: string | null;
  property: string; cleaner_id: string | null; cleaner: string | null; start_time: string; end_time: string;
  task_assignments: { cleaner_id: string; cleaner_name: string }[];
  task_reports: (CalendarProgressReport & { updated_at?: string })[];
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
export function buildServices(tasks: SourceTask[], properties: SourceProperty[], clients: DirectoryEntry[]): FinancialService[] {
  const propertyMap = new Map(properties.map(property => [property.id, property]));
  const clientMap = new Map(clients.map(client => [client.id, client.name]));
  return tasks.flatMap(task => {
    const assignmentMap = new Map((task.task_assignments || []).map(assignment => [assignment.cleaner_id, assignment.cleaner_name]));
    if (!assignmentMap.size && task.cleaner_id) assignmentMap.set(task.cleaner_id, task.cleaner || 'Trabajador');
    const workerIds = [...assignmentMap.keys()];
    const reports = task.task_reports || [];
    if (getCalendarTaskStatus(task.status, reports, workerIds) !== 'completed') return [];
    const property = propertyMap.get(task.propiedad_id || '');
    const clientId = task.cliente_id || property?.cliente_id || '';
    const quantities: Quantities = {};
    if (property) for (const [item, field] of Object.entries(quantityFields)) {
      const value = property[field];
      if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) quantities[item] = value;
    }
    const windowMinutes = getWindowDurationMinutes(task.start_time, task.end_time);
    const propertyMinutes = property?.duracion_servicio;
    const plannedMinutes = windowMinutes > 0 ? windowMinutes : typeof propertyMinutes === 'number' && propertyMinutes > 0 && workerIds.length
      ? Math.ceil(propertyMinutes / workerIds.length / 15) * 15 : null;
    const workers = [...assignmentMap].map(([id, name]) => {
      const report = [...reports].filter(report => report.cleaner_id === id).sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))[0];
      const start = Date.parse(report?.start_time || '');
      const end = Date.parse(report?.end_time || '');
      const actual = Number.isFinite(start) && Number.isFinite(end) && end >= start && end - start <= 86400000;
      return { id, name, minutes: actual ? Math.round((end - start) / 60000) : plannedMinutes, actual };
    });
    const hasRevenue = typeof task.coste === 'number' && Number.isFinite(task.coste) && task.coste >= 0;
    const revenueValue = hasRevenue ? task.coste : property?.coste_servicio;
    return [{ id: task.id, type: task.type || '', date: task.date, clientId, clientName: clientMap.get(clientId) || 'Sin cliente identificado',
      propertyId: task.propiedad_id || '', propertyName: property?.nombre || task.property, workers, quantities,
      revenue: typeof revenueValue === 'number' && Number.isFinite(revenueValue) && revenueValue >= 0 ? Math.round(revenueValue * 100) : null,
      revenueEstimated: !hasRevenue }];
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
