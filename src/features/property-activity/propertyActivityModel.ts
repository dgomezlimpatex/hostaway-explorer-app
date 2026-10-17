import { formatMadridDateTime } from '@/utils/date';
import { shiftCivilDate } from '@/utils/madridCalendar';

/**
 * Cronología de una propiedad: solo transforma evidencias ya registradas.
 * Nunca deduce cuándo ocurrió algo a partir del estado actual ni de un updated_at genérico.
 */

export type ActivitySourceId = 'cleanings' | 'incidents' | 'supervision' | 'laundry' | 'inventory';
export type ActivityKind = 'cleaning' | 'incident' | 'supervision' | 'laundry' | 'inventory';
export type ActivityTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export const ACTIVITY_SOURCES: { id: ActivitySourceId; label: string }[] = [
  { id: 'cleanings', label: 'Limpiezas y reportes' },
  { id: 'incidents', label: 'Incidencias' },
  { id: 'supervision', label: 'Supervisión' },
  { id: 'laundry', label: 'Lavandería' },
  { id: 'inventory', label: 'Inventario' },
];

export const sourceLabel = (id: ActivitySourceId) => ACTIVITY_SOURCES.find(source => source.id === id)?.label || id;

/** Contrato de enlace al registro original: rutas internas protegidas, nunca enlaces públicos con token. */
export type ActivityDetail =
  | { kind: 'task'; taskId: string; date: string; label: string }
  | { kind: 'incident'; incidentId: string; label: string }
  | { kind: 'inventory'; productId: string; warehouseId: string; label: string };

/** Parámetros de URL de la pestaña Actividad: se conservan al abrir un detalle y volver. */
export const ACTIVITY_PARAMS = { period: 'actividad_periodo', type: 'actividad_tipo', windows: 'actividad_tramos' } as const;

/** Ruta interna del registro original; null si el usuario no puede abrir esa pantalla. */
export function activityDetailHref(detail: ActivityDetail, can: (module: 'calendar' | 'reports' | 'inventory') => boolean): string | null {
  if (detail.kind === 'task') return can('calendar') ? `/calendar?${new URLSearchParams({ date: detail.date, task: detail.taskId })}` : null;
  if (detail.kind === 'incident') return can('reports') ? `/cleaning-reports?${new URLSearchParams({ incidencia: detail.incidentId })}` : null;
  return can('inventory') ? `/inventory/movements?${new URLSearchParams({ product: detail.productId, warehouse: detail.warehouseId })}` : null;
}

export interface ActivityLine { label: string; value: string }

export interface ActivityEvent {
  /** Identificador estable: fuente + registro + paso. */
  id: string;
  source: ActivitySourceId;
  kind: ActivityKind;
  /** Día civil Madrid en el que se agrupa. */
  day: string;
  /** Hora Madrid HH:MM; null si la fuente solo conoce el día. */
  time: string | null;
  /** 'recorded' = momento registrado; 'planned' = hora prevista del servicio, no un hecho. */
  timeKind: 'recorded' | 'planned' | null;
  /** Instante ISO registrado por la fuente, si existe. */
  at?: string;
  title: string;
  summary?: string;
  actor?: string;
  status?: { label: string; tone: ActivityTone };
  lines: ActivityLine[];
  detail?: ActivityDetail;
  taskId?: string;
}

export interface ActivityWindow { index: number; from: string; to: string }

export const ACTIVITY_WINDOW_DAYS = 30;
export const ACTIVITY_SOURCE_LIMIT = 200;
/** Margen de días de servicio que se consulta para encontrar pasos de lavandería de un tramo. */
export const LAUNDRY_SERVICE_MARGIN_DAYS = 14;

export const ACTIVITY_PERIODS = [
  { value: '30', label: 'Últimos 30 días', days: 30 },
  { value: '90', label: 'Últimos 90 días', days: 90 },
  { value: '365', label: 'Últimos 12 meses', days: 365 },
] as const;

export type ActivityPeriod = typeof ACTIVITY_PERIODS[number]['value'];

export const parsePeriod = (value: string | null): ActivityPeriod => (ACTIVITY_PERIODS.some(period => period.value === value) ? value as ActivityPeriod : '30');
export const parseActivityType = (value: string | null): ActivitySourceId | 'all' => (ACTIVITY_SOURCES.some(source => source.id === value) ? value as ActivitySourceId : 'all');

/** Tramos disjuntos de 30 días desde hoy hacia atrás, recortados al inicio del periodo. */
export function activityWindows(today: string, period: ActivityPeriod): ActivityWindow[] {
  const days = ACTIVITY_PERIODS.find(item => item.value === period)?.days || 30;
  const start = shiftCivilDate(today, -(days - 1));
  const windows: ActivityWindow[] = [];
  for (let index = 0; ; index += 1) {
    const to = shiftCivilDate(today, -index * ACTIVITY_WINDOW_DAYS);
    if (to < start) break;
    const from = shiftCivilDate(to, -(ACTIVITY_WINDOW_DAYS - 1));
    windows.push({ index, from: from < start ? start : from, to });
  }
  return windows;
}

/** Día y hora Madrid de un instante ISO. */
export function madridMoment(iso: string | null | undefined): { day: string; time: string } | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const [day, time] = formatMadridDateTime(date).split('T');
  return { day, time };
}

export const civilLabel = (day: string) => { const [y, m, d] = day.split('-'); return `${d}/${m}/${y}`; };
const momentLabel = (iso: string | null | undefined) => { const moment = madridMoment(iso); return moment ? `${civilLabel(moment.day)} · ${moment.time}` : null; };
const clip = (text: string | null | undefined, max = 140) => {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
};
const names = (values: (string | null | undefined)[]) => [...new Set(values.map(value => (value || '').trim()).filter(Boolean))];

// ---------------------------------------------------------------- Limpiezas y reportes

export interface CleaningRow {
  id: string;
  propiedad_id: string | null;
  date: string;
  start_time: string | null;
  end_time: string | null;
  status: string;
  type: string | null;
  cleaner: string | null;
  task_assignments?: { cleaner_name: string | null }[] | null;
  /** undefined = sin permiso para consultar reportes; [] = la tarea no tiene reporte. */
  task_reports?: { id: string; start_time: string | null; end_time: string | null; overall_status: string; cleaner?: { name: string | null } | null }[] | null;
}

const TASK_STATUS: Record<string, { label: string; tone: ActivityTone }> = {
  pending: { label: 'Pendiente', tone: 'neutral' },
  'in-progress': { label: 'En curso', tone: 'info' },
  completed: { label: 'Completada', tone: 'success' },
};
const REPORT_STATUS: Record<string, string> = {
  pending: 'pendiente', in_progress: 'en curso', completed: 'finalizado', needs_review: 'pendiente de revisión',
};

/**
 * Una limpieza y su reporte describen el mismo servicio: se presentan en una única entrada
 * en el día del servicio. Las horas reales del reporte se muestran como líneas y, si se
 * registró otro día, se indica ese momento de registro.
 */
export function cleaningEvents(rows: CleaningRow[], propertyId: string): ActivityEvent[] {
  return rows.filter(row => row.propiedad_id === propertyId).map(row => {
    const report = [...(row.task_reports || [])].sort((a, b) => (b.end_time || b.start_time || '').localeCompare(a.end_time || a.start_time || ''))[0];
    const reportsVisible = row.task_reports !== undefined;
    const staff = names([...(row.task_assignments || []).map(item => item.cleaner_name), row.cleaner]);
    const lines: ActivityLine[] = [];
    if (row.start_time) lines.push({ label: 'Horario previsto', value: `${row.start_time.slice(0, 5)}${row.end_time ? `–${row.end_time.slice(0, 5)}` : ''}` });
    lines.push({ label: 'Asignación actual', value: staff.length ? staff.join(', ') : 'Sin personal asignado' });
    if (!reportsVisible) lines.push({ label: 'Reporte', value: 'Sin permiso para consultar reportes' });
    else if (!report) lines.push({ label: 'Reporte', value: row.status === 'completed' ? 'Completada sin reporte: no consta la hora de finalización' : 'Sin reporte' });
    else {
      const started = madridMoment(report.start_time);
      const ended = madridMoment(report.end_time);
      lines.push({ label: 'Reporte', value: REPORT_STATUS[report.overall_status] || report.overall_status });
      if (started) lines.push({ label: 'Inicio registrado', value: started.day === row.date ? started.time : momentLabel(report.start_time) || '' });
      if (ended) lines.push({ label: ended.day === row.date ? 'Finalización registrada' : 'Finalización registrada otro día', value: ended.day === row.date ? ended.time : momentLabel(report.end_time) || '' });
    }
    return {
      id: `cleaning:${row.id}`,
      source: 'cleanings',
      kind: 'cleaning',
      day: row.date,
      time: row.start_time ? row.start_time.slice(0, 5) : null,
      timeKind: row.start_time ? 'planned' : null,
      title: row.type ? `Limpieza · ${row.type}` : 'Limpieza',
      actor: report?.cleaner?.name ? `Reporte de ${report.cleaner.name}` : undefined,
      status: TASK_STATUS[row.status] || { label: row.status, tone: 'neutral' },
      lines,
      detail: { kind: 'task', taskId: row.id, date: row.date, label: 'Abrir limpieza' },
      taskId: row.id,
    } satisfies ActivityEvent;
  });
}

// ---------------------------------------------------------------- Incidencias

export interface IncidentRow {
  id: string;
  property_id: string | null;
  task_id: string | null;
  created_at: string;
  status: string;
  description: string | null;
  category?: { label: string | null } | null;
  cleaner?: { name: string | null } | null;
}

export interface IncidentEventRow {
  id: string;
  incident_id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  actor_name: string | null;
  created_at: string;
  incident?: { property_id: string | null; description: string | null; category?: { label: string | null } | null } | null;
}

const INCIDENT_STATUS: Record<string, { label: string; tone: ActivityTone }> = {
  pending_limpatex: { label: 'Pendiente Limpatex', tone: 'warning' },
  discarded_limpatex: { label: 'Descartada (interna)', tone: 'neutral' },
  open: { label: 'Abierta', tone: 'danger' },
  in_progress: { label: 'En curso', tone: 'info' },
  resolved: { label: 'Resuelta', tone: 'success' },
  discarded: { label: 'Descartada (cliente)', tone: 'neutral' },
};
const incidentStatusLabel = (status: string | null) => (status ? INCIDENT_STATUS[status]?.label || status : '—');
/** Pasos de estado que cambian el significado de la incidencia; comentarios y adjuntos quedan en su ficha. */
const INCIDENT_STEPS: Record<string, string> = {
  approved: 'Incidencia aprobada',
  discarded_limpatex: 'Incidencia descartada por Limpatex',
  status_change: 'Cambio de estado de incidencia',
  client_in_progress: 'El cliente la marca en curso',
  client_resolved: 'El cliente la marca resuelta',
  client_discarded: 'El cliente la descarta',
  deleted: 'Incidencia eliminada',
};

export function incidentEvents(incidents: IncidentRow[], steps: IncidentEventRow[], propertyId: string): ActivityEvent[] {
  const created = incidents.filter(row => row.property_id === propertyId).flatMap(row => {
    const moment = madridMoment(row.created_at);
    if (!moment) return [];
    return [{
      id: `incident:${row.id}:created`, source: 'incidents', kind: 'incident', day: moment.day, time: moment.time, timeKind: 'recorded', at: row.created_at,
      title: `Incidencia registrada${row.category?.label ? ` · ${row.category.label}` : ''}`,
      summary: clip(row.description) || undefined,
      actor: row.cleaner?.name || undefined,
      status: { label: `Estado actual: ${incidentStatusLabel(row.status)}`, tone: INCIDENT_STATUS[row.status]?.tone || 'neutral' },
      lines: [],
      detail: { kind: 'incident', incidentId: row.id, label: 'Abrir incidencia' },
      taskId: row.task_id || undefined,
    } satisfies ActivityEvent];
  });
  const changes = steps.filter(step => step.incident?.property_id === propertyId && INCIDENT_STEPS[step.event_type]).flatMap(step => {
    const moment = madridMoment(step.created_at);
    if (!moment) return [];
    const transition = step.from_status || step.to_status ? `${incidentStatusLabel(step.from_status)} → ${incidentStatusLabel(step.to_status)}` : null;
    return [{
      id: `incident:${step.incident_id}:event:${step.id}`, source: 'incidents', kind: 'incident', day: moment.day, time: moment.time, timeKind: 'recorded', at: step.created_at,
      title: INCIDENT_STEPS[step.event_type],
      summary: clip(step.incident?.description, 90) || undefined,
      actor: step.actor_name || undefined,
      status: step.to_status ? { label: incidentStatusLabel(step.to_status), tone: INCIDENT_STATUS[step.to_status]?.tone || 'neutral' } : undefined,
      lines: transition ? [{ label: 'Estado', value: transition }] : [],
      detail: { kind: 'incident', incidentId: step.incident_id, label: 'Abrir incidencia' },
    } satisfies ActivityEvent];
  });
  return [...created, ...changes];
}

// ---------------------------------------------------------------- Supervisión

export interface SupervisionRow {
  id: string;
  property_id: string | null;
  task_id: string | null;
  review_type: string;
  state: string;
  result: string;
  rework_reason: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  route?: { route_date: string | null } | null;
}

const SUPERVISION_STATE: Record<string, { label: string; tone: ActivityTone }> = {
  reviewed: { label: 'Revisada', tone: 'success' },
  with_incidents: { label: 'Con incidencias', tone: 'warning' },
  returned_for_rework: { label: 'Devuelta para repaso', tone: 'danger' },
  historical: { label: 'Registro histórico', tone: 'neutral' },
};

/** Se sitúa en completed_at; si falta, en created_at, que es el momento en que se registró. */
export function supervisionEvents(rows: SupervisionRow[], propertyId: string): ActivityEvent[] {
  return rows.filter(row => row.property_id === propertyId).flatMap(row => {
    const when = row.completed_at || row.created_at;
    const moment = madridMoment(when);
    if (!moment) return [];
    const lines: ActivityLine[] = [{ label: 'Resultado', value: row.result === 'incorrect' ? 'Incorrecto' : 'Correcto' }];
    if (row.route?.route_date && row.route.route_date !== moment.day) lines.push({ label: 'Ruta del día', value: civilLabel(row.route.route_date) });
    if (!row.completed_at) lines.push({ label: 'Momento', value: 'Hora de registro (sin hora de finalización)' });
    if (row.rework_reason) lines.push({ label: 'Motivo del repaso', value: clip(row.rework_reason, 120) });
    return [{
      id: `supervision:${row.id}`, source: 'supervision', kind: 'supervision', day: moment.day, time: moment.time, timeKind: 'recorded', at: when,
      title: row.review_type === 'full' ? 'Supervisión completa' : 'Supervisión rápida',
      status: SUPERVISION_STATE[row.state] || { label: row.state, tone: 'neutral' },
      lines,
      detail: row.task_id ? { kind: 'task', taskId: row.task_id, date: row.route?.route_date || moment.day, label: 'Abrir limpieza supervisada' } : undefined,
      taskId: row.task_id || undefined,
    } satisfies ActivityEvent];
  });
}

// ---------------------------------------------------------------- Lavandería

interface LaundryTask { id: string; date: string; propiedad_id: string | null }

export interface BagPreparationRow {
  task_id: string;
  status: string;
  prepared_at: string | null;
  prepared_by_name: string | null;
  issue_at: string | null;
  issue_by_name: string | null;
  issue_reason: string | null;
  undone_at: string | null;
  undone_by_name: string | null;
  undone_reason: string | null;
  cancelled_at: string | null;
  cancelled_by_name: string | null;
  task?: LaundryTask | null;
}

export interface DeliveryTrackingRow {
  id: string;
  task_id: string;
  prepared_at: string | null;
  prepared_by_name: string | null;
  delivered_at: string | null;
  delivered_by_name: string | null;
  collected_at: string | null;
  collected_by_name: string | null;
  task?: LaundryTask | null;
}

const BAG_STATUS: Record<string, string> = { pending: 'Pendiente', prepared: 'Preparada', issue: 'Con incidencia' };

/**
 * Estas tablas guardan el último momento de cada paso, no todo su historial: un paso repetido
 * conserva solo su última hora. Las anulaciones y "deshacer" se muestran como tales.
 */
export function laundryEvents(bags: BagPreparationRow[], tracking: DeliveryTrackingRow[], propertyId: string): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  const push = (id: string, iso: string | null, title: string, task: LaundryTask, extra: Partial<ActivityEvent> = {}) => {
    const moment = madridMoment(iso);
    if (!moment) return;
    const lines = [...(extra.lines || [])];
    if (task.date !== moment.day) lines.unshift({ label: 'Limpieza del', value: civilLabel(task.date) });
    events.push({ id, source: 'laundry', kind: 'laundry', day: moment.day, time: moment.time, timeKind: 'recorded', at: iso as string, title, ...extra, lines,
      detail: { kind: 'task', taskId: task.id, date: task.date, label: 'Abrir limpieza asociada' }, taskId: task.id });
  };
  for (const bag of bags) {
    const task = bag.task;
    if (!task || task.propiedad_id !== propertyId) continue;
    const current = { label: `Estado actual: ${BAG_STATUS[bag.status] || bag.status}`, tone: 'neutral' as ActivityTone };
    push(`laundry:bag:${task.id}:prepared`, bag.prepared_at, 'Bolsa de lavandería preparada', task, { actor: bag.prepared_by_name || undefined, status: current });
    push(`laundry:bag:${task.id}:issue`, bag.issue_at, 'Incidencia al preparar la bolsa', task, { actor: bag.issue_by_name || undefined, summary: clip(bag.issue_reason) || undefined, status: { label: 'Incidencia', tone: 'warning' } });
    push(`laundry:bag:${task.id}:undone`, bag.undone_at, 'Preparación deshecha', task, { actor: bag.undone_by_name || undefined, summary: clip(bag.undone_reason) || undefined, status: { label: 'Corrección', tone: 'warning' } });
    push(`laundry:bag:${task.id}:cancelled`, bag.cancelled_at, 'Preparación anulada', task, { actor: bag.cancelled_by_name || undefined, status: { label: 'Anulada', tone: 'neutral' } });
  }
  for (const row of tracking) {
    const task = row.task;
    if (!task || task.propiedad_id !== propertyId) continue;
    push(`laundry:tracking:${row.id}:prepared`, row.prepared_at, 'Lavandería preparada (reparto)', task, { actor: row.prepared_by_name || undefined });
    push(`laundry:tracking:${row.id}:delivered`, row.delivered_at, 'Lavandería entregada', task, { actor: row.delivered_by_name || undefined });
    push(`laundry:tracking:${row.id}:collected`, row.collected_at, 'Ropa sucia recogida', task, { actor: row.collected_by_name || undefined });
  }
  return events;
}

// ---------------------------------------------------------------- Inventario

export interface StockMovementRow {
  id: string;
  property_id: string | null;
  task_id: string | null;
  movement_type: string;
  quantity: number;
  reason: string | null;
  created_at: string;
  product_id: string;
  warehouse_id: string;
  product?: { name: string | null; unit_of_measure: string | null } | null;
  warehouse?: { name: string | null } | null;
}

const MOVEMENT_TYPE: Record<string, string> = {
  entrada: 'Entrada', salida: 'Salida', ajuste: 'Ajuste', consumo_automatico: 'Consumo automático', transferencia: 'Transferencia',
};

/** Solo movimientos con property_id de esta propiedad: los globales del almacén no se atribuyen. */
export function inventoryEvents(rows: StockMovementRow[], propertyId: string): ActivityEvent[] {
  return rows.filter(row => row.property_id === propertyId).flatMap(row => {
    const moment = madridMoment(row.created_at);
    if (!moment) return [];
    const unit = row.product?.unit_of_measure ? ` ${row.product.unit_of_measure}` : '';
    const lines: ActivityLine[] = [{ label: 'Cantidad', value: `${row.quantity}${unit}` }];
    if (row.warehouse?.name) lines.push({ label: 'Ubicación', value: row.warehouse.name });
    return [{
      id: `inventory:${row.id}`, source: 'inventory', kind: 'inventory', day: moment.day, time: moment.time, timeKind: 'recorded', at: row.created_at,
      title: `${MOVEMENT_TYPE[row.movement_type] || row.movement_type} · ${row.product?.name || 'Producto'}`,
      summary: clip(row.reason) || undefined,
      lines,
      detail: { kind: 'inventory', productId: row.product_id, warehouseId: row.warehouse_id, label: 'Abrir en el historial de inventario' },
      taskId: row.task_id || undefined,
    } satisfies ActivityEvent];
  });
}

// ---------------------------------------------------------------- Combinación

const PREPARED_DUPLICATE_MS = 2 * 60 * 1000;

/**
 * La preparación de una bolsa puede quedar registrada a la vez en la ruta nueva y en el reparto
 * clásico. Si coinciden tarea y minuto (±2 min), se muestra una sola entrada que lo explica.
 */
export function mergeDuplicateLaundry(events: ActivityEvent[]): ActivityEvent[] {
  const bagPrepared = events.filter(event => event.id.startsWith('laundry:bag:') && event.id.endsWith(':prepared'));
  const hidden = new Set<string>();
  const notes = new Map<string, string>();
  for (const event of events) {
    if (!event.id.startsWith('laundry:tracking:') || !event.id.endsWith(':prepared')) continue;
    const at = Date.parse(event.at || '');
    const twin = bagPrepared.find(bag => bag.taskId === event.taskId && Math.abs(Date.parse(bag.at || '') - at) <= PREPARED_DUPLICATE_MS);
    if (!twin) continue;
    hidden.add(event.id);
    notes.set(twin.id, 'También consta en el reparto clásico');
  }
  return events.filter(event => !hidden.has(event.id)).map(event => notes.has(event.id) ? { ...event, lines: [...event.lines, { label: 'Registro', value: notes.get(event.id) as string }] } : event);
}

const KIND_ORDER: Record<ActivityKind, number> = { incident: 0, supervision: 1, cleaning: 2, laundry: 3, inventory: 4 };

/** Recientes primero; empates por hora, tipo e id para que el orden no dependa de la carga. */
export function sortActivity(events: ActivityEvent[]): ActivityEvent[] {
  return [...events].sort((a, b) => b.day.localeCompare(a.day)
    || (b.time || '').localeCompare(a.time || '')
    || (Date.parse(b.at || '') || 0) - (Date.parse(a.at || '') || 0)
    || KIND_ORDER[a.kind] - KIND_ORDER[b.kind]
    || a.id.localeCompare(b.id));
}

export function groupByDay(events: ActivityEvent[]): { day: string; events: ActivityEvent[] }[] {
  const groups: { day: string; events: ActivityEvent[] }[] = [];
  for (const event of sortActivity(events)) {
    const last = groups[groups.length - 1];
    if (last?.day === event.day) last.events.push(event);
    else groups.push({ day: event.day, events: [event] });
  }
  return groups;
}

/** Recorta a un tramo y elimina repeticiones por id (un registro solo aparece una vez). */
export function withinWindow(events: ActivityEvent[], window: Pick<ActivityWindow, 'from' | 'to'>): ActivityEvent[] {
  const seen = new Set<string>();
  return events.filter(event => {
    if (event.day < window.from || event.day > window.to || seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  });
}
