import { addCivilDays, addCivilMonths, monthEnd } from './monthly';
import { dates, dateLabel, monthLabel, monday, validDate, weekday, type ForecastContext, type ForecastDataset, type ForecastIssue, type ForecastModel, type ForecastTask, type ForecastWorker } from './forecastContract';

export type ViewScope = { from: string; to: string; label: string; mode: string };
export const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const tiers = ['Titular', 'Suplentes', 'Backup', 'Otros edificios'];
export const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export const personName = (value: string) => value === value.toUpperCase() ? value.toLocaleLowerCase('es').replace(/(^|[\s-])\p{L}/gu, letter => letter.toLocaleUpperCase('es')) : value;
export const countLabel = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const sumKnown = <T,>(rows: T[], value: (row: T) => number) => rows.reduce((n, row) => n + (Number.isFinite(value(row)) ? value(row) : 0), 0);
export const sumComplete = <T,>(rows: T[], value: (row: T) => number) => rows.some(row => !Number.isFinite(value(row))) ? NaN : sumKnown(rows, value);
export const duration = (minutes: number) => !(minutes > 0) || !Number.isFinite(minutes) ? 'Por verificar' : `${Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)} h` : ''}${minutes % 60 ? ` ${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(minutes % 60)} min` : ''}`.trim();
export const fullDate = (date: string) => validDate(date) ? new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${date}T12:00:00Z`)) : 'Fecha por verificar';
export const within = (date: string, scope: Pick<ViewScope, 'from' | 'to'>) => date >= scope.from && date <= scope.to;
export const horizonScope = (context: ForecastContext): ViewScope => ({ from: `${context.month}-01`, to: monthEnd(addCivilMonths(`${context.month}-01`, context.horizon - 1)), mode: 'horizon', label: context.horizon === 1 ? monthLabel(context.month) : `${monthLabel(context.month)} – ${monthLabel(addCivilMonths(`${context.month}-01`, context.horizon - 1).slice(0, 7))}` });
export const weekScope = (week: string): ViewScope => ({ from: week, to: addCivilDays(week, 6), mode: 'week', label: `${fullDate(week)} – ${fullDate(addCivilDays(week, 6))}` });
export function focusMonth(context: ForecastContext, params: URLSearchParams) {
  const explicit = params.get('focusMonth');
  if (explicit && validDate(`${explicit}-01`)) return explicit;
  const date = params.get('date');
  if (date && validDate(date)) return date.slice(0, 7);
  if (params.get('view') === 'week' || params.get('detail') === 'candidates') return (context.week < `${context.month}-01` ? `${context.month}-01` : context.week).slice(0, 7);
  return context.month;
}
export function viewScope(context: ForecastContext, params: URLSearchParams, fallback = 'month'): ViewScope {
  const mode = params.get('view') || fallback;
  if (mode === 'week') return weekScope(context.week);
  if (mode === 'horizon') return horizonScope(context);
  if (mode === 'day') {
    const value = params.get('date') ?? context.week;
    const date = validDate(value) ? value : context.week;
    return { from: date, to: date, mode, label: fullDate(date) };
  }
  const month = focusMonth(context, params);
  return { from: `${month}-01`, to: monthEnd(`${month}-01`), mode: 'month', label: monthLabel(month) };
}
export const scopeQuery = (scope: ViewScope) => ({ view: scope.mode, date: scope.mode === 'day' ? scope.from : '', week: monday(scope.from), focusMonth: scope.from.slice(0, 7) });
export function closeForecastDetail(params: URLSearchParams) {
  const next = new URLSearchParams(params);
  const person = next.get('returnPerson'), center = next.get('returnCenter');
  ['task', 'person', 'detail', 'personTab', 'returnPerson', 'returnCenter'].forEach(key => next.delete(key));
  if (person) { next.set('person', person); next.set('personTab', 'tasks'); }
  else if (center) next.set('detail', center);
  else ['personTaskQuery', 'personTaskDate', 'personTaskKind'].forEach(key => next.delete(key));
  return next;
}
export function issueInScope(issue: ForecastIssue, model: ForecastModel, scope: ViewScope) {
  if (issue.centerId && model.context.center && issue.centerId !== model.context.center) return false;
  if (issue.date) return within(issue.date, scope);
  const tasks = model.tasks.filter(t => issue.ids.includes(t.id));
  return !tasks.length || tasks.some(t => within(t.date, scope));
}
export function taskConflicts(task: ForecastTask, model: ForecastModel): string[] {
  const messages = new Set<string>();
  if (!(task.minutes > 0)) messages.add('Falta la duración de la propiedad.');
  if (!(task.windowEnd > task.windowStart)) messages.add('Falta una ventana de cliente válida.');
  if (task.ambiguous) messages.add('La asignación tiene registros contradictorios.');
  if (Number.isFinite(task.start) && Number.isFinite(task.end)) {
    if (task.start < task.windowStart || task.end > task.windowEnd) messages.add('El horario registrado queda fuera de la ventana del cliente.');
    if (task.end <= task.start || Math.abs(task.end - task.start - task.minutes) > .01) messages.add('El horario registrado no corresponde a la duración completa.');
  } else if (task.workerId) messages.add('La asignación no tiene un horario verificable.');
  model.issues.filter(i => i.ids.includes(task.id) && i.impact !== 'information').forEach(i => messages.add(i.message));
  return [...messages];
}
export const taskNeedsReview = (task: ForecastTask, model: ForecastModel) => taskConflicts(task, model).length > 0 || !model.placements.some(p => p.taskId === task.id);
export function scopedTasks(model: ForecastModel, scope: ViewScope, filter = '') {
  return model.tasks.filter(t => within(t.date, scope) && (filter !== 'pending' || !t.workerId) && (filter !== 'uncovered' || taskNeedsReview(t, model))).sort((a, b) => a.date.localeCompare(b.date) || (Number.isFinite(a.start) ? a.start : a.windowStart) - (Number.isFinite(b.start) ? b.start : b.windowStart) || a.name.localeCompare(b.name));
}
export function coverageLabel(model: ForecastModel, scope: ViewScope) {
  if (model.issues.some(i => i.impact !== 'information' && issueInScope(i, model, scope))) return 'Pendiente de verificar';
  const tasks = scopedTasks(model, scope);
  if (!tasks.length) return 'Sin tareas registradas';
  if (tasks.some(t => taskNeedsReview(t, model))) return 'Tareas por resolver';
  return tasks.some(t => !t.workerId || model.placements.some(p => p.taskId === t.id && !p.real)) ? 'Encaje propuesto · sin guardar' : 'Asignaciones verificadas';
}
export const ledgerLabel = (status: string) => ({ 'No verificable': 'Por verificar', 'Faltan horas': 'Horas pendientes', 'Cumple': 'Objetivo alcanzable con asignaciones' }[status] ?? status);
export function teamSummary(model: ForecastModel, month: string) {
  const rows = model.ledgers.filter(l => l.month === month && model.visibleWorkerIds.includes(l.workerId) && l.status !== 'Excluido');
  return { rows, risk: rows.filter(l => l.status === 'Faltan horas'), unknown: rows.filter(l => l.status === 'No verificable'), excluded: model.ledgers.filter(l => l.month === month && model.visibleWorkerIds.includes(l.workerId) && l.status === 'Excluido').length };
}
export const centerLabel = (center: ForecastDataset['centers'][number]) => !center.name.trim() || /no identificad|sin nombre/i.test(center.name) ? `Nombre pendiente de revisar · ${center.id.replace(/^[^:]+:/, '').slice(0, 8)}` : center.name;
export const centerKind = (id: string) => id.startsWith('unmapped:') ? 'Propiedad por identificar' : id.startsWith('property:') ? 'Propiedad independiente' : 'Edificio';
export const calendarTaskHref = (task: ForecastTask) => `/calendar?${new URLSearchParams({ date: task.date, task: task.id })}`;
export const sourceLabel = (source: string) => ({ cleaners: 'Personas', tasks: 'Tareas', task_assignments: 'Asignaciones', worker_absences: 'Ausencias y otros servicios', worker_fixed_days_off: 'Libranzas', worker_maintenance_cleanings: 'Mantenimientos', properties: 'Propiedades', property_groups: 'Edificios', property_group_assignments: 'Relación de propiedades y edificios', staffingRulesForSede: 'Reglas de sede' }[source] ?? 'Datos de la previsión');
const issueTitles: Record<string, string> = {
  'missing-duration': 'Faltan duraciones de propiedades', 'unknown-contract': 'Revisar jornadas', 'invalid-rest': 'Revisar libranzas', 'invalid-maintenance': 'Revisar horarios de mantenimiento',
  'unmapped-task': 'Identificar propiedades', 'ambiguous-center': 'Revisar edificio de propiedades', 'missing-window': 'Faltan ventanas de cliente', 'assignment-conflict': 'Revisar responsables de tareas',
  'actual-conflict': 'Hay asignaciones incompatibles', 'actual-assignment-unverified': 'Revisar horario y duración de asignaciones', 'paid-work-overlap': 'Revisar servicios coincidentes',
  'absence-adjustment-unverified': 'Revisar ajustes de ausencias y servicios', 'invalid-absence': 'Revisar fechas de ausencias', 'invalid-window': 'Revisar ventanas y duraciones', 'rest-unresolved': 'Revisar descanso semanal',
  'source-unavailable': 'No se pudieron leer algunos datos', 'policy-unverified': 'Verificar reglas de la sede', 'invalid-active-date': 'Revisar fecha de alta',
};
export function groupIssues(issues: ForecastIssue[]) {
  const groups = new Map<string, { code: string; title: string; issues: ForecastIssue[]; impact: string }>();
  for (const issue of issues) {
    const group = groups.get(issue.code) ?? { code: issue.code, title: issueTitles[issue.code] ?? `Revisar ${sourceLabel(issue.source).toLowerCase()}`, issues: [], impact: { demand: 'Impide verificar la carga de trabajo.', capacity: 'Impide confirmar disponibilidad o cobertura.', ledger: 'Impide cerrar el balance de horas.', information: 'Dato informativo para revisión.' }[issue.impact] };
    if (!group.issues.some(i => JSON.stringify(i) === JSON.stringify(issue))) group.issues.push(issue);
    groups.set(issue.code, group);
  }
  return [...groups.values()].sort((a, b) => b.issues.filter(i => i.impact !== 'information').length - a.issues.filter(i => i.impact !== 'information').length);
}
export function affectedRecords(dataset: ForecastDataset, issues: ForecastIssue[]) {
  const ids = new Set(issues.flatMap(i => [...i.ids, i.workerId, i.centerId].filter(Boolean)));
  const properties = (dataset.properties ?? []).filter(p => ids.has(p.id));
  const tasks = dataset.tasks.filter(t => ids.has(t.id) || properties.some(p => p.id === t.propertyId));
  const workers = dataset.workers.filter(w => ids.has(w.id) || tasks.some(t => t.workerId === w.id));
  const centers = dataset.centers.filter(c => ids.has(c.id) || properties.some(p => p.centerId === c.id) || tasks.some(t => t.centerId === c.id));
  return { workers, tasks, centers, properties };
}
export function workerWeek(dataset: ForecastDataset, model: ForecastModel, worker: ForecastWorker, week: string) {
  const rows = dates(week, addCivilDays(week, 6));
  const intervals: { start: number; end: number }[] = [];
  let committed = 0;
  let unknown = !worker.contractKnown || model.issues.some(i => i.impact !== 'information' && (!i.ids.length || i.ids.includes(worker.id) || i.workerId === worker.id) && (!i.date || rows.includes(i.date)));
  for (const date of rows) {
    intervals.length = 0;
    for (const task of dataset.tasks.filter(t => t.workerId === worker.id && t.date === date)) {
      if (task.ambiguous || !Number.isFinite(task.start) || !Number.isFinite(task.end) || task.end <= task.start) unknown = true;
      else intervals.push({ start: task.start, end: task.end });
    }
    const active = (!worker.activeFrom || date >= worker.activeFrom) && (!worker.activeTo || date <= worker.activeTo);
    for (const slot of worker.blockedSlots ?? []) if (active && slot.consumesContract && (slot.date ? slot.date === date : slot.day === weekday(date))) {
      if (!Number.isFinite(slot.startMinute) || !Number.isFinite(slot.endMinute) || slot.endMinute <= slot.startMinute) unknown = true;
      else intervals.push({ start: slot.startMinute, end: slot.endMinute });
    }
    for (const absence of dataset.absences) if (active && absence.workerId === worker.id && absence.type === 'external_work' && date >= absence.from && date <= absence.to) {
      if (!Number.isFinite(absence.start) || !Number.isFinite(absence.end) || absence.end <= absence.start) unknown = true;
      else intervals.push({ start: absence.start, end: absence.end });
    }
    let end = -Infinity;
    for (const slot of intervals.sort((a, b) => a.start - b.start)) { committed += Math.max(0, slot.end - Math.max(slot.start, end)); end = Math.max(end, slot.end); }
  }
  return { committed, maximum: worker.weeklyMinutes * 1.3, margin: unknown ? NaN : Math.max(0, worker.weeklyMinutes * 1.3 - committed), unknown };
}
export const absenceName = (value: string) => ({ vacation: 'Vacaciones', sick: 'Baja', sick_leave: 'Baja', holiday: 'Festivo', personal: 'Ausencia personal', day_off: 'Libranza', external_work: 'Otros servicios' }[value] ?? 'Tipo por revisar');
