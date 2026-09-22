import type { StaffingReadPage, StaffingReadSpec, StaffingRow } from './data';
import { staffingRulesForSede } from './businessRules';
import { RULES_VERSION, validDate, dates, type ForecastDataset, type ForecastIssue, type ForecastTask, type ForecastWorker } from './forecastContract';
import { timeMinutes } from './dataUtils';
import { scopeIssue } from './forecastIssues';

const text = (value: unknown) => typeof value === 'string' ? value : '';
const numeric = (value: unknown) => value == null || value === '' ? NaN : Number(value);
const canceled = (row: StaffingRow) => ['cancelled', 'canceled', 'cancelado', 'cancelada', 'deleted', 'no_show', 'block'].includes(text(row.status).toLowerCase());

/** SELECT-only boundary. No reservations are synthesized: this forecast uses created tasks. */
export async function readForecastDataset(read: StaffingReadPage, sedeId: string, from: string, to: string, signal?: AbortSignal): Promise<ForecastDataset> {
  if (!sedeId || !validDate(from) || !validDate(to) || to < from || (Date.parse(to) - Date.parse(from)) / 86400000 > 195) throw new Error('Sede o periodo inválidos.');
  const issues: ForecastIssue[] = [];
  const sources = new Map<string, ForecastDataset['sources'][number]>();
  const issue = (code: string, message: string, source: string, impact: ForecastIssue['impact'], ids: string[] = []) => issues.push({ code, message, source, impact, ids });
  async function all(spec: Omit<StaffingReadSpec, 'from' | 'to'>): Promise<StaffingRow[]> {
    const rows = new Map<string, StaffingRow>();
    try {
      for (let offset = 0; offset < 100000; offset += 500) {
        if (signal?.aborted) throw new Error('Consulta cancelada');
        const page = await read({ ...spec, from: offset, to: offset + 499 });
        let added = 0;
        for (const row of page) {
          const id = text(row.id);
          if (!id) throw new Error('Identidad ausente');
          if (Object.entries(spec.equals ?? {}).some(([key, value]) => row[key] !== value) || spec.within && !spec.within.ids.includes(text(row[spec.within.column])) || spec.since && text(row[spec.since.column]) < spec.since.value || spec.until && text(row[spec.until.column]) > spec.until.value) {
            issue('scope-violation', 'Se descartaron registros fuera del ámbito solicitado.', spec.table, 'demand', [id]); continue;
          }
          if (rows.has(id)) {
            if (JSON.stringify(rows.get(id)) !== JSON.stringify(row)) throw new Error('Registro cambiante durante lectura');
          } else { rows.set(id, row); added++; }
        }
        if (page.length < 500) {
          const previous = sources.get(spec.table);
          sources.set(spec.table, { name: spec.table, count: (previous?.count ?? 0) + rows.size, status: previous?.status ?? 'ready', fetchedAt: new Date().toISOString() });
          return [...rows.values()];
        }
        if (!added) throw new Error('Paginación sin progreso');
      }
      throw new Error('Fuente demasiado grande');
    } catch {
      if (signal?.aborted) throw new Error('Consulta cancelada');
      sources.set(spec.table, { name: spec.table, count: 0, status: 'unavailable', fetchedAt: new Date().toISOString() });
      issue('source-unavailable', 'No se pudo completar la lectura. Reintenta antes de decidir.', spec.table, 'capacity');
      return [];
    }
  }
  async function children(table: string, columns: string, column: string, ids: string[], extra: Partial<StaffingReadSpec> = {}) {
    const rows: StaffingRow[] = [];
    for (let i = 0; i < ids.length; i += 100) rows.push(...await all({ table, columns, ...extra, within: { column, ids: ids.slice(i, i + 100) } }));
    return rows;
  }
  const [properties, people, tasks] = await Promise.all([
    all({ table: 'properties', columns: 'id,nombre,sede_id,cliente_id,is_active,duracion_servicio,check_out_predeterminado,check_in_predeterminado', equals: { sede_id: sedeId } }),
    all({ table: 'cleaners', columns: 'id,name,sede_id,is_active,contract_hours_per_week,start_date', equals: { sede_id: sedeId, is_active: true } }),
    all({ table: 'tasks', columns: 'id,propiedad_id,sede_id,date,status,duracion,check_out,check_in,start_time,end_time,type,cleaner_id', equals: { sede_id: sedeId }, since: { column: 'date', value: from }, until: { column: 'date', value: to } }),
  ]);
  const workerIds = people.map(row => text(row.id));
  const propertyIds = properties.map(row => text(row.id));
  const [members, roles, rests, absences, maintenance, assignments, preferred] = await Promise.all([
    children('property_group_assignments', 'id,property_id,property_group_id', 'property_id', propertyIds),
    children('cleaner_group_assignments', 'id,cleaner_id,property_group_id,priority,is_active', 'cleaner_id', workerIds),
    children('worker_fixed_days_off', 'id,cleaner_id,day_of_week,is_active', 'cleaner_id', workerIds, { equals: { is_active: true } }),
    children('worker_absences', 'id,cleaner_id,start_date,end_date,start_time,end_time,absence_type', 'cleaner_id', workerIds, { since: { column: 'end_date', value: from }, until: { column: 'start_date', value: to } }),
    children('worker_maintenance_cleanings', 'id,cleaner_id,days_of_week,start_time,end_time,schedule_type,is_active', 'cleaner_id', workerIds, { equals: { is_active: true } }),
    children('task_assignments', 'id,task_id,cleaner_id', 'task_id', tasks.map(row => text(row.id))),
    children('property_preferred_cleaners', 'id,property_id,cleaner_id,priority', 'property_id', propertyIds),
  ]);
  const groups = await children('property_groups', 'id,name,check_out_time,check_in_time,is_active', 'id', [...new Set(members.map(row => text(row.property_group_id)))]);
  const groupsById = new Map(groups.map(row => [text(row.id), row]));
  const propertyMap = new Map(properties.map(row => [text(row.id), row]));
  const centers = new Map<string, ForecastDataset['centers'][number]>();
  const centerByProperty = new Map<string, string>();
  for (const property of properties) {
    const id = text(property.id);
    const groupIds = [...new Set(members.filter(row => row.property_id === id).map(row => text(row.property_group_id)))];
    const group = groupIds.length === 1 ? groupsById.get(groupIds[0]) : undefined;
    if (groupIds.length > 1 || groupIds.length === 1 && !group) issue('ambiguous-center', 'El edificio de la propiedad no se puede verificar.', 'property_group_assignments', 'capacity', [id]);
    const centerId = group ? text(group.id) : `property:${id}`;
    centerByProperty.set(id, centerId);
    const previous = centers.get(centerId);
    centers.set(centerId, { id: centerId, name: text(group?.name) || text(property.nombre), startMinute: timeMinutes(group?.check_out_time ?? property.check_out_predeterminado), endMinute: timeMinutes(group?.check_in_time ?? property.check_in_predeterminado), propertyCount: (previous?.propertyCount ?? 0) + 1 });
  }
  const rules = staffingRulesForSede(sedeId);
  if (sedeId !== '1e0759ec-5e63-4edd-9dad-e493c715bbba') issue('policy-unverified', 'Las reglas operativas de esta sede requieren verificación.', 'staffingRulesForSede', 'capacity');
  const notCount = new Set(people.filter(row => /^not[\s_-]*count$/i.test(text(row.name).trim())).map(row => text(row.id)));
  const workers: ForecastWorker[] = people.filter(row => !notCount.has(text(row.id))).map(row => {
    const id = text(row.id); const contract = numeric(row.contract_hours_per_week);
    const restDays = [...new Set(rests.filter(r => r.cleaner_id === id).map(r => numeric(r.day_of_week)))];
    const centerPriorities = roles.filter(r => r.cleaner_id === id && r.is_active === true && centers.has(text(r.property_group_id)) && Number.isFinite(numeric(r.priority)) && numeric(r.priority) < 90).map(r => ({ centerId: text(r.property_group_id), priority: numeric(r.priority) }));
    const blockedSlots: NonNullable<ForecastWorker['blockedSlots']> = [];
    // Confirmed rule: free distribution inside client windows, less rest/absence/other work.
    const slots = Array.from({ length: 7 }, (_, day) => ({ day, startMinute: 0, endMinute: 1440 }));
    for (const preference of preferred.filter(p => p.cleaner_id === id && centerByProperty.get(text(p.property_id)) === `property:${text(p.property_id)}`)) {
      if (Number.isFinite(numeric(preference.priority))) centerPriorities.push({ centerId: `property:${text(preference.property_id)}`, priority: numeric(preference.priority) });
    }
    for (const item of maintenance.filter(r => r.cleaner_id === id)) {
      const startMinute = timeMinutes(item.start_time), endMinute = timeMinutes(item.end_time);
      const days = Array.isArray(item.days_of_week) ? item.days_of_week.map(Number) : [];
      if (!Number.isFinite(startMinute) || !(endMinute > startMinute) || !days.length || days.some(day => !Number.isInteger(day) || day < 0 || day > 6) || !['maintenance', 'unavailability'].includes(text(item.schedule_type))) {
        issue('invalid-maintenance', 'Un compromiso no tiene horario o tipo verificable.', 'worker_maintenance_cleanings', 'capacity', [id, text(item.id)]); continue;
      }
      days.forEach(day => blockedSlots.push({ day, startMinute, endMinute, consumesContract: item.schedule_type === 'maintenance' }));
    }
    const excludedByRule = (rules.excludedWorkerIds as readonly string[]).includes(id);
    if (!excludedByRule && (restDays.some(day => !Number.isInteger(day) || day < 0 || day > 6) || restDays.length === 7)) issue('invalid-rest', 'Libranzas contradictorias o inválidas.', 'worker_fixed_days_off', 'capacity', [id]);
    if (!Number.isFinite(contract) || contract < 0) issue('unknown-contract', 'Jornada de ficha desconocida.', 'cleaners', 'ledger', [id]);
    if (text(row.start_date) && !validDate(text(row.start_date))) issue('invalid-active-date', 'Fecha de alta no verificable.', 'cleaners', 'ledger', [id]);
    return { id, name: text(row.name), engagement: 'employee', weeklyMinutes: Number.isFinite(contract) && contract >= 0 ? contract * 60 : 0, weeklyMinutesMax: Number.isFinite(contract) ? contract * 78 : 0,
      homeCenterIds: centerPriorities.filter(r => r.priority < 30).map(r => r.centerId), centerPriorities,
      excludedCenterIds: roles.filter(r => r.cleaner_id === id && (r.is_active === false || numeric(r.priority) >= 90)).map(r => text(r.property_group_id)),
      availability: slots, restDays,
      restDay: restDays[0] ?? null, flexibleRest: restDays.length === 0, canMove: rules.allowCrossCenterMobility,
      unavailableDates: [], confirmedRestDates: absences.filter(a => a.cleaner_id === id && a.absence_type === 'day_off' && validDate(text(a.start_date)) && validDate(text(a.end_date))).flatMap(a => dates(text(a.start_date) < from ? from : text(a.start_date), text(a.end_date) > to ? to : text(a.end_date))), blockedSlots, activeFrom: validDate(text(row.start_date)) ? text(row.start_date) : undefined,
      excluded: (rules.excludedWorkerIds as readonly string[]).includes(id), contractKnown: Number.isFinite(contract) && contract >= 0 };
  });
  const normalizedTasks: ForecastTask[] = [];
  for (const row of tasks.filter(r => !canceled(r))) {
    const id = text(row.id); const propertyId = text(row.propiedad_id); const property = propertyMap.get(propertyId);
    const owners = [...new Set([text(row.cleaner_id), ...assignments.filter(a => a.task_id === id).map(a => text(a.cleaner_id))].filter(Boolean))];
    if (owners.some(owner => notCount.has(owner))) continue;
    const workerId = owners.length === 1 ? owners[0] : undefined;
    const centerId = centerByProperty.get(propertyId) ?? `unmapped:${id}`;
    if (!centers.has(centerId)) centers.set(centerId, { id: centerId, name: 'Propiedad no identificada', startMinute: NaN, endMinute: NaN, propertyCount: 0 });
    const center = centers.get(centerId)!;
    const tourism = /turistica|turística|checkout|check-out|salida|estancia|stay/i.test(text(row.type)) && !rules.shiftPropertyIds.includes(propertyId);
    const minutes = numeric(property?.duracion_servicio);
    const start = timeMinutes(row.start_time), end = timeMinutes(row.end_time);
    const windowStart = tourism ? timeMinutes(row.check_out ?? property?.check_out_predeterminado) : start;
    const windowEnd = tourism ? timeMinutes(row.check_in ?? property?.check_in_predeterminado) : end;
    if (!property) issue('unmapped-task', 'La tarea no tiene una propiedad autorizada identificada.', 'tasks', 'demand', [id]);
    if (!(minutes > 0) || !Number.isFinite(minutes)) issue('missing-duration', 'Duración desconocida; no equivale a cero trabajo.', 'properties', 'demand', [id]);
    if (!Number.isFinite(windowStart) || !Number.isFinite(windowEnd)) issue('missing-window', 'La ventana propia de la tarea no está verificada; el horario del centro es solo referencia.', 'tasks', 'capacity', [id]);
    if (owners.length > 1) issue('assignment-conflict', 'La tarea tiene más de una persona o fuentes de asignación contradictorias.', 'task_assignments', 'capacity', [id, ...owners]);
    if (workerId && !workerIds.includes(workerId)) issue('unknown-assignee', 'La persona asignada no está en la plantilla autorizada activa.', 'tasks', 'capacity', [id]);
    normalizedTasks.push({ id, propertyId, name: text(property?.nombre) || 'Propiedad no identificada', centerId, date: text(row.date), minutes,
      windowStart: Number.isFinite(windowStart) ? windowStart : center.startMinute, windowEnd: Number.isFinite(windowEnd) ? windowEnd : center.endMinute,
      start, end, workerId, ambiguous: owners.length > 1, tourism, status: text(row.status) });
  }
  const normalizedAbsences = absences.map(row => ({ id: text(row.id), workerId: text(row.cleaner_id), from: text(row.start_date), to: text(row.end_date), type: text(row.absence_type), start: row.start_time == null ? undefined : timeMinutes(row.start_time), end: row.end_time == null ? undefined : timeMinutes(row.end_time) }));
  for (const absence of normalizedAbsences) {
    const full = absence.start === undefined && absence.end === undefined;
    const validInterval = Number.isFinite(absence.start) && Number.isFinite(absence.end) && absence.end > absence.start;
    if (!validDate(absence.from) || !validDate(absence.to) || absence.to < absence.from || !full && !validInterval || !['vacation', 'sick', 'sick_leave', 'day_off', 'holiday', 'personal', 'external_work'].includes(absence.type)) issue('invalid-absence', 'Ausencia con fechas, franja o tipo no verificables.', 'worker_absences', 'capacity', [absence.workerId, absence.id]);
    if (absence.type === 'external_work' ? !validInterval : !full) issue('absence-adjustment-unverified', 'Faltan datos para computar este servicio o ajustar una ausencia parcial.', 'worker_absences', 'ledger', [absence.workerId, absence.id]);
  }
  const propertyDetails = properties.map(row => ({ id: text(row.id), name: text(row.nombre), centerId: centerByProperty.get(text(row.id))!, minutes: numeric(row.duracion_servicio), windowStart: timeMinutes(row.check_out_predeterminado), windowEnd: timeMinutes(row.check_in_predeterminado) }));
  return { sedeId, from, to, fetchedAt: new Date().toISOString(), rulesVersion: RULES_VERSION, centers: [...centers.values()], properties: propertyDetails, workers, tasks: normalizedTasks, absences: normalizedAbsences, issues: issues.map(i => scopeIssue(i, { tasks: normalizedTasks, absences: normalizedAbsences, properties: propertyDetails })), sources: [...sources.values()] };
}
