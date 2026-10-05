import { supabase } from '@/integrations/supabase/client';
import type { StaffingReadPage, StaffingRow } from './data';

interface ReadQuery extends PromiseLike<{ data: StaffingRow[] | null; error: unknown }> {
  select(columns: string): ReadQuery;
  eq(column: string, value: string | boolean): ReadQuery;
  in(column: string, values: string[]): ReadQuery;
  gte(column: string, value: string): ReadQuery;
  lte(column: string, value: string): ReadQuery;
  order(column: string, options: { ascending: boolean }): ReadQuery;
  range(from: number, to: number): ReadQuery;
  abortSignal(signal: AbortSignal): ReadQuery;
}
// This boundary intentionally exposes SELECT only. It cannot materialize tasks or send notifications.
const readClient = supabase as unknown as { from(table: string): ReadQuery };
const scopedParents: Record<string, string[]> = {
  properties: ['id'], clients: ['id'], cleaners: ['id'], tasks: [], recurring_tasks: [],
  lh_reservations: [], avirato_reservations: [], lh_room_mapping: [], avirato_room_mapping: [],
  avantio_reservations: ['property_id'], client_reservations: ['property_id'],
  property_group_assignments: ['property_id'], property_groups: ['id'],
  cleaner_group_assignments: ['cleaner_id'], property_preferred_cleaners: ['property_id'],
  cleaner_availability: ['cleaner_id'], worker_fixed_days_off: ['cleaner_id'], worker_absences: ['cleaner_id'],
  worker_maintenance_cleanings: ['cleaner_id'], worker_contracts: ['cleaner_id'], cleaner_work_schedule: ['cleaner_id'],
  lh_reservation_tasks: ['reservation_id'], avirato_reservation_tasks: ['reservation_id'],
  recurring_task_executions: ['recurring_task_id'], task_assignments: ['task_id'], task_reports: ['task_id'], time_logs: ['cleaner_id'], vacation_requests: ['cleaner_id'],
};
const directSede = new Set(['properties', 'cleaners', 'tasks', 'recurring_tasks', 'lh_reservations', 'avirato_reservations', 'lh_room_mapping', 'avirato_room_mapping']);
export const createStaffingPageReader = (signal?: AbortSignal): StaffingReadPage => async spec => {
  if (signal?.aborted) throw new Error('Consulta cancelada.');
  if (!Object.prototype.hasOwnProperty.call(scopedParents, spec.table)) throw new Error('Fuente no permitida para previsión.');
  const hasSede = directSede.has(spec.table) && typeof spec.equals?.sede_id === 'string' && !!spec.equals.sede_id;
  const hasParent = spec.within && scopedParents[spec.table].includes(spec.within.column) && spec.within.ids.length > 0 && spec.within.ids.every(id => typeof id === 'string' && !!id);
  if (!hasSede && !hasParent) throw new Error('Lectura sin ámbito rechazada.');
  if (spec.table === 'clients' && (!hasParent || !spec.equals?.sede_id || spec.columns !== 'id,sede_id,is_active')) throw new Error('Clientes requieren sede, IDs y proyección mínima.');
  if (!/^[a-z_]+(?:,[a-z_]+)*$/.test(spec.columns) || /(^|,)(pin|dni|email|telefono|notes|password|token)(,|$)/.test(spec.columns)) throw new Error('Selección de columnas no permitida.');
  if (!Number.isInteger(spec.from) || !Number.isInteger(spec.to) || spec.from < 0 || spec.to < spec.from || spec.to - spec.from >= 1000) throw new Error('Página inválida.');
  let query = readClient.from(spec.table).select(spec.columns);
  for (const [column, value] of Object.entries(spec.equals || {})) query = query.eq(column, value);
  if (spec.within) query = query.in(spec.within.column, spec.within.ids);
  if (spec.since) query = query.gte(spec.since.column, spec.since.value);
  if (spec.until) query = query.lte(spec.until.column, spec.until.value);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query.order('id', { ascending: true }).range(spec.from, spec.to);
  if (error) throw new Error(`No se pudo leer la fuente ${spec.table}. Comprueba permisos y esquema.`);
  return data || [];
};
export const readStaffingPage = createStaffingPageReader();
