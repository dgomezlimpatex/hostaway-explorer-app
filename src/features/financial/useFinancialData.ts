import { useEffect, useMemo, useRef } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildServices, readAllPages, normalizeFinancialProperties, type SourceTask, type SourcePropertyRow } from './financialSource';
import { readFinancialConsumption } from './financialConsumption';
import { monthBounds, monthsCovering, monthStaleTime, olderMonths, MONTH_STALE_MS } from './financialMonths';
import { formatMadridDate } from '@/utils/date';

const KEEP_MS = 30 * 60_000;
const PREFETCH_MONTHS = 3;

// Properties, clients, staff and consumption rules: the same for every month, read once.
async function readCatalog(sedeId: string) {
  const [properties, clients, workers] = await Promise.all([
    readAllPages((from, to) => (supabase as unknown as SupabaseClient).from('properties')
      .select('id,nombre,cliente_id,coste_servicio,duracion_servicio,numero_sabanas,numero_sabanas_pequenas,numero_sabanas_suite,numero_fundas_almohada,numero_toallas_grandes,numero_toallas_pequenas,numero_alfombrines,amenities_cocina,amenities_bano,kit_alimentario,cantidad_rollos_papel_higienico,amenities_control_enabled,property_group_assignments(property_group_id,group:property_groups(id,name,display_name,is_active))')
      .eq('sede_id', sedeId).order('id').range(from, to)),
    readAllPages((from, to) => (supabase as unknown as SupabaseClient).from('clients').select('id,nombre,amenities_control_enabled').eq('sede_id', sedeId).order('id').range(from, to)),
    readAllPages((from, to) => supabase.from('cleaners').select('id,name').eq('sede_id', sedeId).order('id').range(from, to)),
  ]);
  const clientDirectory = clients.map(client => ({ id: client.id as string, name: client.nombre as string, amenitiesControlEnabled: client.amenities_control_enabled as boolean }));
  const propertyRows = normalizeFinancialProperties(properties as SourcePropertyRow[]);
  const rules = await readFinancialConsumption(supabase, propertyRows.map(property => property.id));
  const buildings = new Map<string, { id: string; name: string; propertyIds: string[] }>();
  for (const property of propertyRows) for (const assignment of property.property_group_assignments || []) {
    if (!assignment.group) continue;
    const group = Array.isArray(assignment.group) ? assignment.group[0] : assignment.group;
    if (!group) continue;
    const entry = buildings.get(group.id) || { id: group.id, name: (group.display_name || group.name) + (group.is_active ? '' : ' · inactivo'), propertyIds: [] };
    entry.propertyIds.push(property.id); buildings.set(group.id, entry);
  }
  return { clientDirectory, propertyRows, workers, rules, buildings: [...buildings.values()] };
}
// The tasks of one calendar month, cached on their own.
const readMonth = (sedeId: string, month: string) => {
  const { start, end } = monthBounds(month);
  return readAllPages((from, to) => supabase.from('tasks')
    .select('id,type,date,status,coste,cliente_id,propiedad_id,property,cleaner_id,cleaner,start_time,end_time,duracion,task_assignments(cleaner_id,cleaner_name)')
    .eq('sede_id', sedeId).gte('date', start).lte('date', end).order('id').range(from, to));
};
const monthOptions = (sedeId: string, month: string, today: string) => ({
  queryKey: ['financial-tasks', sedeId, month], queryFn: () => readMonth(sedeId, month), staleTime: monthStaleTime(month, today), gcTime: KEEP_MS, refetchOnWindowFocus: false,
});

export function useFinancialData(sedeId: string | undefined, start: string, end: string) {
  const today = formatMadridDate(new Date());
  const client = useQueryClient();
  const months = useMemo(() => { try { return monthsCovering(start, end); } catch { return null; } }, [start, end]);
  const enabled = !!sedeId && !!months?.length;
  const catalog = useQuery({ queryKey: ['financial-catalog', sedeId], queryFn: () => readCatalog(sedeId!), enabled, staleTime: MONTH_STALE_MS, gcTime: KEEP_MS, refetchOnWindowFocus: false });
  const results = useQueries({ queries: (months || []).map(month => ({ ...monthOptions(sedeId!, month, today), enabled })) });
  // Stepping back is the usual move: once the user starts navigating, warm the next older months.
  const navigated = useRef(false);
  useEffect(() => {
    if (!enabled || !months?.length) return;
    if (!navigated.current) { navigated.current = true; return; }
    let cancelled = false;
    (async () => { for (const month of olderMonths(months, PREFETCH_MONTHS)) { if (cancelled) return; await client.prefetchQuery(monthOptions(sedeId!, month, today)).catch(() => undefined); } })();
    return () => { cancelled = true; };
  }, [client, enabled, months, sedeId, today]);

  const stamp = [catalog.dataUpdatedAt, ...results.map(result => result.dataUpdatedAt)].join('|');
  const ready = enabled && catalog.data !== undefined && results.every(result => result.data !== undefined);
  const data = useMemo(() => {
    if (!ready) return undefined;
    const { clientDirectory, propertyRows, workers, rules, buildings } = catalog.data!;
    const tasks = results.flatMap(result => result.data as unknown as SourceTask[]);
    return { services: buildServices(tasks, propertyRows, clientDirectory, workers, today, rules), clients: clientDirectory,
      properties: propertyRows.map(property => ({ id: property.id, name: property.nombre, clientId: property.cliente_id })), workers, buildings };
    // `stamp` changes exactly when any source data changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, stamp, today]);
  const error = catalog.error ?? results.find(result => result.error)?.error ?? (months === null ? new Error('El periodo contiene demasiados registros. Reduce el intervalo de fechas.') : null);
  return {
    data, error, isPending: !data && !error, isFetching: catalog.isFetching || results.some(result => result.isFetching),
    refetch: () => Promise.all([catalog.refetch(), ...results.map(result => result.refetch())]),
  };
}
