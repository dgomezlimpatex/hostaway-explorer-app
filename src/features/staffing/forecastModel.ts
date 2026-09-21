import { addCivilDays, addCivilMonths, monthEnd } from './monthly';
import { dates, monday, weekday, monthDates, validDate, type ForecastContext, type ForecastDataset, type ForecastModel, type ForecastWorker, type ForecastTask, type ForecastPlacement, type ForecastIssue, type WorkerMonthLedger, type ForecastDay, type ForecastPeriod } from './forecastContract';

const sum = <T,>(rows: T[], value: (row: T) => number) => rows.reduce((total, row) => total + (Number.isFinite(value(row)) ? value(row) : 0), 0);
// Registered only for the private snapshot created by a model run, never caller-owned input.
const paidCache = new WeakMap<ForecastDataset, Map<string, number>>();
const overlaps = (a: { start: number; end: number }, b: { start: number; end: number }) => a.start < b.end && b.start < a.end;
function effectivePlacements(placements: ForecastPlacement[]) {
  const proposed = new Set(placements.filter(p => !p.real).map(p => p.taskId));
  return placements.filter(p => !p.real || !proposed.has(p.taskId));
}
const active = (worker: ForecastWorker, date: string) => (!worker.activeFrom || date >= worker.activeFrom) && (!worker.activeTo || date <= worker.activeTo);
function union(slots: { start: number; end: number }[]) {
  let total = 0, end = 0;
  for (const slot of [...slots].sort((a, b) => a.start - b.start)) { total += Math.max(0, slot.end - Math.max(end, slot.start)); end = Math.max(end, slot.end); }
  return total;
}
const absent = (data: ForecastDataset, workerId: string, date: string) => data.absences.filter(a => a.workerId === workerId && a.from <= date && a.to >= date);
function blocks(data: ForecastDataset, worker: ForecastWorker, date: string) {
  return [
    ...(worker.blockedSlots ?? []).filter(b => b.date ? b.date === date : b.day === weekday(date)).map(b => ({ start: b.startMinute, end: b.endMinute, paid: b.consumesContract })),
    ...absent(data, worker.id, date).map(a => ({ start: a.start ?? 0, end: a.end ?? 1440, paid: a.type === 'external_work' && Number.isFinite(a.start) && Number.isFinite(a.end) && a.end > a.start })),
  ];
}
const resting = (worker: ForecastWorker, date: string, rests: ForecastModel['rests']) => worker.restDays.includes(weekday(date)) || worker.confirmedRestDates.includes(date) || rests.some(r => r.workerId === worker.id && r.date === date);
const usable = (worker: ForecastWorker) => !worker.excluded && worker.contractKnown && worker.weeklyMinutes > 0;
const eligibleCenter = (worker: ForecastWorker, centerId: string) => !worker.excludedCenterIds?.includes(centerId) && (worker.canMove || worker.centerPriorities?.some(r => r.centerId === centerId));
export function candidateTier(worker: ForecastWorker, centerId: string) {
  const priority = Math.min(...(worker.centerPriorities ?? []).filter(r => r.centerId === centerId).map(r => r.priority));
  return priority < 20 ? 0 : priority < 30 ? 1 : priority < 90 ? 2 : 3;
}
function paidIntervals(data: ForecastDataset, worker: ForecastWorker, date: string) {
  const paid = blocks(data, worker, date).filter(b => b.paid);
  const assigned = data.tasks.filter(t => t.workerId === worker.id && t.date === date && Number.isFinite(t.start) && t.end > t.start);
  // Overlapping sources require review, but must not credit the same clock minute twice.
  return paid.flatMap(slot => {
    let remaining = [{ start: slot.start, end: slot.end }];
    for (const task of assigned) remaining = remaining.flatMap(r => !overlaps(r, task) ? [r] : [{ start: r.start, end: Math.min(r.end, task.start) }, { start: Math.max(r.start, task.end), end: r.end }].filter(s => s.end > s.start));
    return remaining;
  });
}
function paidBlocks(data: ForecastDataset, worker: ForecastWorker, date: string) {
  const cache = paidCache.get(data), key = `${worker.id}:${date}`;
  if (cache?.has(key)) return cache.get(key)!;
  const value = active(worker, date) ? union(paidIntervals(data, worker, date)) : 0;
  cache?.set(key, value); return value;
}
function available(data: ForecastDataset, worker: ForecastWorker, task: ForecastTask, rests: ForecastModel['rests']) {
  return usable(worker) && active(worker, task.date) && !resting(worker, task.date, rests) && eligibleCenter(worker, task.centerId)
    && !data.issues.some(i => i.impact === 'capacity' && (!i.date || i.date === task.date) && (i.ids.includes(worker.id) || i.ids.includes(task.id) || i.ids.includes(task.propertyId) || !i.ids.length));
}
function validTask(task: ForecastTask) { return !task.ambiguous && task.minutes > 0 && Number.isFinite(task.minutes) && task.windowStart >= 0 && task.windowEnd <= 1440 && task.windowEnd - task.windowStart >= task.minutes; }
function fits(data: ForecastDataset, worker: ForecastWorker, task: ForecastTask, start: number, placements: ForecastPlacement[], rests: ForecastModel['rests']) {
  const end = start + task.minutes;
  if (!available(data, worker, task, rests) || !validTask(task) || start < task.windowStart || end > task.windowEnd) return false;
  if (worker.id !== 'hypothetical' && !worker.availability.some(a => a.day === weekday(task.date) && a.startMinute <= start && a.endMinute >= end)) return false;
  if (blocks(data, worker, task.date).some(b => !Number.isFinite(b.start) || !Number.isFinite(b.end) || overlaps({ start, end }, b))) return false;
  const effective = effectivePlacements(placements);
  const route = effective.filter(p => p.workerId === worker.id && p.date === task.date && p.taskId !== task.id);
  for (const p of route) {
    if (start < p.end && end > p.start) return false;
  }
  const ordered = [...route, { start, end, centerId: task.centerId }].sort((a, b) => a.start - b.start);
  for (let i = 1; i < ordered.length; i++) {
    const previous = ordered[i - 1], next = ordered[i];
    if (previous.centerId === next.centerId) continue;
  }
  const week = monday(task.date);
  const weekEnd = addCivilDays(week, 6);
  const used = sum(effective.filter(p => p.workerId === worker.id && p.date >= week && p.date <= weekEnd && p.taskId !== task.id), p => p.minutes)
    + sum(dates(week, addCivilDays(week, 6)), date => paidBlocks(data, worker, date));
  return used + task.minutes <= worker.weeklyMinutes * 1.3 + 1e-8;
}
export interface ForecastCandidate { worker: ForecastWorker; start: number; end: number; tier: number; missing: number }
export function findCandidates(data: ForecastDataset, task: ForecastTask, placements: ForecastPlacement[], rests: ForecastModel['rests'], ledgers: WorkerMonthLedger[], asOf?: string): ForecastCandidate[] {
  if (!validTask(task)) return [];
  if (asOf && task.date < asOf.slice(0, 10)) return [];
  const earliest = asOf?.startsWith(task.date) ? Math.max(task.windowStart, Number(asOf.slice(11, 13)) * 60 + Number(asOf.slice(14, 16))) : task.windowStart;
  const candidates: ForecastCandidate[] = [];
  for (const worker of data.workers) {
    if (!available(data, worker, task, rests)) continue;
    const starts = new Set([earliest, ...worker.availability.filter(a => a.day === weekday(task.date)).map(a => Math.max(earliest, a.startMinute)), ...blocks(data, worker, task.date).map(b => Math.max(earliest, b.end)),
      ...placements.filter(p => p.workerId === worker.id && p.date === task.date && p.taskId !== task.id).map(p => Math.max(earliest, p.end))]);
    const start = [...starts].sort((a, b) => a - b).find(s => fits(data, worker, task, s, placements, rests));
    if (start !== undefined) candidates.push({ worker, start, end: start + task.minutes, tier: candidateTier(worker, task.centerId), missing: ledgers.find(l => l.workerId === worker.id && l.month === task.date.slice(0, 7))?.missing ?? 0 });
  }
  const tier = Math.min(...candidates.map(c => c.tier));
  return candidates.filter(c => c.tier === tier).sort((a, b) => b.missing - a.missing || a.start - b.start || a.worker.id.localeCompare(b.worker.id));
}
function buildLedgers(data: ForecastDataset, context: ForecastContext, placements: ForecastPlacement[], rests: ForecastModel['rests'], issues: ForecastIssue[]): WorkerMonthLedger[] {
  const ledgers: WorkerMonthLedger[] = [];
  for (let offset = 0; offset < context.horizon; offset++) {
    const month = addCivilMonths(`${context.month}-01`, offset).slice(0, 7);
    const days = monthDates(month);
    for (const worker of data.workers) {
      const contract = worker.weeklyMinutes * 4.345;
      const activeDays = days.filter(date => active(worker, date));
      // No agreed proration convention for partial employment: retain base and flag below.
      let adjustment = 0;
      for (const date of activeDays) {
        const absences = absent(data, worker.id, date).filter(a => !['day_off', 'external_work'].includes(a.type));
        if (!absences.length || resting(worker, date, rests) || !absences.some(a => a.start === undefined && a.end === undefined)) continue;
        const workingDays = dates(monday(date), addCivilDays(monday(date), 6)).filter(d => !resting(worker, d, rests)).length;
        if (workingDays) adjustment += worker.weeklyMinutes / workingDays;
      }
      const target = Math.max(0, contract - adjustment);
      const allAssigned = data.tasks.filter(t => t.workerId === worker.id && t.date.startsWith(month));
      const assigned = allAssigned.filter(t => !t.ambiguous && t.minutes > 0);
      const completeByTime = (date: string, end: number) => Number.isFinite(end) && `${date}T${String(Math.floor(end / 60)).padStart(2, '0')}:${String(Math.floor(end % 60)).padStart(2, '0')}` <= context.asOf;
      const computed = sum(assigned.filter(t => completeByTime(t.date, t.end)), t => t.minutes) + sum(activeDays, date => union(paidIntervals(data, worker, date).filter(b => completeByTime(date, b.end))));
      const future = sum(assigned.filter(t => Number.isFinite(t.end) && !completeByTime(t.date, t.end)), t => t.minutes) + sum(activeDays, date => union(paidIntervals(data, worker, date).filter(b => !completeByTime(date, b.end))));
      const other = sum(assigned.filter(t => !t.tourism), t => t.minutes) + sum(activeDays, date => paidBlocks(data, worker, date));
      const unknown = activeDays.length !== days.length || !worker.contractKnown || allAssigned.some(t => !Number.isFinite(t.end) || !(t.minutes > 0) || t.ambiguous) || issues.some(i => i.impact !== 'information' && (i.ids.includes(worker.id) || i.workerId === worker.id || !i.ids.length || allAssigned.some(t => i.ids.includes(t.id))));
      ledgers.push({ workerId: worker.id, month, target, adjustment, computed, future, other, tourism: sum(assigned.filter(t => t.tourism), t => t.minutes),
        proposed: sum(placements.filter(p => !p.real && p.workerId === worker.id && p.date.startsWith(month)), p => p.minutes), missing: Math.max(0, target - computed - future),
        status: worker.excluded ? 'Excluido' : !worker.contractKnown ? 'No verificable' : worker.weeklyMinutes === 0 ? 'Sin jornada' : unknown ? 'No verificable' : computed + future >= target - 1e-8 ? 'Cumple' : 'Faltan horas' });
    }
  }
  return ledgers;
}

/** One pure model for every production screen. Scheduling suggestions never become actual work. */
export function buildForecastModel(input: ForecastDataset, context: ForecastContext, reinforcementHours = 0): ForecastModel {
  if (input.sedeId !== context.sedeId) throw new Error('La sede del resultado no corresponde a la consulta.');
  if (!Number.isFinite(reinforcementHours) || reinforcementHours < 0 || reinforcementHours > 60 || !Number.isInteger(reinforcementHours * 4)) throw new Error('Refuerzo inválido (0–60 h, intervalos de 0,25 h).');
  const data: ForecastDataset = { ...input, workers: input.workers.map(w => ({ ...w, blockedSlots: [...(w.blockedSlots ?? [])] })), issues: [...input.issues] };
  const cache = new Map<string, number>(); paidCache.set(data, cache);
  const tasksByDate = new Map<string, ForecastTask[]>();
  for (const task of data.tasks) tasksByDate.set(task.date, [...(tasksByDate.get(task.date) ?? []), task]);
  if (reinforcementHours > 0) data.workers.push({ id: 'hypothetical', name: 'Refuerzo hipotético', weeklyMinutes: reinforcementHours * 60 / 1.3, weeklyMinutesMax: reinforcementHours * 60, contractKnown: true, engagement: 'collaborator', restDays: [], restDay: null, flexibleRest: false, canMove: !context.center, homeCenterIds: context.center ? [context.center] : [], centerPriorities: context.center ? [{ centerId: context.center, priority: 89 }] : [], unavailableDates: [], confirmedRestDates: [], availability: [], excluded: false });
  const issues = [...data.issues];
  if (context.center && !data.centers.some(c => c.id === context.center)) issues.push({ code: 'center-unavailable', message: 'El centro no está disponible en la sede actual.', source: 'properties', ids: [context.center], centerId: context.center, impact: 'capacity' });
  // Any overlap between an external recurring service and a task needs identity review.
  for (const worker of data.workers) for (const task of data.tasks.filter(t => t.workerId === worker.id)) {
    if (blocks(data, worker, task.date).some(b => b.paid && overlaps({ start: task.start, end: task.end }, b))) {
      issues.push({ code: 'paid-work-overlap', message: 'Tarea y otro servicio coinciden: revisar identidad antes de sumar sus horas.', source: 'worker_maintenance_cleanings', ids: [task.id, worker.id], workerId: worker.id, date: task.date, impact: 'ledger' });
    }
  }
  const addIssue = (code: string, message: string, task: ForecastTask) => issues.push({ code, message, source: 'tasks', ids: [task.id, task.workerId ?? ''].filter(Boolean), date: validDate(task.date) ? task.date : undefined, centerId: task.centerId, impact: 'capacity' });
  if (data.tasks.length > 10000 || data.workers.length > 100) throw new Error('Consulta demasiado grande; reduce el periodo.');
  const rests: ForecastModel['rests'] = [];
  for (const worker of data.workers.filter(w => w.flexibleRest && usable(w))) {
    for (let week = monday(data.from); week <= data.to; week = addCivilDays(week, 7)) {
      const options = dates(week, addCivilDays(week, 6)).filter(date => !(tasksByDate.get(date) ?? []).some(t => t.workerId === worker.id) && !paidBlocks(data, worker, date));
      // Compare the peak daily shortage using eligible windows and each person's budget.
      // This remains a revisable proposal; the subsequent indivisible-task pass verifies encajes.
      const score = (restDate: string) => Math.max(...dates(week, addCivilDays(week, 6)).map(date => {
        const daily = tasksByDate.get(date) ?? [];
        const demand = sum(daily, t => t.minutes);
        const capacity = sum(data.workers.filter(w => usable(w) && active(w, date) && !resting(w, date, rests) && !(w.id === worker.id && date === restDate)), w => {
          const windows = daily.filter(t => eligibleCenter(w, t.centerId)).map(t => ({ start: t.windowStart, end: t.windowEnd })).filter(s => s.end > s.start);
          const busy = blocks(data, w, date);
          const free = Math.max(0, union([...windows, ...busy]) - union(busy));
          const weeklyBudget = Math.max(0, w.weeklyMinutes * 1.3 - sum(dates(week, addCivilDays(week, 6)), d => paidBlocks(data, w, d)));
          return Math.min(free, weeklyBudget);
        });
        return Math.max(0, demand - capacity);
      }));
      const scores = new Map(options.map(date => [date, score(date)]));
      options.sort((a, b) => scores.get(a)! - scores.get(b)! || sum(tasksByDate.get(a) ?? [], t => t.minutes) - sum(tasksByDate.get(b) ?? [], t => t.minutes) || a.localeCompare(b));
      if (options[0]) rests.push({ workerId: worker.id, date: options[0] });
      else issues.push({ code: 'rest-unresolved', message: 'No hay un día libre sin compromisos reales; revisar la semana.', source: 'tasks', ids: [worker.id], workerId: worker.id, date: week, impact: 'capacity' });
    }
  }
  const placements: ForecastPlacement[] = [];
  const validated = new Set<string>();
  const unique = new Map<string, ForecastTask>();
  const duplicates = new Set<string>();
  for (const task of data.tasks) { if (unique.has(task.id)) duplicates.add(task.id); else unique.set(task.id, task); }
  for (const id of duplicates) { const task = unique.get(id)!; addIssue('duplicate-task', 'Identidad duplicada; cobertura no verificable.', task); unique.delete(id); }
  for (const task of unique.values()) if (!validDate(task.date)) addIssue('invalid-date', 'Fecha de tarea inválida.', task);
  const tasks = [...unique.values()].filter(t => validDate(t.date) && t.date >= data.from && t.date <= data.to);
  data.tasks = tasks;
  cache.clear();
  for (const task of tasks.filter(t => t.workerId).sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start || a.id.localeCompare(b.id))) {
    const worker = data.workers.find(w => w.id === task.workerId);
    if (!worker || !validTask(task) || !Number.isFinite(task.start) || !Number.isFinite(task.end) || Math.abs(task.end - task.start - task.minutes) > 0.01) {
      addIssue('actual-assignment-unverified', 'La asignación real no tiene persona, duración u horario coherentes.', task);
      if (worker) worker.blockedSlots.push({ date: task.date, startMinute: 0, endMinute: 1440, consumesContract: false });
      continue;
    }
    const fitsReal = fits(data, worker, task, task.start, placements, rests);
    placements.push({ taskId: task.id, workerId: worker.id, centerId: task.centerId, date: task.date, start: task.start, end: task.end, minutes: task.minutes, real: true });
    if (fitsReal) validated.add(task.id); else addIssue('actual-conflict', 'Asignación real incompatible con jornada, ausencia o ventana.', task);
  }
  // Diagnose both sides of real overlaps; retaining real rows is not a coverage claim.
  for (const p of placements) if (placements.some(q => p.taskId !== q.taskId && p.workerId === q.workerId && p.date === q.date && overlaps(p, q))) validated.delete(p.taskId);
  let ledgers = buildLedgers(data, context, placements, rests, issues);
  const existing = { ...data, workers: data.workers.filter(w => w.id !== 'hypothetical') };
  const reinforcement = { ...data, workers: data.workers.filter(w => w.id === 'hypothetical') };
  paidCache.set(existing, cache); paidCache.set(reinforcement, cache);
  for (const task of tasks.filter(t => (!t.workerId || !validated.has(t.id)) && !t.ambiguous).sort((a, b) => a.date.localeCompare(b.date) || (a.windowEnd - a.windowStart - a.minutes) - (b.windowEnd - b.windowStart - b.minutes) || a.id.localeCompare(b.id))) {
    if (!validTask(task)) { addIssue('invalid-window', 'La tarea no tiene una duración y ventana verificables.', task); continue; }
    if (task.date < context.asOf.slice(0, 10)) continue;
    const options = findCandidates(existing, task, placements, rests, ledgers, context.asOf);
    const best = options[0] ?? (reinforcementHours > 0 ? findCandidates(reinforcement, task, placements, rests, ledgers, context.asOf)[0] : undefined);
    if (!best) continue;
    placements.push({ taskId: task.id, workerId: best.worker.id, centerId: task.centerId, date: task.date, start: best.start, end: best.end, minutes: task.minutes, real: false });
    validated.add(task.id);
    ledgers = ledgers.map(l => l.workerId === best.worker.id && l.month === task.date.slice(0, 7) ? { ...l, missing: Math.max(0, l.missing - task.minutes) } : l);
  }
  ledgers = buildLedgers(data, context, placements, rests, issues).filter(l => l.workerId !== 'hypothetical');
  const selectedTasks = tasks.filter(t => !context.center || t.centerId === context.center);
  const days: ForecastDay[] = dates(data.from, data.to).map(date => {
    const daily = selectedTasks.filter(t => t.date === date);
    const otherServices = context.center ? 0 : sum(data.workers.filter(w => !w.excluded), w => paidBlocks(data, w, date));
    const incomplete = daily.some(t => !(t.minutes > 0));
    return { date, known: incomplete ? NaN : sum(daily, t => t.minutes) + otherServices, tourism: incomplete ? NaN : sum(daily.filter(t => t.tourism), t => t.minutes), other: sum(daily.filter(t => !t.tourism), t => t.minutes) + otherServices, capacity: otherServices, uncovered: incomplete ? NaN : sum(daily.filter(t => !validated.has(t.id)), t => t.minutes), unassigned: daily.filter(t => !t.workerId).length, travel: 0 };
  });
  for (let week = monday(data.from); week <= data.to; week = addCivilDays(week, 7)) {
    const weekDays = days.filter(d => monday(d.date) === week);
    for (const worker of data.workers.filter(usable)) {
      const rows = effectivePlacements(placements).filter(p => p.workerId === worker.id && monday(p.date) === week);
      const paid = sum(dates(week, addCivilDays(week, 6)), date => paidBlocks(data, worker, date));
      const windows = data.centers.filter(c => (!context.center || c.id === context.center) && eligibleCenter(worker, c.id));
      const potentials = weekDays.map(day => {
        if (!active(worker, day.date) || resting(worker, day.date, rests)) return 0;
        if (data.issues.some(i => i.impact === 'capacity' && (!i.date || i.date === day.date) && (!i.ids.length || i.ids.includes(worker.id)))) return 0;
        const busy = [...blocks(data, worker, day.date), ...rows.filter(p => p.date === day.date && context.center && p.centerId !== context.center)];
        const spans = windows.flatMap(c => worker.id === 'hypothetical' ? [{ start: c.startMinute, end: c.endMinute }] : worker.availability.filter(a => a.day === weekday(day.date)).map(a => ({ start: Math.max(c.startMinute, a.startMinute), end: Math.min(c.endMinute, a.endMinute) }))).filter(w => w.end > w.start);
        const all = [...spans, ...busy];
        const route = rows.filter(p => p.date === day.date).sort((a, b) => a.start - b.start);
        return Math.max(0, union(all) - union(busy));
      });
      const otherCenters = sum(rows.filter(p => context.center && p.centerId !== context.center), p => p.minutes);
      const total = sum(potentials, n => n);
      const capacity = Math.max(0, Math.min(total, worker.weeklyMinutes * 1.3 - paid - otherCenters));
      const committed = weekDays.map(day => sum(rows.filter(p => p.date === day.date && (!context.center || p.centerId === context.center)), p => p.minutes));
      const committedTotal = sum(committed, n => n);
      const remaining = Math.max(0, capacity - committedTotal);
      const free = potentials.map((n, i) => Math.max(0, n - committed[i]));
      const freeTotal = sum(free, n => n);
      weekDays.forEach((day, i) => { day.capacity += (committedTotal ? Math.min(capacity, committedTotal) * committed[i] / committedTotal : 0) + (freeTotal ? remaining * free[i] / freeTotal : 0); });
      for (const day of weekDays) {
        const route = rows.filter(p => p.date === day.date).sort((a, b) => a.start - b.start);
        day.travel += 0;
      }
    }
  }
  const period = (key: string, rows: ForecastDay[]): ForecastPeriod => {
    const incompleteDemand = selectedTasks.some(t => rows.some(d => d.date === t.date) && !(t.minutes > 0));
    const demand = incompleteDemand ? NaN : sum(rows, d => d.known), uncovered = incompleteDemand ? NaN : sum(rows, d => d.uncovered);
    const partial = issues.some(i => i.impact !== 'information' && (!i.centerId || !context.center || i.centerId === context.center) && (!i.date || rows.some(d => d.date === i.date)));
    return { key, known: demand, tourism: incompleteDemand ? NaN : sum(rows, d => d.tourism), other: sum(rows, d => d.other), capacity: sum(rows, d => d.capacity), uncovered, unassigned: sum(rows, d => d.unassigned), travel: sum(rows, d => d.travel), reserve: incompleteDemand ? NaN : sum(rows, d => d.tourism) * 0.2,
      status: partial ? 'No verificable' : !demand ? 'Sin demanda' : uncovered > 0 ? 'Pendiente de encaje' : 'Cubierto' };
  };
  const weeks = [...new Set(days.map(d => monday(d.date)))].map(key => period(key, days.filter(d => monday(d.date) === key)));
  const months = Array.from({ length: context.horizon }, (_, i) => addCivilMonths(`${context.month}-01`, i).slice(0, 7)).map(key => period(key, days.filter(d => d.date >= `${key}-01` && d.date <= monthEnd(`${key}-01`))));
  const visibleWorkerIds = data.workers.filter(w => !context.center || w.centerPriorities?.some(p => p.centerId === context.center) || placements.some(p => p.workerId === w.id && p.centerId === context.center) || selectedTasks.some(t => t.workerId === w.id)).map(w => w.id);
  return { context, days, weeks, months, tasks: selectedTasks, placements, ledgers, issues, rests, workers: data.workers, visibleWorkerIds };
}
