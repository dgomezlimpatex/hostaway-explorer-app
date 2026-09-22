import assert from 'node:assert/strict';
import test from 'node:test';
import { context, dataset, task, worker } from './forecastFixture';
import { buildForecastModel } from '../src/features/staffing/forecastModel';
import { parseForecastContext, forecastLink } from '../src/features/staffing/forecastContract';
import { affectedRecords, closeForecastDetail, focusMonth, viewScope, scopedTasks, scopeQuery, taskConflicts, coverageLabel, duration, sumComplete, teamSummary, centerLabel, workerWeek, groupIssues } from '../src/features/staffing/forecastPresentation';
import { buildReport, reportCsvRows } from '../src/features/staffing/forecastReportData';
import { forecastCsv } from '../src/features/staffing/forecastExport';

test('A03/A12: horizon start is distinct from the week and monthly ledger; boundary months selectable', () => {
  const ctx = { ...context, month: '2026-09', horizon: 3, week: '2026-10-19' };
  assert.equal(focusMonth(ctx, new URLSearchParams('view=week')), '2026-10');
  assert.equal(focusMonth({ ...ctx, week: '2026-08-31' }, new URLSearchParams('view=week')), '2026-09');
  assert.equal(focusMonth(ctx, new URLSearchParams('task=x&date=2026-11-01')), '2026-11');
});
test('A04: scopeQuery opens the exact same weekly pending set, not the full month', () => {
  const model = buildForecastModel(dataset({ tasks: [task('one'), task('two', { date: '2026-10-20' })] }), context);
  const scope = viewScope(context, new URLSearchParams('view=week'));
  const link = forecastLink('shifts', context, { ...scopeQuery(scope), filter: 'pending' });
  const params = new URL(link, 'http://local').searchParams;
  assert.deepEqual(scopedTasks(model, scope, 'pending').map(t => t.id), scopedTasks(model, viewScope(context, params), params.get('filter')!).map(t => t.id));
  assert.equal(scopedTasks(model, scope).length, 1);
});
test('A02/A18: unknown goals and incomplete demand never become confirmed zero/success', () => {
  const data = dataset({ workers: [worker('unknown', { contractKnown: false })], tasks: [task('bad', { minutes: NaN })], issues: [{ code: 'missing-duration', source: 'properties', ids: ['bad'], impact: 'demand', message: 'Missing' }] });
  const model = buildForecastModel(data, context);
  assert.equal(teamSummary(model, context.month).risk.length, 0);
  assert.equal(teamSummary(model, context.month).unknown.length, 1);
  assert.ok(Number.isNaN(sumComplete(model.months, m => m.known)));
  assert.equal(coverageLabel(model, viewScope(context, new URLSearchParams())), 'Datos de tareas incompletos');
});
test('A08: successful planner proposal remains explicitly unrecorded', () => {
  const model = buildForecastModel(dataset(), context);
  assert.equal(coverageLabel(model, viewScope(context, new URLSearchParams())), 'Encaje propuesto · sin guardar');
  assert.equal(model.ledgers[0].computed + model.ledgers[0].future, 0);
});
test('A13: 33-minute unassigned record outside the client window is a concrete conflict', () => {
  const t = task('bad-time', { minutes: 33, start: 600, end: 633 });
  const model = buildForecastModel(dataset({ tasks: [t] }), context);
  assert.equal(duration(t.minutes), '33 min');
  assert.ok(taskConflicts(t, model).includes('El horario registrado queda fuera de la ventana del cliente.'));
});
test('A07/A06: worker margin includes maintenance and real tasks, excludes suggestions and no weekly minimum', () => {
  const w = worker('w', { blockedSlots: [{ day: 2, startMinute: 480, endMinute: 600, consumesContract: true }] });
  const data = dataset({ workers: [w], tasks: [task('real', { workerId: 'w', start: 660, end: 720 }), task('proposal', { start: 800, end: 860 })] });
  const model = buildForecastModel(data, context);
  const weekly = workerWeek(data, model, w, context.week);
  assert.equal(weekly.committed, 180);
  assert.equal(weekly.maximum, 1170);
  assert.equal(weekly.margin, 990);
});
test('A17: reinforcement is active only in the explicitly simulated week; base is unchanged', () => {
  const data = dataset({ workers: [], tasks: [task('in'), task('out', { date: '2026-10-20' })] });
  const before = JSON.stringify(data);
  const scoped = { ...context, reinforcementFrom: '2026-10-05', reinforcementTo: '2026-10-11' };
  const base = buildForecastModel(data, scoped);
  const simulated = buildForecastModel(data, scoped, 15.5);
  assert.equal(simulated.placements.filter(p => p.workerId === 'hypothetical').length, 1);
  assert.equal(simulated.placements.find(p => p.workerId === 'hypothetical')?.taskId, 'in');
  assert.equal(base.placements.length, 0);
  assert.deepEqual(base.uncoveredTaskIds, ['in', 'out']);
  assert.deepEqual(simulated.uncoveredTaskIds, ['out']);
  assert.equal(JSON.stringify(data), before);
  const parsed = parseForecastContext(new URLSearchParams('month=2026-10&horizon=1&simFrom=2026-10-05&simTo=2026-10-11'), context.sedeId);
  assert.equal(parsed.reinforcementTo, '2026-10-11');
});
test('A17: weekly reinforcement budget accepts positive decimals without an arbitrary step or ceiling', () => {
  assert.throws(() => buildForecastModel(dataset(), context, -1));
  assert.doesNotThrow(() => buildForecastModel(dataset(), context, 15.1)); assert.throws(() => buildForecastModel(dataset(), context, Infinity));
  assert.doesNotThrow(() => buildForecastModel(dataset(), context, 60.25));
});
test('A21: report and CSV share the same filtered rows, preserve unknowns and spreadsheet safety', () => {
  const data = dataset({ workers: [worker('missing', { name: '=formula', contractKnown: false }), worker('other', { name: 'Otro' })], issues: [] });
  const model = buildForecastModel(data, context);
  const report = buildReport(data, model, '2026-10', 'hours', 'formula');
  assert.equal(report.rows.length, 1);
  assert.equal(report.rows[0].cells[2], 'Por verificar');
  assert.equal(report.totals?.[2], 'Por verificar');
  assert.equal(report.totals?.[6], 'Por verificar');
  const csv = forecastCsv(reportCsvRows(report, { sede: 'Test', center: 'All', scenario: 'Base', rules: 'test', issues: 0 }));
  assert.ok(csv.includes("'=formula"));
  assert.ok(csv.includes('Por verificar'));
  assert.ok(csv.includes('Total del filtro'));
  assert.ok(!csv.includes('"Otro"'));
  assert.ok(forecastCsv([[NaN]]).includes('Por verificar'));
});
test('UI-07/UI-14: issues group by cause and unnamed centers keep distinct identity', () => {
  const data = dataset();
  const issue = { code: 'unknown-contract', source: 'cleaners', ids: ['w'], impact: 'ledger' as const, message: 'missing' };
  assert.equal(groupIssues([issue, issue]).length, 1);
  assert.equal(groupIssues([issue, issue])[0].issues.length, 1);
  assert.notEqual(centerLabel({ ...data.centers[0], name: 'Propiedad no identificada', id: 'unmapped:12345678' }), centerLabel({ ...data.centers[0], name: 'Propiedad no identificada', id: 'unmapped:87654321' }));
});
test('UI-07: affected records are counted once across repeated issues and property references', () => {
  const data = dataset({ tasks: [task('a', { propertyId: 'p', workerId: 'w' }), task('b', { propertyId: 'p', workerId: 'w' })], properties: [{ id: 'p', centerId: 'c', name: 'Propiedad', minutes: NaN, windowStart: 660, windowEnd: 1020 }] });
  const issue = { code: 'missing-duration', ids: ['p'], source: 'properties', message: 'Missing', impact: 'demand' as const };
  const records = affectedRecords(data, [issue, issue]);
  assert.deepEqual(Object.fromEntries(Object.entries(records).map(([key, value]) => [key, value.length])), { workers: 1, tasks: 2, centers: 1, properties: 1 });
});
test('UI-10: closing a task restores its person list and filters, then closes to the original team filters', () => {
  const params = new URLSearchParams('task=a&returnPerson=w&personTaskQuery=marina&personTaskDate=2026-10-06&focusMonth=2026-10&q=ana');
  const person = closeForecastDetail(params);
  assert.equal(person.get('person'), 'w');
  assert.equal(person.get('personTab'), 'tasks');
  assert.equal(person.get('personTaskQuery'), 'marina');
  assert.equal(person.get('task'), null);
  const team = closeForecastDetail(person);
  assert.equal(team.get('person'), null);
  assert.equal(team.get('personTaskQuery'), null);
  assert.equal(team.get('q'), 'ana');
  assert.equal(closeForecastDetail(new URLSearchParams('task=a&returnCenter=c')).get('detail'), 'c');
});
test('A07: weekly paid services follow the registered employment dates and invalid intervals remain unknown', () => {
  const w = worker('w', { activeFrom: '2026-10-07', blockedSlots: [{ day: 2, startMinute: 480, endMinute: 600, consumesContract: true }] });
  const data = dataset({ workers: [w], tasks: [] });
  assert.equal(workerWeek(data, buildForecastModel(data, context), w, context.week).committed, 0);
  const invalid = { ...w, activeFrom: undefined, blockedSlots: [{ day: 2, startMinute: 600, endMinute: 480, consumesContract: true }] };
  assert.ok(workerWeek(data, buildForecastModel(data, context), invalid, context.week).unknown);
});
test('A21: report order and its CSV rows are identical without sorting unknown balances as zero', () => {
  const data = dataset({ tasks: [], workers: [worker('b', { name: 'Bea', weeklyMinutes: 1800 }), worker('a', { name: 'Ana' }), worker('u', { name: 'Por revisar', contractKnown: false })] });
  const model = buildForecastModel(data, context);
  const byName = buildReport(data, model, context.month, 'hours');
  assert.deepEqual(byName.rows.map(r => r.key), ['a', 'b', 'u']);
  const byMissing = buildReport(data, model, context.month, 'hours', '', '', 'pending');
  assert.deepEqual(byMissing.rows.map(r => r.key), ['b', 'a', 'u']);
  const csv = forecastCsv(reportCsvRows(byMissing, { sede: 's', center: 'Todos', scenario: 'Base', rules: 'test', issues: 0 }));
  assert.ok(csv.indexOf('"Bea"') < csv.indexOf('"Ana"'));
  assert.equal(byMissing.rows[2].cells[6], 'Por verificar');
});
