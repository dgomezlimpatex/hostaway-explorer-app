import { calculateOccurrences, getMadridDateKey, isRecurringOccurrence } from '../../../supabase/functions/_shared/recurringSchedule';
import type { StaffingDataset, StaffingIssue, StaffingProviderCoverage, StaffingService } from './types';
import { mapStaffingWorkers } from './dataWorkers';
export type StaffingRow = Record<string, unknown>;
export interface StaffingReadSpec {
  table: string; columns: string; from: number; to: number;
  equals?: Record<string, string | boolean>;
  within?: { column: string; ids: string[] };
  since?: { column: string; value: string }; until?: { column: string; value: string };
}
export type StaffingReadPage = (spec: StaffingReadSpec) => Promise<StaffingRow[]>;
export interface StaffingReadRules {
  shiftPropertyIds?: readonly string[];
  useHabitualCollaborators?: boolean;
  allowCrossCenterMobility?: boolean;
  /** Personas confirmadas fuera de la previsión general (dirección, solo urgencias…). */
  excludedWorkerIds?: readonly string[];
}
import { text, numeric, timeMinutes, datePlus, validDate, accessWindow } from './dataUtils';
export { timeMinutes, datePlus } from './dataUtils';
const active = (row: StaffingRow) => !['cancelled', 'canceled', 'cancelado', 'cancelada', 'deleted', 'no_show', 'block'].includes(text(row.status).toLowerCase());
const PAGE = 500;
export async function readStaffingDataset(read: StaffingReadPage, sedeId: string, from: string, to: string, rules: StaffingReadRules = {}): Promise<StaffingDataset> {
  if (!sedeId) throw new Error('Selecciona una sede para consultar la previsión.');
  // Six natural months need a few extra days for the Monday–Sunday context.
  if (!validDate(from) || !validDate(to) || to < from || (Date.parse(to) - Date.parse(from)) / 86400000 > 195) throw new Error('Rango de previsión inválido (máximo seis meses).');
  const issues: StaffingIssue[] = [];
  const all = async (spec: Omit<StaffingReadSpec, 'from' | 'to'>): Promise<StaffingRow[]> => {
    const rows = new Map<string, StaffingRow>();
    for (let offset = 0; offset < 100000; offset += PAGE) {
      const page = await read({ ...spec, from: offset, to: offset + PAGE - 1 });
      let added = 0;
      for (const row of page) {
        if ((spec.within && !spec.within.ids.includes(text(row[spec.within.column]))) || Object.entries(spec.equals || {}).some(([key, value]) => row[key] !== value)) {
          issues.push({ code: 'scope-violation', message: `Filas fuera del ámbito descartadas en ${spec.table}; lectura incompleta.` });
          continue;
        }
        const id = text(row.id);
        if (!id) throw new Error(`Fuente sin identificador estable: ${spec.table}`);
        const previous = rows.get(id);
        if (previous) {
          if (spec.columns.split(',').some(column => JSON.stringify(previous[column]) !== JSON.stringify(row[column]))) issues.push({ code: 'concurrent-read-conflict', message: `Fila cambiante entre páginas de ${spec.table}; se conserva la primera lectura sin certificar instantánea.` });
        } else { added++; rows.set(id, row); }
      }
      if (page.length < PAGE) return [...rows.values()];
      if (!added) throw new Error(`Paginación sin progreso: ${spec.table}`);
    }
    throw new Error(`Fuente demasiado grande: ${spec.table}. Acota el inventario.`);
  };
  const children = async (table: string, columns: string, column: string, ids: string[], extra: Partial<StaffingReadSpec> = {}) => {
    const rows: StaffingRow[] = [];
    for (let index = 0; index < ids.length; index += 100) rows.push(...await all({ table, columns, ...extra, within: { column, ids: ids.slice(index, index + 100) } }));
    return rows;
  };
  const failedSources = new Set<string>();
  const safeAll = async (spec: Omit<StaffingReadSpec, 'from' | 'to'>) => {
    try { return await all(spec); } catch {
      failedSources.add(spec.table);
      issues.push({ code: 'source-unavailable', message: `No se pudo completar ${spec.table}; datos desconocidos, no vacío certificado.` }); return [];
    }
  };
  const safeChildren = async (...args: Parameters<typeof children>) => {
    try { return await children(...args); } catch {
      failedSources.add(args[0]);
      issues.push({ code: 'source-unavailable', message: `No se pudo completar ${args[0]}; datos desconocidos, no vacío certificado.` }); return [];
    }
  };
  const [properties, rawWorkers, rawTasks] = await Promise.all([
    safeAll({ table: 'properties', columns: 'id,nombre,sede_id,cliente_id,is_active,duracion_servicio,check_out_predeterminado,check_in_predeterminado', equals: { sede_id: sedeId } }),
    safeAll({ table: 'cleaners', columns: 'id,name,sede_id,is_active,contract_hours_per_week,start_date', equals: { sede_id: sedeId, is_active: true } }),
    safeAll({ table: 'tasks', columns: 'id,propiedad_id,sede_id,date,status,duracion,check_out,check_in,start_time,end_time,type,cleaner_id', equals: { sede_id: sedeId }, since: { column: 'date', value: `${from.slice(0, 4)}-01-01` }, until: { column: 'date', value: to } }),
  ]);
  // Defense in depth: validate returned parent scopes as well as query predicates.
  if ([...properties, ...rawWorkers, ...rawTasks].some(row => row.sede_id !== sedeId)) throw new Error('La lectura devolvió datos fuera de la sede solicitada.');
  // NOT COUNT es el marcador interno del trabajo que no se realiza (no se factura):
  // queda fuera de la previsión, ni como capacidad ni como carga de sus tareas.
  const internalWorkerIds = new Set(rawWorkers.filter(row => /^not[\s_-]*count$/i.test(text(row.name).trim())).map(row => text(row.id)));
  const ruleExcludedIds = new Set(rules.excludedWorkerIds ?? []);
  // Fuera de la previsión como PERSONAS (dirección, solo urgencias): no aportan horas.
  const staffingWorkers = rawWorkers.filter(row => !internalWorkerIds.has(text(row.id)) && !ruleExcludedIds.has(text(row.id)));
  // En cambio su TRABAJO sí cuenta como carga del equipo general: solo se descarta
  // la carga de NOT COUNT, que son limpiezas que no se realizan ni se facturan.
  const tasks = rawTasks.filter(task => !internalWorkerIds.has(text(task.cleaner_id)));
  const ruleExcludedWorkers = rawWorkers.filter(row => ruleExcludedIds.has(text(row.id)));
  if (ruleExcludedWorkers.length) issues.push({ code: 'worker-rule-excluded', message: `Fuera de la previsión por regla de sede (no hacen limpieza general): ${ruleExcludedWorkers.map(row => text(row.name)).join(', ')}. No cuentan sus horas; el trabajo que tengan asignado sí suma como carga.` });
  // Directory precedence: explicit property state wins; NULL inherits its client.
  // Read only clients needed for inheritance, scoped by already-authorized properties.
  const clientIds = [...new Set(properties.filter(row => row.is_active == null).map(row => text(row.cliente_id)).filter(Boolean))];
  const clients = await safeChildren('clients', 'id,sede_id,is_active', 'id', clientIds, { equals: { sede_id: sedeId } });
  const clientStates = new Map(clients.map(row => [text(row.id), row.is_active]));
  const unresolvedPropertyIds = new Set<string>();
  const effectiveActive = (row: StaffingRow) => {
    if (row.is_active != null) return row.is_active !== false;
    const clientId = text(row.cliente_id);
    if (clientId && !clientStates.has(clientId)) {
      unresolvedPropertyIds.add(text(row.id));
      issues.push({ code: 'client-state-unavailable', message: 'Estado heredado de cliente no disponible; inventario elegible parcial. Reintenta la lectura.' });
      return false;
    }
    return clientStates.get(clientId) !== false;
  };
  const excludedPropertyIds = new Set(properties.filter(row => !effectiveActive(row)).map(row => text(row.id)));
  const propertyIds = properties.filter(row => !excludedPropertyIds.has(text(row.id))).map(row => text(row.id));
  const workerIds = staffingWorkers.map(row => text(row.id));
  const [memberships, availability, fixedRests] = await Promise.all([
    safeChildren('property_group_assignments', 'id,property_id,property_group_id', 'property_id', propertyIds),
    safeChildren('cleaner_availability', 'id,cleaner_id,day_of_week,is_available,start_time,end_time', 'cleaner_id', workerIds),
    safeChildren('worker_fixed_days_off', 'id,cleaner_id,day_of_week,is_active', 'cleaner_id', workerIds, { equals: { is_active: true } }),
  ]);
  const groupIds = [...new Set(memberships.map(row => text(row.property_group_id)).filter(Boolean))];
  const [groups, staffing] = await Promise.all([
    safeChildren('property_groups', 'id,name,check_out_time,check_in_time,is_active', 'id', groupIds),
    safeChildren('cleaner_group_assignments', 'id,cleaner_id,property_group_id,priority,is_active', 'cleaner_id', workerIds),
  ]);
  const groupMap = new Map(groups.filter(row => row.is_active === true).map(row => [text(row.id), row]));
  for (const membership of memberships) {
    if (!groups.some(group => group.id === membership.property_group_id)) issues.push({ code: 'group-state-unavailable', message: 'Grupo vinculado no resuelto; se conserva el centro individual con restricciones pendientes de verificar.', centerId: text(membership.property_id) });
  }
  if (excludedPropertyIds.size > unresolvedPropertyIds.size) issues.push({ code: 'inactive-properties-excluded', message: `${excludedPropertyIds.size - unresolvedPropertyIds.size} propiedades efectivamente inactivas excluidas del inventario elegible. El estado explícito de la propiedad prevalece; si es nulo hereda el cliente.` });
  const propertyMap = new Map(properties.map(row => [text(row.id), row]));
  const shiftPropertyIds = new Set((rules.shiftPropertyIds || []).filter(id => {
    if (propertyMap.has(id) && !excludedPropertyIds.has(id)) return true;
    issues.push({ code: 'invalid-shift-property', message: 'Regla de jornada con ID de propiedad inexistente o fuera de la sede leída; no se clasifica por nombre ni se amplía el ámbito.' });
    return false;
  }));
  const membershipIndex = new Map<string, StaffingRow[]>();
  for (const row of memberships) if (groupMap.has(text(row.property_group_id))) membershipIndex.set(text(row.property_id), [...(membershipIndex.get(text(row.property_id)) || []), row]);
  const centerFor = (id: string) => {
    const matches = membershipIndex.get(id) || [];
    if (matches.length > 1) issues.push({ code: 'ambiguous-center', message: 'Propiedad vinculada a varios centros; revisar asignación.', centerId: id });
    return matches.length === 1 && groupMap.has(text(matches[0].property_group_id)) ? text(matches[0].property_group_id) : id;
  };
  const centerMap = new Map<string, StaffingDataset['centers'][number]>();
  for (const property of properties.filter(row => row.is_active !== false && !excludedPropertyIds.has(text(row.id)))) {
    const id = centerFor(text(property.id)); const group = groupMap.get(id);
    if (!centerMap.has(id)) centerMap.set(id, { id, name: text(group?.name) || text(property.nombre) || 'Centro sin nombre', startMinute: timeMinutes(group?.check_out_time ?? property.check_out_predeterminado), endMinute: timeMinutes(group?.check_in_time ?? property.check_in_predeterminado) });
  }
  const optional = async (load: () => Promise<StaffingRow[]>, label: string) => {
    try { return await load(); } catch { issues.push({ code: 'extension-unavailable', message: `${label} no disponible; se conserva contrato base con incertidumbre explícita.` }); return []; }
  };
  const [absences, maintenance, maintenanceTypes, contracts, workerPlanning] = await Promise.all([
    safeChildren('worker_absences', 'id,cleaner_id,start_date,end_date,start_time,end_time,absence_type', 'cleaner_id', workerIds, { since: { column: 'end_date', value: from }, until: { column: 'start_date', value: to } }),
    safeChildren('worker_maintenance_cleanings', 'id,cleaner_id,days_of_week,start_time,end_time,is_active', 'cleaner_id', workerIds, { equals: { is_active: true } }),
    optional(() => children('worker_maintenance_cleanings', 'id,cleaner_id,schedule_type', 'cleaner_id', workerIds), 'schedule_type de compromisos'),
    safeChildren('worker_contracts', 'id,cleaner_id,start_date,end_date,is_active,status,contract_hours_per_week', 'cleaner_id', workerIds, { until: { column: 'start_date', value: to } }),
    optional(() => all({ table: 'cleaners', columns: 'id,sede_id,planning_max_daily_minutes', equals: { sede_id: sedeId } }), 'Límites diarios avanzados'),
  ]);
  const preferred = await safeChildren('property_preferred_cleaners', 'id,property_id,cleaner_id,priority', 'property_id', propertyIds);
  const preferredStaffing = preferred.filter(row => {
    if (workerIds.includes(text(row.cleaner_id))) return true;
    issues.push({ code: 'scope-violation', message: 'Preferencia de propiedad con trabajador no autorizado; vínculo descartado.' }); return false;
  }).map(row => ({ ...row, property_group_id: centerFor(text(row.property_id)), is_active: true }));
  if (rules.allowCrossCenterMobility === true) issues.push({ code: 'mobility-policy-assumption', message: 'Movilidad entre centros habilitada por regla explícita de esta sede; excepciones individuales no están modeladas y requieren confirmación.' });
  const workers = mapStaffingWorkers({ allowCrossCenterMobility: rules.allowCrossCenterMobility, useHabitualCollaborators: rules.useHabitualCollaborators, workers: staffingWorkers, availability, rests: fixedRests, staffing: [...staffing, ...preferredStaffing], absences, maintenance, maintenanceTypes, contracts, planning: workerPlanning, groupIds: [...centerMap.keys()], from, to, issues });
  if (['cleaner_availability', 'worker_absences', 'worker_maintenance_cleanings', 'worker_fixed_days_off', 'cleaner_group_assignments', 'property_preferred_cleaners'].some(table => failedSources.has(table))) {
    for (const worker of workers) worker.availability = [];
    issues.push({ code: 'capacity-incomplete', message: 'Fuentes de disponibilidad o exclusión incompletas: capacidad de asignación retenida hasta verificar restricciones.' });
  }
  const propertyPlanning = await optional(() => all({ table: 'properties', columns: 'id,sede_id,planning_required_cleaners,planning_estimated_checkout_minutes,planning_estimated_stay_minutes', equals: { sede_id: sedeId } }), 'Planificación avanzada de propiedades');
  const planningMap = new Map(propertyPlanning.filter(row => propertyMap.has(text(row.id))).map(row => [text(row.id), row]));
  const requiredWorkers = (propertyId: string) => {
    const count = numeric(planningMap.get(propertyId)?.planning_required_cleaners);
    if (Number.isInteger(count) && count > 0) return count;
    issues.push({ code: 'required-workers-assumption', message: 'Equipo simultáneo no confirmado: hipótesis de una persona, no cobertura certificada.', centerId: centerFor(propertyId) });
    return 1;
  };
  const propertyEffort = (property: StaffingRow | undefined, kind: StaffingService['kind']) => {
    const specific = numeric(planningMap.get(text(property?.id))?.[kind === 'stay' ? 'planning_estimated_stay_minutes' : kind === 'checkout' ? 'planning_estimated_checkout_minutes' : '']);
    return specific > 0 ? specific : numeric(property?.duracion_servicio);
  };
  const shiftDuration = (row: StaffingRow) => {
    const value = typeof row.duracion === 'number' || typeof row.duracion === 'string' ? numeric(row.duracion) : NaN;
    return Number.isFinite(value) && value > 0 ? value : NaN;
  };
  const shiftWindow = (row: StaffingRow, centerId: string) => {
    const clock = (value: unknown) => timeMinutes(value) + Number(text(value).split(':')[2] || 0) / 60;
    const startMinute = clock(row.start_time); const endMinute = clock(row.end_time);
    const duration = shiftDuration(row);
    const validWindow = Number.isFinite(startMinute) && Number.isFinite(endMinute) && endMinute > startMinute;
    if (!validWindow) issues.push({ code: 'invalid-shift-window', message: 'Jornada sin horario de trabajo válido: no se sustituye por checkout/checkin ni por límites del centro.', centerId });
    if (!Number.isFinite(duration)) issues.push({ code: 'invalid-shift-duration', message: 'Jornada sin duración propia válida: no se infiere de la propiedad ni del horario.', centerId });
    const mismatch = validWindow && Number.isFinite(duration) && duration !== endMinute - startMinute;
    if (mismatch) issues.push({ code: 'shift-duration-window-conflict', message: 'Duración de jornada y horario discrepan: esfuerzo original conservado, asignación retenida hasta revisar; no se ajustan silenciosamente.', centerId });
    return validWindow && Number.isFinite(duration) && !mismatch ? { startMinute, endMinute } : { startMinute: NaN, endMinute: NaN };
  };
  const inventory = new Map<string, StaffingDataset['inventory'][number]>();
  // Read an extra 60 days only to report each PMS' advance horizon. These rows
  // never become services unless they fall inside the requested forecast range.
  const coverageReferenceEnd = datePlus(from, Math.max(60, Math.round((Date.parse(to) - Date.parse(from)) / 86400000)));
  const coverageRows = new Map<StaffingProviderCoverage['provider'], { id: string; date: string }[]>();
  const coverageFailed = new Set<StaffingProviderCoverage['provider']>();
  const recordCoverage = (provider: StaffingProviderCoverage['provider'], row: StaffingRow, date: string) => {
    if (!validDate(date)) return;
    const rows = coverageRows.get(provider) || [];
    if (!rows.some(item => item.id === text(row.id))) rows.push({ id: text(row.id), date });
    coverageRows.set(provider, rows);
  };
  const services: StaffingService[] = [];
  const isCheckIn = (row: StaffingRow) => text(row.type).trim().toLowerCase() === 'check-in';
  const normalizeTaskKind = (row: StaffingRow): StaffingService['kind'] => {
    const raw = text(row.service_kind || row.kind || row.type).trim().toLowerCase();
    if (raw.includes('turistica') || raw.includes('checkout') || raw.includes('check-out') || raw.includes('salida')) return 'checkout';
    if (raw.includes('estancia') || raw.includes('stay')) return 'stay';
    return 'fixed';
  };
  const excludeCheckIn = () => issues.push({ code: 'check-in-occupancy-unverified', message: 'Check-in excluidos de la demanda de limpieza. Su ocupación de personal aún no está conciliada: la disponibilidad y las asignaciones son provisionales, no cobertura certificada.' });
  for (const task of tasks) {
    const date = text(task.date); const month = date.slice(0, 7);
    const entry = inventory.get(month) || { month, tasks: 0, completed: 0, missingDuration: 0 };
    entry.tasks++; if (task.status === 'completed') entry.completed++;
    const property = propertyMap.get(text(task.propiedad_id));
    if (excludedPropertyIds.has(text(task.propiedad_id))) continue;
    const isShift = shiftPropertyIds.has(text(task.propiedad_id));
    const kind = isShift ? 'fixed' : normalizeTaskKind(task);
    const configured = propertyEffort(property, kind);
    const base = isShift ? shiftDuration(task) : configured > 0 ? configured + 30 : numeric(task.duracion);
    if (!isShift && !(configured > 0) && base > 0) issues.push({ code: 'task-duration-assumption', message: 'Se usan minutos planificados de tarea como hipótesis de esfuerzo; no se añade otro margen porque puede estar incluido.' });
    if (!(base > 0)) entry.missingDuration++;
    inventory.set(month, entry);
    if (!active(task) || date < from || date > to) continue;
    if (isCheckIn(task)) { excludeCheckIn(); continue; }
    if (!property) {
      const centerId = `unmapped:${sedeId}`;
      centerMap.set(centerId, { id: centerId, name: 'Demanda sin centro identificado', startMinute: NaN, endMinute: NaN });
      issues.push({ code: 'unmapped-task', message: 'Tareas sin propiedad autorizada: demanda conservada en centro no identificado.', centerId });
      services.push({ id: `task:${text(task.id)}`, date, centerId, personMinutes: base > 0 ? base : NaN, startMinute: NaN, endMinute: NaN, requiredWorkers: 1, source: 'task', kind });
      continue;
    }
    const centerId = centerFor(text(property.id)); const center = centerMap.get(centerId)!;
    services.push({ id: `task:${text(task.id)}`, date, centerId, personMinutes: base > 0 ? base : NaN,
      ...(isShift ? shiftWindow(task, centerId) : accessWindow(task, center, issues)),
      requiredWorkers: isShift ? 1 : requiredWorkers(text(property.id)), source: 'task', kind });
  }
  const taskServiceMap = new Map(services.map(service => [service.id, service]));
  const hasTaskForPropertyDate = (propertyId: string, date: string, kind: string) => tasks.some(task => {
    if (text(task.propiedad_id) !== propertyId || text(task.date) !== date || !active(task)) return false;
    if (!text(task.service_kind || task.kind || task.type).trim()) return false;
    const taskKind = normalizeTaskKind(task);
    const normalizedKind = kind.toLowerCase();
    return !!taskKind && (taskKind === normalizedKind || taskKind.includes(normalizedKind) || normalizedKind.includes(taskKind));
  });
  const shiftPmsConflict = (propertyId: string) => issues.push({ code: 'shift-pms-conflict', message: 'Reserva o mapeo PMS vinculado a una propiedad de jornadas: no se recalcula por habitaciones ni se modifica la jornada; revisar conflicto de modelos.', centerId: centerFor(propertyId) });
  // Resolve inverse cardinality across ALL providers before applying any mapping enrichment.
  const taskClaims = new Map<string, Set<string>>();
  const taskEnrichments = new Map<string, Partial<StaffingService>>();
  const claimTask = (taskId: string, ...identity: unknown[]) => {
    if (!taskId) return;
    const claims = taskClaims.get(taskId) || new Set<string>();
    claims.add(JSON.stringify(identity));
    taskClaims.set(taskId, claims);
  };
  const reservationActive = (row: StaffingRow, provider: 'avantio' | 'lh' | 'avirato') => {
    const status = text(provider === 'avirato' ? row.normalized_status : row.status).toLowerCase();
    if (!active({ status }) || row.cancellation_date) return false;
    // Observed Avantio states; never apply this vocabulary to another PMS.
    if (provider === 'avantio' && ['paid', 'in_progress'].includes(status)) return true;
    if (provider === 'lh' && status === 'checked-in') return true;
    if (['confirmed', 'active', 'check_in', 'checked_in', 'checked_out', 'check_out'].includes(status)) return true;
    issues.push({ code: 'unknown-reservation-status', message: 'Estado de reserva no validado; demanda pendiente de revisar, no cero certificado.' });
    return false;
  };
  const taskMap = new Map(tasks.map(row => [text(row.id), row]));
  const resolveLinkedTasks = async (ids: string[]) => {
    const missing = [...new Set(ids.filter(id => id && !taskMap.has(id)))];
    try {
      const found = await children('tasks', 'id,sede_id,propiedad_id,date,status,duracion,type', 'id', missing, { equals: { sede_id: sedeId } });
      for (const task of found) taskMap.set(text(task.id), task);
    } catch {
      issues.push({ code: 'source-unavailable', message: 'No se pudieron resolver las tareas vinculadas con ámbito de sede.' });
    }
  };
  const linkedTask = (id: string, propertyId: string, date: string) => {
    const task = taskMap.get(id);
    if (!task) issues.push({ code: 'linked-task-unavailable', message: 'Vínculo con tarea inexistente o no visible; no se regenera silenciosamente la demanda.' });
    else {
      if (task.propiedad_id !== propertyId || task.date !== date || !active(task)) issues.push({ code: 'reservation-link-conflict', message: 'El vínculo discrepa de propiedad, fecha o cancelación de la tarea; se conserva la tarea sin duplicarla.' });
      if (text(task.date) < from || text(task.date) > to) issues.push({ code: 'linked-task-outside-range', message: 'Tarea vinculada fuera del periodo; no se duplica en la fecha original.' });
    }
    return task;
  };
  for (const [table, dateColumn] of [['avantio_reservations', 'departure_date']]) {
    try {
      const reservations = await children(table, `id,property_id,${dateColumn},status,cancellation_date,task_id,reservation_date`, 'property_id', propertyIds, { since: { column: dateColumn, value: from }, until: { column: dateColumn, value: coverageReferenceEnd } });
      await resolveLinkedTasks(reservations.map(row => text(row.task_id)));
      for (const row of reservations) claimTask(text(row.task_id), table, row.id, row[dateColumn]);
      for (const row of reservations) {
        if (!reservationActive(row, 'avantio')) {
          if (row.task_id && taskMap.has(text(row.task_id)) && active(taskMap.get(text(row.task_id))!)) issues.push({ code: 'reservation-link-conflict', message: 'Reserva excluida con tarea activa vinculada; revisar cancelación.' });
          continue;
        }
        recordCoverage('avantio', row, text(row[dateColumn]));
        const property = propertyMap.get(text(row.property_id));
        if (!property) throw new Error('Reserva fuera de ámbito');
        const date = text(row[dateColumn]); if (date < from || date > to) continue;
        if (row.task_id) {
          const task = linkedTask(text(row.task_id), text(row.property_id), date);
          if (shiftPropertyIds.has(text(row.property_id))) shiftPmsConflict(text(row.property_id));
          else if (shiftPropertyIds.has(text(task?.propiedad_id))) shiftPmsConflict(text(task?.propiedad_id));
          continue;
        }
        if (shiftPropertyIds.has(text(row.property_id))) { shiftPmsConflict(text(row.property_id)); continue; }
        if (tasks.some(task => task.propiedad_id === row.property_id && task.date === date && active(task))) issues.push({ code: 'possible-duplicate', message: 'Reserva y tarea coinciden sin vínculo: se conservan ambas como demanda prudente hasta revisar.' });
        const centerId = centerFor(text(property.id)); const center = centerMap.get(centerId)!;
        const base = propertyEffort(property, 'checkout');
        services.push({ id: `${table}:${text(row.id)}`, date, centerId, personMinutes: base > 0 ? base + 30 : NaN, startMinute: center.startMinute, endMinute: center.endMinute, requiredWorkers: requiredWorkers(text(property.id)), source: 'reservation', kind: 'checkout' });
      }
    } catch {
      coverageFailed.add('avantio');
      issues.push({ code: 'source-unavailable', message: `No se ha podido verificar ${table}; la demanda podría estar incompleta.` });
    }
  }
  for (const provider of ['lh', 'avirato'] as const) {
    try {
      const roomColumn = provider === 'lh' ? 'lh_room' : 'space_subtype_id';
      const reservations = await all({ table: `${provider}_reservations`, columns: `id,sede_id,check_in,check_out,status,${provider === 'lh' ? 'room,rooms,needs_room_assignment' : 'space_subtype_id,normalized_status'}`, equals: { sede_id: sedeId }, since: { column: 'check_out', value: from }, until: { column: 'check_in', value: coverageReferenceEnd } });
      const [mappings, links] = await Promise.all([
        all({ table: `${provider}_room_mapping`, columns: `id,sede_id,${roomColumn},service_kind,propiedad_id,is_active,default_start_time,default_duration_min`, equals: { sede_id: sedeId } }),
        children(`${provider}_reservation_tasks`, `id,reservation_id,task_id,${roomColumn},service_kind,task_date,status`, 'reservation_id', reservations.map(row => text(row.id)), { since: { column: 'task_date', value: from }, until: { column: 'task_date', value: to } }),
      ]);
      const mappingIndex = new Map<string, StaffingRow[]>();
      const linkIndex = new Map<string, StaffingRow[]>();
      const key = (...parts: unknown[]) => JSON.stringify(parts);
      for (const row of mappings) {
        const mappingKey = key(String(row[roomColumn]), row.service_kind);
        mappingIndex.set(mappingKey, [...(mappingIndex.get(mappingKey) || []), row]);
      }
      for (const row of links) {
        const linkKey = key(row.reservation_id, String(row[roomColumn]), row.service_kind, row.task_date);
        linkIndex.set(linkKey, [...(linkIndex.get(linkKey) || []), row]);
        if (row.status === 'active') claimTask(text(row.task_id), provider, row.reservation_id, String(row[roomColumn]), row.service_kind, row.task_date);
      }
      await resolveLinkedTasks(links.map(row => text(row.task_id)));
      for (const reservation of reservations) {
        if (!reservationActive(reservation, provider)) {
          if (links.some(link => link.reservation_id === reservation.id && link.status === 'active')) issues.push({ code: 'reservation-link-conflict', message: 'Reserva hotelera excluida con vínculo activo; revisar cancelación sin duplicar demanda.' });
          continue;
        }
        const checkin = text(reservation.check_in); const checkout = text(reservation.check_out);
        if (!validDate(checkin) || !validDate(checkout) || checkout <= checkin) {
          issues.push({ code: 'invalid-reservation-dates', message: 'Reserva hotelera con fechas inválidas; demanda incompleta.' }); continue;
        }
        recordCoverage(provider, reservation, checkout);
        const rooms = provider === 'lh' ? (Array.isArray(reservation.rooms) && reservation.rooms.length ? reservation.rooms.map(text) : [text(reservation.room)]) : [reservation.space_subtype_id == null ? '' : String(reservation.space_subtype_id)];
        if (reservation.needs_room_assignment || rooms.some(room => !room)) issues.push({ code: 'unmapped-reservation', message: 'Reserva hotelera sin habitación confirmada; demanda incompleta.' });
        for (const room of new Set(rooms.filter(Boolean))) {
          for (let date = checkin < from ? from : datePlus(checkin, 1); date <= checkout && date <= to; date = datePlus(date, 1)) {
            const kind = date === checkout ? 'checkout' : 'stay';
            const matches = (mappingIndex.get(key(room, kind)) || []).filter(row => row.is_active === true && propertyMap.has(text(row.propiedad_id)));
            if (matches.length !== 1) { issues.push({ code: 'hotel-mapping-conflict', message: 'Falta un mapeo hotelero activo único por habitación y servicio; demanda incompleta.' }); continue; }
            const mapping = matches[0];
            // Eligibility is resolved before expansion; unresolved clients already carry a partial-inventory issue.
            if (excludedPropertyIds.has(text(mapping.propiedad_id))) continue;
            const centerId = centerFor(text(mapping.propiedad_id)); const center = centerMap.get(centerId)!;
            const mappingIsShift = shiftPropertyIds.has(text(mapping.propiedad_id));
            if (mappingIsShift) shiftPmsConflict(text(mapping.propiedad_id));
            const occurrenceLinks = linkIndex.get(key(reservation.id, room, kind, date)) || [];
            if (occurrenceLinks.length > 1) { issues.push({ code: 'hotel-link-conflict', message: 'Varios vínculos para la misma habitación, servicio y fecha; no se regenera una ocurrencia ambigua.' }); continue; }
            const link = occurrenceLinks[0];
            if (link && (link.status !== 'active' || !link.task_id)) {
              issues.push({ code: 'hotel-link-conflict', message: 'Vínculo hotelero cancelado, sin tarea o con estado no verificado; revisar sin regenerar.' });
              if (link.task_id) linkedTask(text(link.task_id), text(mapping.propiedad_id), date);
              continue;
            }
            if (link?.task_id) {
              const task = linkedTask(text(link.task_id), text(mapping.propiedad_id), date);
              const service = taskServiceMap.get(`task:${text(link.task_id)}`);
              if (shiftPropertyIds.has(text(task?.propiedad_id))) { shiftPmsConflict(text(task?.propiedad_id)); continue; }
              if (mappingIsShift) continue;
              if (task?.propiedad_id === mapping.propiedad_id && service && active(link)) {
                if (!taskEnrichments.has(text(link.task_id))) taskEnrichments.set(text(link.task_id), {
                  personMinutes: numeric(mapping.default_duration_min) > 0 ? numeric(mapping.default_duration_min) : NaN,
                  kind,
                  startMinute: kind === 'stay' ? timeMinutes(mapping.default_start_time) : Math.max(service.startMinute, timeMinutes(mapping.default_start_time)),
                  requiredWorkers: requiredWorkers(text(mapping.propiedad_id)),
                });
              }
              continue;
            }
            if (link && !active(link)) continue;
            if (mappingIsShift) continue;
            if (hasTaskForPropertyDate(text(mapping.propiedad_id), date, kind)) {
              issues.push({ code: 'possible-duplicate', message: 'Ocurrencia PMS sin vínculo coincide con una tarea activa de la misma propiedad y fecha; no se suma como demanda independiente.', centerId });
              continue;
            }
            const base = numeric(mapping.default_duration_min);
            if (!(base > 0)) issues.push({ code: 'missing-duration', message: 'Duración hotelera desconocida.', centerId });
            services.push({ id: `${provider}:${text(reservation.id)}:${room}:${kind}:${date}`, centerId, date, kind, source: 'reservation', personMinutes: base > 0 ? base : NaN, startMinute: timeMinutes(mapping.default_start_time), endMinute: center.endMinute, requiredWorkers: requiredWorkers(text(mapping.propiedad_id)) });
          }
        }
      }
    } catch {
      coverageFailed.add(provider);
      issues.push({ code: 'source-unavailable', message: `No se ha podido verificar ${provider}; la demanda podría estar incompleta.` });
    }
  }
  const mismatchedTasks = new Set<string>();
  const unverifiedExecutionTasks = new Set<string>();
  try {
    const recurring = await all({ table: 'recurring_tasks', columns: 'id,sede_id,propiedad_id,is_active,type,start_date,end_date,frequency,interval_days,days_of_week,day_of_month,start_time,end_time,check_in,check_out,duracion', equals: { sede_id: sedeId, is_active: true }, until: { column: 'start_date', value: to } });
    const recurringIds = recurring.filter(row => !row.end_date || text(row.end_date) >= from).map(row => text(row.id));
    // Timestamp is execution time, not necessarily occurrence day: read all scoped parent history.
    const executions = await children('recurring_task_executions', 'id,recurring_task_id,execution_date,generated_task_id,success', 'recurring_task_id', recurringIds);
    const uncertainExecutions = new Set<string>();

    let extension: StaffingRow[] = [];
    try { extension = await children('recurring_task_executions', 'id,recurring_task_id,execution_day', 'recurring_task_id', recurringIds); }
    catch {
      issues.push({ code: 'execution-day-unavailable', message: 'execution_day no disponible; se retienen las recurrencias y tareas materializadas para evitar duplicidades.' });
      for (const execution of executions) {
        if (execution.success === true) {
          uncertainExecutions.add(text(execution.recurring_task_id));
          if (execution.generated_task_id) unverifiedExecutionTasks.add(text(execution.generated_task_id));
        }
      }
    }
    const executionDays = new Map(extension.map(row => [text(row.id), text(row.execution_day)]));
    const successfulExecutions = executions.filter(row => row.success === true);

    const byOccurrence = new Map<string, StaffingRow[]>();
    for (const execution of executions) {
      if (execution.success !== true) continue;
      if (uncertainExecutions.has(text(execution.recurring_task_id))) continue;
      let day = executionDays.get(text(execution.id));
      if (!day) {
        issues.push({ code: 'execution-date-fallback', message: 'Ejecución sin execution_day: fecha Madrid del timestamp como hipótesis, no identidad histórica certificada.' });
        const timestamp = text(execution.execution_date);
        if (!Number.isFinite(Date.parse(timestamp)) || (!validDate(timestamp) && !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(timestamp))) {
          uncertainExecutions.add(text(execution.recurring_task_id));
          issues.push({ code: 'invalid-execution-date', message: 'Ejecución sin fecha válida y zona explícita; recurrencias retenidas para evitar duplicados.' }); continue;
        }
        day = /^\d{4}-\d{2}-\d{2}$/.test(timestamp) ? timestamp : getMadridDateKey(new Date(timestamp));
      }
      if (!validDate(day)) {
        uncertainExecutions.add(text(execution.recurring_task_id));
        issues.push({ code: 'invalid-execution-date', message: 'execution_day inválido; recurrencias retenidas para evitar duplicados.' }); continue;
      }
      const key = `${text(execution.recurring_task_id)}:${day}`;
      claimTask(text(execution.generated_task_id), 'recurring', execution.recurring_task_id, day);
      byOccurrence.set(key, [...(byOccurrence.get(key) || []), execution]);
    }
    await resolveLinkedTasks(executions.filter(row => row.success === true).map(row => text(row.generated_task_id)));
    for (const row of recurring) {
      if (!recurringIds.includes(text(row.id)) || uncertainExecutions.has(text(row.id))) continue;
      let dates: string[];
      const schedule = { frequency: text(row.frequency), start_date: text(row.start_date), end_date: text(row.end_date) || null, interval_days: numeric(row.interval_days), days_of_week: Array.isArray(row.days_of_week) ? row.days_of_week.map(Number) : null, day_of_month: numeric(row.day_of_month) };
      const suppliedInterval = row.interval_days;
      const suppliedDays = row.days_of_week;
      const suppliedEndDate = text(row.end_date);
      const suppliedDayOfMonth = row.day_of_month;
      const invalidInterval = suppliedInterval != null && (!Number.isInteger(Number(suppliedInterval)) || Number(suppliedInterval) < 1);
      const invalidDays = suppliedDays != null && (!Array.isArray(suppliedDays) || suppliedDays.length === 0 || suppliedDays.some(day => !Number.isInteger(Number(day)) || Number(day) < 0 || Number(day) > 6));
      const invalidFrequency = !['daily', 'weekly', 'monthly'].includes(schedule.frequency);
      const invalidEndDate = !!suppliedEndDate && !validDate(suppliedEndDate);
      const invalidDayOfMonth = suppliedDayOfMonth != null && (!Number.isInteger(Number(suppliedDayOfMonth)) || Number(suppliedDayOfMonth) < 1 || Number(suppliedDayOfMonth) > 31);
      if (invalidInterval || invalidDays || invalidFrequency || invalidEndDate || invalidDayOfMonth) {
        issues.push({ code: 'invalid-recurrence', message: 'Recurrencia con frecuencia, intervalo o días inválidos; no se normaliza ni se genera demanda.' });
        continue;
      }
      try { dates = calculateOccurrences(schedule, from, to); }
      catch { issues.push({ code: 'invalid-recurrence', message: 'Patrón recurrente inválido; demanda incompleta.' }); continue; }
      const rowExecutions = successfulExecutions.filter(execution => text(execution.recurring_task_id) === text(row.id));
      const mismatches = rowExecutions.filter(execution => {
        const day = executionDays.get(text(execution.id));
        return !!day && !isRecurringOccurrence(schedule, day);
      });
      if (mismatches.length) {
        issues.push({ code: 'recurring-execution-conflict', message: 'Ejecución materializada fuera de las fechas de la recurrencia; se bloquea la recurrencia para no duplicar ni desplazar demanda.' });
        uncertainExecutions.add(text(row.id));
        for (const execution of mismatches) if (execution.generated_task_id) mismatchedTasks.add(text(execution.generated_task_id));
        continue;
      }
      for (const date of dates) {
        if (isCheckIn(row)) { excludeCheckIn(); continue; }
        const key = `${text(row.id)}:${date}`; const matches = byOccurrence.get(key) || [];
        if (matches.length) {
          if (matches.length > 1) issues.push({ code: 'recurring-execution-conflict', message: 'Varias ejecuciones exitosas para una ocurrencia; revisar identidad.' });
          for (const execution of matches) {
            if (execution.generated_task_id) linkedTask(text(execution.generated_task_id), text(row.propiedad_id), date);
            else issues.push({ code: 'linked-task-unavailable', message: 'Ejecución exitosa sin tarea vinculada; no regenerada silenciosamente.' });
          }
          continue;
        }
        const property = propertyMap.get(text(row.propiedad_id));
        if (excludedPropertyIds.has(text(row.propiedad_id))) continue;
        if (!property) { issues.push({ code: 'unmapped-recurring', message: 'Recurrencia sin propiedad autorizada; demanda incompleta.' }); continue; }
        const centerId = centerFor(text(property.id)); const center = centerMap.get(centerId)!;
        const isShift = shiftPropertyIds.has(text(property.id));
        const base = isShift ? shiftDuration(row) : numeric(property.duracion_servicio) > 0 ? numeric(property.duracion_servicio) + 30 : numeric(row.duracion);
        if (!isShift && !(numeric(property.duracion_servicio) > 0)) issues.push({ code: 'task-duration-assumption', message: 'Minutos de recurrencia como esfuerzo provisional sin segundo margen.' });
        services.push({ id: `recurring:${key}`, date, centerId, personMinutes: base > 0 ? base : NaN, ...(isShift ? shiftWindow(row, centerId) : accessWindow(row, center, issues)), requiredWorkers: isShift ? 1 : requiredWorkers(text(property.id)), kind: 'fixed', source: 'recurring' });
      }
    }
  } catch { issues.push({ code: 'source-unavailable', message: 'Recurrencias o ejecuciones no disponibles; demanda incompleta.' }); }
  for (const taskId of unverifiedExecutionTasks) mismatchedTasks.add(taskId);
  for (const taskId of mismatchedTasks) {
    const service = taskServiceMap.get(`task:${taskId}`);
    if (service) { service.startMinute = NaN; service.endMinute = NaN; }
    issues.push({ code: 'task-occurrence-conflict', message: 'Tarea materializada fuera de la recurrencia esperada; ventana retenida hasta revisar identidad.', centerId: service?.centerId });
  }
  for (const [taskId, claims] of taskClaims) {
    const service = taskServiceMap.get(`task:${taskId}`);
    if (claims.size > 1) {
      issues.push({ code: 'task-occurrence-conflict', message: `La tarea ${taskId} está reclamada por varias ocurrencias distintas. Se conserva su esfuerzo inicial sin sumar ni elegir un mapeo; ventana retenida hasta resolver la identidad.`, centerId: service?.centerId });
      if (service) { service.startMinute = NaN; service.endMinute = NaN; }
    } else if (service) Object.assign(service, taskEnrichments.get(taskId));
  }
  // Broaden aggregate bounds only after ordinary services retain their access windows.
  const ordinaryCenterIds = new Set(properties.filter(row => !shiftPropertyIds.has(text(row.id))).map(row => centerFor(text(row.id))));
  for (const id of shiftPropertyIds) {
    const center = centerMap.get(centerFor(id))!;
    if (ordinaryCenterIds.has(center.id)) issues.push({ code: 'mixed-shift-center', message: 'Centro con jornadas y servicios de acceso: límites agregados diarios amplios, cada servicio mantiene su ventana estricta; revisar mezcla de modelos.', centerId: center.id });
    center.startMinute = 0; center.endMinute = 1440;
  }
  for (const service of services) if (!Number.isFinite(service.personMinutes) || service.personMinutes <= 0) issues.push({ code: 'missing-duration', message: 'Servicio con esfuerzo desconocido; no equivale a cero demanda.', centerId: service.centerId });
  issues.push({ code: 'provider-coverage', message: 'Ámbito: Avantio por propiedades autorizadas, Little Hotelier y Avirato por sede. Reservas sin sede/propiedad quedan fuera del ámbito seguro. Hostaway y reservas de clientes excluidos.' });
  issues.push({ code: 'non-atomic-read', message: 'Lecturas paginadas por id con offset: no son una instantánea transaccional y pueden cambiar durante la consulta.' });
  issues.push({ code: 'duration-assumption', message: 'Servicios ordinarios: tiempo base de propiedad + 30 min de margen; confirmar con tiempos reales. Las jornadas explícitas usan duración propia de tarea/recurrencia, sin margen adicional. No se infiere productividad de fichajes incompletos.' });
  issues.push({ code: 'no-snapshots', message: 'Sin instantáneas de reservas a una semana: el margen es provisional; el histórico de tareas no reconstruye reservas tardías.' });
  const first30End = datePlus(from, 30);
  const second60End = datePlus(from, 60);
  const providerLabels = { avantio: 'Avantio', lh: 'Little Hotelier', avirato: 'Avirato' } as const;
  const providerCoverage: StaffingProviderCoverage[] = (['avantio', 'lh', 'avirato'] as const).map(provider => {
    const rows = coverageRows.get(provider) || [];
    const latestDate = rows.map(row => row.date).sort().at(-1);
    const reservations30 = rows.filter(row => row.date >= from && row.date < first30End).length;
    const reservations31to60 = rows.filter(row => row.date >= first30End && row.date < second60End).length;
    const status: StaffingProviderCoverage['status'] = coverageFailed.has(provider) ? 'unknown' : !rows.length ? 'none' : latestDate && latestDate >= second60End ? 'extended' : latestDate && latestDate >= first30End ? 'one-month' : 'limited';
    return { provider, label: providerLabels[provider], referenceDate: from, reservations30, reservations31to60, latestDate, status };
  });
  return { centers: [...centerMap.values()], workers, services, issues: [...new Map(issues.map(issue => [JSON.stringify(issue), issue])).values()], inventory: [...inventory.values()].sort((a, b) => a.month.localeCompare(b.month)), providerCoverage, fetchedAt: new Date().toISOString() };
}
