import assert from 'node:assert/strict';
import test from 'node:test';
import { buildForecastModel } from '../src/features/staffing/forecastModel';
import { context, dataset, task, worker } from './forecastFixture';
import { attentionDays, coverageLabel, demandSummary, horizonScope, scopedTasks, simulationChanges } from '../src/features/staffing/forecastPresentation';
import { readForecastDataset } from '../src/features/staffing/forecastReader';
import type { StaffingReadPage, StaffingRow } from '../src/features/staffing/data';

test('R01: October ledger and capacity do not inherit a September absence warning', () => {
  const absence = { id: 'bad-sept', workerId: 'w', from: '2026-09-15', to: '2026-09-15', type: 'unknown' };
  const issue = { code: 'invalid-absence', message: 'Tipo no verificable', source: 'worker_absences', ids: ['w', 'bad-sept'], impact: 'capacity' as const };
  const tasks = [task('oct', { date: '2026-10-20' })];
  const narrow = buildForecastModel(dataset({ tasks }), context);
  const wide = buildForecastModel(dataset({ from: '2026-08-31', to: '2026-12-06', tasks, absences: [absence], issues: [issue] }), { ...context, month: '2026-09', horizon: 3 });
  assert.deepEqual(wide.ledgers.find(l => l.month === '2026-10'), narrow.ledgers[0]);
  assert.deepEqual(wide.days.filter(d => d.date >= '2026-10-19' && d.date <= '2026-10-25'), narrow.days.filter(d => d.date >= '2026-10-19' && d.date <= '2026-10-25'));
  assert.equal(wide.ledgers.find(l => l.month === '2026-09')?.status, 'No verificable');
});

test('R01: September task conflict cannot invalidate the October balance of its owner', () => {
  const d = dataset({ from: '2026-08-31', to: '2026-12-06', tasks: [task('sept', { date: '2026-09-10', workerId: 'w', start: 600, end: 660 }), task('oct')] });
  const result = buildForecastModel(d, { ...context, month: '2026-09', horizon: 3 });
  assert.equal(result.ledgers.find(l => l.month === '2026-09')?.status, 'No verificable');
  assert.equal(result.ledgers.find(l => l.month === '2026-10')?.status, 'Faltan horas');
});

test('R07: ineffective reinforcement never raises existing team daily capacity', () => {
  const d = dataset({ tasks: [task('impossible', { minutes: 400 })] });
  const base = buildForecastModel(d, context), sim = buildForecastModel(d, context, 15.5);
  assert.equal(sim.placements.filter(p => p.workerId === 'hypothetical').length, 0);
  assert.deepEqual(sim.days.map(d => d.capacity), base.days.map(d => d.capacity));
});

test('R06: maintenance uses availability and weekly budget; never gets added back to capacity', () => {
  const w = worker('w', { weeklyMinutes: 60, restDays: [], blockedSlots: [{ day: 2, startMinute: 660, endMinute: 738, consumesContract: true }] });
  const result = buildForecastModel(dataset({ workers: [w], tasks: [] }), context);
  assert.equal(result.weeks.find(w => w.key === '2026-10-05')?.capacity, 0);
});

test('R01: injected SELECT reader preserves absence and task time bounds in narrow/wide reads', async () => {
  const tables: Record<string, StaffingRow[]> = {
    properties: [{ id: 'p', sede_id: context.sedeId, nombre: 'Prueba', duracion_servicio: 60, check_out_predeterminado: '11:00', check_in_predeterminado: '17:00' }],
    cleaners: [{ id: 'w', name: 'Persona de prueba', sede_id: context.sedeId, is_active: true, contract_hours_per_week: 15 }],
    worker_absences: [{ id: 'sept', cleaner_id: 'w', start_date: '2026-09-12', end_date: '2026-09-14', absence_type: 'unknown' }],
    tasks: [{ id: 'oct', sede_id: context.sedeId, propiedad_id: 'p', date: '2026-10-20', status: 'pending', type: 'limpieza-turistica' }],
    worker_fixed_days_off: [{ id: 'rest', cleaner_id: 'w', day_of_week: 1, is_active: true }],
  };
  const read: StaffingReadPage = async s => (tables[s.table] ?? []).filter(r => Object.entries(s.equals ?? {}).every(([k, v]) => r[k] === v) && (!s.within || s.within.ids.includes(String(r[s.within.column]))) && (!s.since || String(r[s.since.column]) >= s.since.value) && (!s.until || String(r[s.until.column]) <= s.until.value)).slice(s.from, s.to + 1);
  const narrowData = await readForecastDataset(read, context.sedeId, '2026-09-28', '2026-11-01');
  const wideData = await readForecastDataset(read, context.sedeId, '2026-08-31', '2026-12-06');
  assert.equal(wideData.issues.find(i => i.code === 'invalid-absence')?.from, '2026-09-12');
  const narrow = buildForecastModel(narrowData, context), wide = buildForecastModel(wideData, { ...context, month: '2026-09', horizon: 3 });
  assert.deepEqual(wide.ledgers.filter(l => l.month === '2026-10'), narrow.ledgers);
  assert.deepEqual(wide.days.filter(d => d.date.startsWith('2026-10')), narrow.days.filter(d => d.date.startsWith('2026-10')));
});

test('R06/R12: imported non-tourism services block time and count in ledger, outside tourism calendar', () => {
  const d = dataset({ tasks: [task('service', { tourism: false, workerId: 'w', start: 660, end: 720 }), task('tourism', { windowStart: 660, windowEnd: 720 })] });
  const m = buildForecastModel(d, context);
  assert.equal(m.ledgers[0].other, 60);
  assert.equal(m.ledgers[0].future, 60);
  assert.equal(m.months[0].known, 60);
  assert.equal(m.months[0].uncovered, 60);
  assert.deepEqual(m.tasks.map(t => t.id), ['tourism']);
});

test('R06: the daily capacity deductions reconcile per worker, including overlapping services', () => {
  const d = dataset({ workers: [worker('w', { blockedSlots: [{ day: 2, startMinute: 660, endMinute: 780, consumesContract: true }, { day: 2, startMinute: 720, endMinute: 840, consumesContract: true }] })] });
  const m = buildForecastModel(d, context);
  for (const r of m.capacityRows ?? []) assert.ok(Math.abs(r.windows - r.rest - r.absence - r.services - r.otherCenters - r.unverified - r.weeklyReduction - r.capacity) < 1e-7);
  const tuesday = m.capacityRows!.find(r => r.date === '2026-10-06')!;
  assert.equal(tuesday.services, 180);
  assert.equal(tuesday.paid, 180);
});

test('R08: existing-team proposals and rest recommendations remain stable with reinforcement', () => {
  const d = dataset({ workers: [worker('w', { weeklyMinutes: 60, restDays: [], flexibleRest: true })], tasks: [task('a'), task('b'), task('c'), task('d', { date: '2026-10-08' })] });
  const base = buildForecastModel(d, context), sim = buildForecastModel(d, context, 15);
  assert.deepEqual(base.rests, sim.rests);
  assert.deepEqual(base.placements, sim.placements.filter(p => p.workerId !== 'hypothetical'));
  const delta = simulationChanges(base, sim, horizonScope(context));
  assert.equal(delta.before.length - delta.reinforcement.length - delta.team.length + delta.lost.length, delta.remaining.length);
  assert.equal(delta.team.length, 0);
  assert.equal(delta.lost.length, 0);
  assert.ok(delta.reinforcement.length > 0);
});

test('R04/R05: local empty days are distinct; upcoming actions exclude past records', () => {
  const d = dataset({ tasks: [task('past', { date: '2026-10-01' }), task('next', { date: '2026-10-27' })], issues: [{ code: 'unknown-contract', source: 'cleaners', ids: ['w'], impact: 'ledger', message: 'Jornada pendiente' }] });
  const m = buildForecastModel(d, { ...context, asOf: '2026-10-22T10:00' });
  const scope = horizonScope(context), attention = attentionDays(m, scope);
  assert.deepEqual(attention.upcoming.map(d => d.date), ['2026-10-27']);
  assert.deepEqual(attention.past.map(d => d.date), ['2026-10-01']);
  assert.equal(coverageLabel(m, { ...scope, from: '2026-10-22', to: '2026-10-22' }), 'Sin tareas registradas');
});

test('R10: valid durations on an incomplete day remain in subtotal and blocker link scope', () => {
  const m = buildForecastModel(dataset({ tasks: [task('known', { minutes: 33 }), task('unknown', { minutes: NaN })] }), context);
  const total = demandSummary(scopedTasks(m, horizonScope(context)));
  assert.equal(total.known, 33);
  assert.equal(total.unknown.length, 1);
  assert.ok(Number.isNaN(total.total));
  assert.deepEqual(scopedTasks(m, horizonScope(context), 'unknown-duration').map(t => t.id), ['unknown']);
  const invalid = buildForecastModel(dataset({ tasks: [task('infinite', { minutes: Infinity })] }), context);
  assert.ok(Number.isNaN(invalid.months[0].known));
  assert.ok(Number.isNaN(invalid.days.find(d => d.date === '2026-10-06')!.known));
});
