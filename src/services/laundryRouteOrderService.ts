import { supabase } from '@/integrations/supabase/client';

export const GLOBAL_ROUTE_DAY = -1;

export const CLASSIC_ROUTE_DAYS = [
  { value: GLOBAL_ROUTE_DAY, label: 'Todas las rutas', shortLabel: 'Todas' },
  { value: 1, label: 'Lunes', shortLabel: 'Lun' },
  { value: 3, label: 'Miércoles', shortLabel: 'Mié' },
  { value: 5, label: 'Viernes', shortLabel: 'Vie' },
  { value: 0, label: 'Domingo', shortLabel: 'Dom' },
] as const;

export type ClassicRouteDay = (typeof CLASSIC_ROUTE_DAYS)[number]['value'];

export interface LaundryRouteOrderItem {
  id: string;
  sedeId: string;
  deliveryDay: number;
  propertyId: string;
  position: number;
}

export interface LaundryRouteOrderProperty {
  propertyId: string;
  position: number;
}

const routeOrderTable = () => (supabase as any).from('laundry_classic_route_order');

export const getDateDayOfWeek = (date: string): number => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1).getDay();
};

export const getClassicRouteDay = (dateStart: string, explicitDay?: number | null): number => (
  explicitDay ?? getDateDayOfWeek(dateStart)
);

export const fetchLaundryRouteOrder = async (
  sedeId: string,
  deliveryDay: number,
): Promise<LaundryRouteOrderItem[]> => {
  const { data, error } = await routeOrderTable()
    .select('id, sede_id, delivery_day, property_id, position')
    .eq('sede_id', sedeId)
    .in('delivery_day', deliveryDay === GLOBAL_ROUTE_DAY ? [GLOBAL_ROUTE_DAY] : [deliveryDay, GLOBAL_ROUTE_DAY])
    .order('position', { ascending: true });

  if (error) throw error;

  const rows = (data || []) as any[];
  const specificRows = rows.filter((row) => row.delivery_day === deliveryDay);
  const applicableRows = deliveryDay === GLOBAL_ROUTE_DAY || specificRows.length > 0
    ? specificRows
    : rows.filter((row) => row.delivery_day === GLOBAL_ROUTE_DAY);

  return applicableRows.map((row) => ({
    id: row.id,
    sedeId: row.sede_id,
    deliveryDay: row.delivery_day,
    propertyId: row.property_id,
    position: row.position,
  }));
};

export const saveLaundryRouteOrder = async ({
  sedeId,
  deliveryDay,
  propertyIds,
}: {
  sedeId: string;
  deliveryDay: number;
  propertyIds: string[];
}): Promise<void> => {
  const uniquePropertyIds = Array.from(new Set(propertyIds));
  const { data: existingRows, error: existingError } = await routeOrderTable()
    .select('id, property_id')
    .eq('sede_id', sedeId)
    .eq('delivery_day', deliveryDay);

  if (existingError) throw existingError;

  const desiredSet = new Set(uniquePropertyIds);
  const idsToRemove = ((existingRows || []) as any[])
    .filter((row) => !desiredSet.has(row.property_id))
    .map((row) => row.id);

  if (idsToRemove.length > 0) {
    const { error } = await routeOrderTable().delete().in('id', idsToRemove);
    if (error) throw error;
  }

  if (uniquePropertyIds.length === 0) return;

  const rows = uniquePropertyIds.map((propertyId, position) => ({
    sede_id: sedeId,
    delivery_day: deliveryDay,
    property_id: propertyId,
    position,
  }));

  const { error } = await routeOrderTable().upsert(rows, {
    onConflict: 'sede_id,delivery_day,property_id',
  });

  if (error) throw error;
};

/**
 * Orders a classic link snapshot by the configured route first.
 * Dates are used as a tie-breaker so multi-day routes keep each property's
 * services chronological without breaking the manually defined route.
 * Unconfigured properties are intentionally placed after configured ones.
 */
export const orderClassicLaundryTaskIds = async ({
  taskIds,
  sedeId,
  dateStart,
  deliveryDay,
}: {
  taskIds: string[];
  sedeId?: string | null;
  dateStart: string;
  deliveryDay?: number | null;
}): Promise<string[]> => {
  const uniqueTaskIds = Array.from(new Set(taskIds));
  if (uniqueTaskIds.length < 2 || !sedeId) return uniqueTaskIds;

  const routeDay = getClassicRouteDay(dateStart, deliveryDay);
  const [tasksResult, orderResult] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, date, start_time, propiedad_id, property, properties:propiedad_id(codigo)')
      .in('id', uniqueTaskIds),
    routeOrderTable()
      .select('property_id, position, delivery_day')
      .eq('sede_id', sedeId)
      .in('delivery_day', routeDay === GLOBAL_ROUTE_DAY ? [GLOBAL_ROUTE_DAY] : [routeDay, GLOBAL_ROUTE_DAY]),
  ]);

  if (tasksResult.error || orderResult.error) {
    console.warn('No se pudo aplicar el orden de ruta clásico:', tasksResult.error || orderResult.error);
    return uniqueTaskIds;
  }

  const orderRows = (orderResult.data || []) as any[];
  const specificOrderRows = orderRows.filter((row) => row.delivery_day === routeDay);
  const globalOrderRows = orderRows.filter((row) => row.delivery_day === GLOBAL_ROUTE_DAY);
  const globalPositionByProperty = new Map<string, number>(
    globalOrderRows.map((row) => [row.property_id, row.position]),
  );
  const taskData = (tasksResult.data || []) as any[];
  const globalOrderCoversLink = taskData.length > 0 && taskData.every((task) => (
    task.propiedad_id && globalPositionByProperty.has(task.propiedad_id)
  ));

  // A complete base order is authoritative for new links. This prevents an
  // old day-specific snapshot from overriding the route order the manager
  // explicitly configured for all routes. Day-specific rows remain useful as
  // a fallback while the base order is still incomplete.
  const applicableOrderRows = routeDay === GLOBAL_ROUTE_DAY || globalOrderCoversLink
    ? globalOrderRows
    : specificOrderRows.length > 0
      ? specificOrderRows
      : globalOrderRows;
  const positionByProperty = new Map<string, number>(
    applicableOrderRows.map((row) => [row.property_id, row.position]),
  );
  const taskRows = ((tasksResult.data || []) as any[]).sort((a, b) => {
    const positionA = positionByProperty.get(a.propiedad_id) ?? Number.MAX_SAFE_INTEGER;
    const positionB = positionByProperty.get(b.propiedad_id) ?? Number.MAX_SAFE_INTEGER;
    if (positionA !== positionB) return positionA - positionB;

    const dateCompare = String(a.date || '').localeCompare(String(b.date || ''));
    if (dateCompare !== 0) return dateCompare;

    const timeCompare = String(a.start_time || '').localeCompare(String(b.start_time || ''));
    if (timeCompare !== 0) return timeCompare;

    const codeA = a.properties?.codigo || a.property || '';
    const codeB = b.properties?.codigo || b.property || '';
    return String(codeA).localeCompare(String(codeB), 'es', { numeric: true });
  });

  const orderedIds = taskRows.map((row) => row.id);
  const returned = new Set(orderedIds);
  return [...orderedIds, ...uniqueTaskIds.filter((id) => !returned.has(id))];
};
