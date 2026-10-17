import { madridRangeBounds } from '@/utils/stockDateRange';
import { shiftCivilDate } from '@/utils/madridCalendar';
import {
  ACTIVITY_SOURCE_LIMIT, LAUNDRY_SERVICE_MARGIN_DAYS,
  cleaningEvents, incidentEvents, inventoryEvents, laundryEvents, mergeDuplicateLaundry, supervisionEvents, withinWindow,
  type ActivityEvent, type ActivitySourceId, type ActivityWindow,
  type BagPreparationRow, type CleaningRow, type DeliveryTrackingRow, type IncidentEventRow, type IncidentRow, type StockMovementRow, type SupervisionRow,
} from './propertyActivityModel';

/**
 * Consultas de solo lectura por propiedad y tramo. Cada consulta filtra por identificador de
 * propiedad (nunca por nombre) y por la sede activa; RLS sigue aplicándose en el servidor.
 * Varias tablas no están en los tipos generados, por eso el cliente se recibe sin tipar.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ActivityDb = { from: (table: string) => any };

export interface ActivityAccess { tasks: boolean; reports: boolean; supervision: boolean; inventory: boolean }

/** Módulo que debe poder consultar el usuario para ver cada fuente (mismos permisos que sus pantallas). */
export function sourceAllowed(source: ActivitySourceId, access: ActivityAccess): boolean {
  if (source === 'cleanings') return access.tasks;
  if (source === 'supervision') return access.supervision;
  if (source === 'inventory') return access.inventory;
  return access.reports; // incidencias y lavandería viven en pantallas del módulo de reportes
}

export interface ActivityQuery {
  propertyId: string;
  sedeId: string;
  window: Pick<ActivityWindow, 'from' | 'to'>;
  access: ActivityAccess;
  signal?: AbortSignal;
}

export interface ActivitySourceResult { events: ActivityEvent[]; truncated: boolean }

const INCIDENT_STEP_TYPES = ['approved', 'discarded_limpatex', 'status_change', 'client_in_progress', 'client_resolved', 'client_discarded', 'deleted'];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function rows<T>(query: any, signal?: AbortSignal): Promise<{ data: T[]; truncated: boolean }> {
  const { data, error } = await (signal ? query.abortSignal(signal) : query);
  if (error) throw error;
  const list = (data || []) as T[];
  return { data: list.slice(0, ACTIVITY_SOURCE_LIMIT), truncated: list.length > ACTIVITY_SOURCE_LIMIT };
}

const LIMIT = ACTIVITY_SOURCE_LIMIT + 1;

export async function fetchActivitySource(db: ActivityDb, source: ActivitySourceId, { propertyId, sedeId, window, access, signal }: ActivityQuery): Promise<ActivitySourceResult> {
  if (!sourceAllowed(source, access)) throw new Error('Sin permiso para esta fuente');
  const { start, endExclusive } = madridRangeBounds(window.from, window.to);

  if (source === 'cleanings') {
    const select = `id, propiedad_id, date, start_time, end_time, status, type, cleaner, task_assignments(cleaner_name)${access.reports ? ', task_reports(id, start_time, end_time, overall_status, cleaner:cleaners(name))' : ''}`;
    const result = await rows<CleaningRow>(db.from('tasks').select(select)
      .eq('propiedad_id', propertyId).eq('sede_id', sedeId)
      .gte('date', window.from).lte('date', window.to)
      .order('date', { ascending: false }).order('start_time', { ascending: false }).order('id', { ascending: true })
      .limit(LIMIT), signal);
    const data = access.reports ? result.data : result.data.map(row => ({ ...row, task_reports: undefined }));
    return { events: withinWindow(cleaningEvents(data, propertyId), window), truncated: result.truncated };
  }

  if (source === 'incidents') {
    const [incidents, steps] = await Promise.all([
      rows<IncidentRow>(db.from('cleaning_incidents')
        .select('id, property_id, task_id, created_at, status, description, category:incident_categories(label), cleaner:cleaners!cleaning_incidents_reporter_cleaner_id_fkey(name)')
        .eq('property_id', propertyId).eq('sede_id', sedeId)
        .gte('created_at', start).lt('created_at', endExclusive)
        .order('created_at', { ascending: false }).order('id', { ascending: true })
        .limit(LIMIT), signal),
      rows<IncidentEventRow>(db.from('cleaning_incident_events')
        .select('id, incident_id, event_type, from_status, to_status, actor_name, created_at, incident:cleaning_incidents!inner(property_id, sede_id, description, category:incident_categories(label))')
        .eq('incident.property_id', propertyId).eq('incident.sede_id', sedeId)
        .in('event_type', INCIDENT_STEP_TYPES)
        .gte('created_at', start).lt('created_at', endExclusive)
        .order('created_at', { ascending: false }).order('id', { ascending: true })
        .limit(LIMIT), signal),
    ]);
    return { events: withinWindow(incidentEvents(incidents.data, steps.data, propertyId), window), truncated: incidents.truncated || steps.truncated };
  }

  if (source === 'supervision') {
    const range = (column: string) => `${column}.gte."${start}",${column}.lt."${endExclusive}"`;
    const result = await rows<SupervisionRow>(db.from('supervision_reviews')
      .select('id, property_id, task_id, review_type, state, result, rework_reason, started_at, completed_at, created_at, route:supervision_routes!inner(route_date, sede_id)')
      .eq('property_id', propertyId).eq('route.sede_id', sedeId)
      .or(`and(${range('completed_at')}),and(completed_at.is.null,${range('created_at')})`)
      .order('created_at', { ascending: false }).order('id', { ascending: true })
      .limit(LIMIT), signal);
    return { events: withinWindow(supervisionEvents(result.data, propertyId), window), truncated: result.truncated };
  }

  if (source === 'laundry') {
    // Los pasos de lavandería se buscan por las limpiezas de la propiedad cercanas al tramo y se recortan por su propio momento.
    const serviceFrom = shiftCivilDate(window.from, -LAUNDRY_SERVICE_MARGIN_DAYS);
    const serviceTo = shiftCivilDate(window.to, LAUNDRY_SERVICE_MARGIN_DAYS);
    const task = 'task:tasks!inner(id, date, propiedad_id, sede_id)';
    const [bags, tracking] = await Promise.all([
      rows<BagPreparationRow>(db.from('laundry_bag_preparations')
        .select(`task_id, status, prepared_at, prepared_by_name, issue_at, issue_by_name, issue_reason, undone_at, undone_by_name, undone_reason, cancelled_at, cancelled_by_name, ${task}`)
        .eq('task.propiedad_id', propertyId).eq('task.sede_id', sedeId)
        .gte('task.date', serviceFrom).lte('task.date', serviceTo)
        .order('task_id', { ascending: true })
        .limit(LIMIT), signal),
      rows<DeliveryTrackingRow>(db.from('laundry_delivery_tracking')
        .select(`id, task_id, prepared_at, prepared_by_name, delivered_at, delivered_by_name, collected_at, collected_by_name, ${task}`)
        .eq('task.propiedad_id', propertyId).eq('task.sede_id', sedeId)
        .gte('task.date', serviceFrom).lte('task.date', serviceTo)
        .order('id', { ascending: true })
        .limit(LIMIT), signal),
    ]);
    return { events: withinWindow(mergeDuplicateLaundry(laundryEvents(bags.data, tracking.data, propertyId)), window), truncated: bags.truncated || tracking.truncated };
  }

  const result = await rows<StockMovementRow>(db.from('stock_movements')
    .select('id, property_id, task_id, movement_type, quantity, reason, created_at, product_id, warehouse_id, product:stock_products!inner(name, unit_of_measure, sede_id), warehouse:stock_warehouses!stock_movements_warehouse_id_fkey(name)')
    .eq('property_id', propertyId).eq('product.sede_id', sedeId)
    .gte('created_at', start).lt('created_at', endExclusive)
    .order('created_at', { ascending: false }).order('id', { ascending: true })
    .limit(LIMIT), signal);
  return { events: withinWindow(inventoryEvents(result.data, propertyId), window), truncated: result.truncated };
}
