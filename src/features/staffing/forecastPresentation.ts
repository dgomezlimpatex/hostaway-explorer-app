import { addCivilDays, addCivilMonths, monthEnd } from './monthly';
import { issueDuring } from './forecastIssues';
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
export const shortDay = (date: string) => new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00Z`));
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
  if (mode === 'simulation' && context.reinforcementFrom && context.reinforcementTo) return { from: context.reinforcementFrom, to: context.reinforcementTo, mode, label: `${fullDate(context.reinforcementFrom)} – ${fullDate(context.reinforcementTo)}` };
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
  if (!issueDuring(issue, scope.from, scope.to)) return false;
  if (issue.centerId && model.context.center && issue.centerId !== model.context.center) return false;
  const tasks = model.tasks.filter(t => issue.ids.includes(t.id));
  const people = model.workers.filter(w => issue.workerId === w.id || issue.ids.includes(w.id));
  if (model.context.center && !issue.centerId && people.length && !people.some(w => model.visibleWorkerIds.includes(w.id))) return false;
  return !tasks.length || tasks.some(t => within(t.date, scope));
}
export const scopedIssues = (model: ForecastModel, scope: ViewScope) => model.issues.filter(i => issueInScope(i, model, scope));
export function taskAssessment(task: ForecastTask, model: ForecastModel) {
  const dataIssues = new Set<string>(), records = new Set<string>();
  if (!(task.minutes > 0) || !Number.isFinite(task.minutes)) dataIssues.add('Falta la duración de la propiedad.');
  if (!Number.isFinite(task.windowStart) || !Number.isFinite(task.windowEnd) || !(task.windowEnd > task.windowStart)) dataIssues.add('Falta una ventana de cliente válida.');
  if (task.ambiguous) { dataIssues.add('La asignación tiene registros contradictorios.'); records.add('La asignación tiene registros contradictorios.'); }
  if (Number.isFinite(task.start) && Number.isFinite(task.end)) {
    if (task.start < task.windowStart || task.end > task.windowEnd) records.add('El horario registrado queda fuera de la ventana del cliente.');
    if (task.end <= task.start || Number.isFinite(task.minutes) && Math.abs(task.end - task.start - task.minutes) > .01) records.add('El horario registrado no corresponde a la duración completa.');
  } else if (task.workerId) dataIssues.add('La asignación no tiene un horario verificable.');
  for (const issue of model.issues.filter(i => i.impact !== 'information' && (i.ids.includes(task.id) || !i.ids.length && issueDuring(i, task.date)))) {
    if (['actual-conflict', 'assignment-conflict', 'duplicate-task'].includes(issue.code)) records.add(issue.message);
    else if (issue.code !== 'invalid-window' || !(task.minutes > 0) || !(task.windowEnd > task.windowStart)) dataIssues.add(issue.message);
  }
  const proposal = model.placements.find(p => p.taskId === task.id && !p.real);
  const unresolved = model.uncoveredTaskIds ? model.uncoveredTaskIds.includes(task.id) : !model.placements.some(p => p.taskId === task.id);
  return { unassigned: !task.workerId, dataIssues: [...dataIssues], records: [...records], proposal,
    noFit: unresolved && !dataIssues.size && task.date >= model.context.asOf.slice(0, 10), unresolved };
}
export const taskConflicts = (task: ForecastTask, model: ForecastModel) => { const a = taskAssessment(task, model); return [...new Set([...a.dataIssues, ...a.records])]; };
export const taskNeedsReview = (task: ForecastTask, model: ForecastModel) => { const a = taskAssessment(task, model); return a.dataIssues.length > 0 || a.records.length > 0 || a.unresolved; };
export function taskStateLabels(task: ForecastTask, model: ForecastModel) {
  const a = taskAssessment(task, model);
  return [a.unassigned && 'Sin asignar', a.records.length && 'Registro por corregir', a.dataIssues.length && 'Datos insuficientes', a.proposal && 'Propuesta disponible · sin guardar', a.noFit && 'Sin propuesta viable'].filter(Boolean) as string[];
}
export function scopedTasks(model: ForecastModel, scope: ViewScope, filter = '') {
  return model.tasks.filter(t => {
    if (!within(t.date, scope)) return false;
    if (!filter) return true;
    if (filter === 'pending') return !t.workerId;
    if (filter === 'unknown-duration') return !(t.minutes > 0) || !Number.isFinite(t.minutes);
    const a = taskAssessment(t, model);
    return filter === 'uncovered' ? a.records.length > 0 || a.dataIssues.length > 0 || a.unresolved : filter === 'record-with-fit' ? a.records.length > 0 && !a.unresolved && !a.dataIssues.length : filter === 'record-conflicts' ? a.records.length > 0 : filter === 'no-fit' ? a.noFit : filter === 'proposed' ? !!a.proposal : filter === 'insufficient' ? a.dataIssues.length > 0 : true;
  }).sort((a, b) => a.date.localeCompare(b.date) || (Number.isFinite(a.start) ? a.start : a.windowStart) - (Number.isFinite(b.start) ? b.start : b.windowStart) || a.name.localeCompare(b.name));
}
export function coverageLabel(model: ForecastModel, scope: ViewScope, filter = '') {
  const tasks = scopedTasks(model, scope, filter);
  if (!tasks.length) return filter ? 'Sin coincidencias' : 'Sin tareas registradas';
  const assessments = tasks.map(t => taskAssessment(t, model));
  const labels = [assessments.some(a => a.dataIssues.length) && 'Datos de tareas incompletos', assessments.some(a => a.records.length) && 'Registro por corregir', assessments.some(a => a.noFit) && 'Sin propuesta viable', assessments.some(a => a.proposal) && 'Propuesta disponible · sin guardar'];
  return labels.filter(Boolean).join(' · ') || (assessments.some(a => a.unassigned) ? 'Sin asignar' : 'Asignaciones verificadas');
}
export function demandSummary(tasks: ForecastTask[]) {
  const tourism = tasks.filter(t => t.tourism);
  const unknown = tourism.filter(t => !(t.minutes > 0) || !Number.isFinite(t.minutes));
  const known = sumKnown(tourism.filter(t => t.minutes > 0), t => t.minutes);
  return { known, unknown, total: unknown.length ? NaN : known, reserve: known * .2 };
}
export function attentionDays(model: ForecastModel, scope: ViewScope) {
  const today = model.context.asOf.slice(0, 10);
  const rows = model.days.filter(d => within(d.date, scope)).flatMap(day => {
    const local = { ...scope, from: day.date, to: day.date };
    const tasks = scopedTasks(model, local);
    const values = tasks.map(t => taskAssessment(t, model));
    const pending = values.filter(a => a.unassigned).length, conflicts = values.filter(a => a.records.length).length, incomplete = values.filter(a => a.dataIssues.length).length;
    const noFit = values.filter(a => a.noFit).length, proposed = values.filter(a => a.proposal).length;
    const reasons = [pending && `${countLabel(pending, 'tarea')} sin asignar`, conflicts && `${countLabel(conflicts, 'registro')} por corregir`, incomplete && `${countLabel(incomplete, 'tarea')} con datos insuficientes`, noFit && `${countLabel(noFit, 'tarea')} sin propuesta viable`, proposed && `${countLabel(proposed, 'tarea')} con propuesta disponible`].filter(Boolean) as string[];
    return reasons.length ? [{ ...day, reasons, priority: pending + conflicts + incomplete }] : [];
  });
  return {
    upcoming: rows.filter(d => d.date >= today).sort((a, b) => a.date.localeCompare(b.date) || b.priority - a.priority),
    past: rows.filter(d => d.date < today).sort((a, b) => b.date.localeCompare(a.date)),
  };
}
export function simulationChanges(base: ForecastModel, simulated: ForecastModel, scope: ViewScope) {
  const tasks = scopedTasks(simulated, scope);
  const before = new Set(scopedTasks(base, scope, 'no-fit').map(t => t.id)), after = new Set(scopedTasks(simulated, scope, 'no-fit').map(t => t.id));
  const improved = tasks.filter(t => before.has(t.id) && !after.has(t.id));
  const lost = tasks.filter(t => !before.has(t.id) && after.has(t.id));
  const reinforcement = improved.filter(t => simulated.placements.some(p => !p.real && p.taskId === t.id && p.workerId === 'hypothetical'));
  return { improved, lost, reinforcement, team: improved.filter(t => !reinforcement.includes(t)), remaining: tasks.filter(t => after.has(t.id)), before: tasks.filter(t => before.has(t.id)), conflicts: tasks.filter(t => taskAssessment(t, simulated).records.length), incomplete: tasks.filter(t => taskAssessment(t, simulated).dataIssues.length), recordsWithFit: tasks.filter(t => { const a = taskAssessment(t, simulated); return a.records.length && !a.unresolved && !a.dataIssues.length; }) };
}
export const ledgerLabel = (status: string) => ({ 'No verificable': 'Por verificar', 'Faltan horas': 'Horas pendientes', 'Cumple': 'Objetivo alcanzable con asignaciones' }[status] ?? status);
export function teamSummary(model: ForecastModel, month: string) {
  const rows = model.ledgers.filter(l => l.month === month && model.visibleWorkerIds.includes(l.workerId) && l.status !== 'Excluido');
  return { rows, risk: rows.filter(l => l.status === 'Faltan horas'), unknown: rows.filter(l => l.status === 'No verificable'), excluded: model.ledgers.filter(l => l.month === month && model.visibleWorkerIds.includes(l.workerId) && l.status === 'Excluido').length };
}
export const centerLabel = (center: ForecastDataset['centers'][number]) => !center.name.trim() || /no identificad|sin nombre/i.test(center.name) ? `Nombre pendiente de revisar · ${center.id.replace(/^[^:]+:/, '').slice(0, 8)}` : center.name;
export const centerKind = (id: string) => id.startsWith('unmapped:') ? 'Propiedad por identificar' : id.startsWith('property:') ? 'Propiedad independiente' : 'Edificio';
export const calendarTaskHref = (task: ForecastTask) => `/calendar?${new URLSearchParams({ date: task.date, task: task.id })}`;
export const sourceLabel = (source: string) => ({ cleaners: 'Personas', tasks: 'Tareas', recurring_tasks: 'Compromisos recurrentes', recurring_task_executions: 'Ejecuciones de recurrencias', task_assignments: 'Asignaciones', worker_absences: 'Ausencias y otros servicios', worker_fixed_days_off: 'Libranzas', worker_maintenance_cleanings: 'Mantenimientos', properties: 'Propiedades', property_groups: 'Edificios', property_group_assignments: 'Relación de propiedades y edificios', staffingRulesForSede: 'Reglas de sede' }[source] ?? 'Datos de la previsión');
const issueTitles: Record<string, string> = {
  'missing-duration': 'Revisar duración de tareas', 'unknown-contract': 'Revisar jornadas', 'invalid-rest': 'Revisar libranzas', 'invalid-maintenance': 'Revisar horarios de mantenimiento',
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
  const priority = (group: typeof groups extends Map<string, infer T> ? T : never) => group.code === 'source-unavailable' ? 0 : group.issues.some(i => i.impact === 'demand') ? 1 : group.issues.some(i => i.impact === 'ledger') ? 2 : group.code === 'actual-conflict' ? 4 : 3;
  return [...groups.values()].sort((a, b) => priority(a) - priority(b) || b.issues.length - a.issues.length);
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
  let unknown = !worker.contractKnown || model.issues.some(i => i.impact !== 'information' && (!i.ids.length || i.ids.includes(worker.id) || i.workerId === worker.id) && issueDuring(i, rows[0], rows.at(-1)!));
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
