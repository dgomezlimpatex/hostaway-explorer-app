import assert from 'node:assert/strict';
import test from 'node:test';
import { readForecastDataset } from '../src/features/staffing/forecastReader';
import { buildForecastModel, findCandidates } from '../src/features/staffing/forecastModel';
import { coverageLabel, scopedTasks, simulationChanges, weekScope } from '../src/features/staffing/forecastPresentation';
import { context, dataset, task, worker } from './forecastFixture';
import type { StaffingReadPage, StaffingRow } from '../src/features/staffing/data';

const hotel = 'e0c82e3d-f702-4842-8c34-c987a6fd9c2e';
const tables = (): Record<string, StaffingRow[]> => ({
  properties: [{ id: hotel, nombre: 'Hotel de prueba', sede_id: context.sedeId, duracion_servicio: 270, check_out_predeterminado: '09:30', check_in_predeterminado: '14:00' }],
  cleaners: [{ id: 'w', name: 'Persona de prueba', sede_id: context.sedeId, is_active: true, contract_hours_per_week: 20 }],
  worker_fixed_days_off: [{ id: 'rest', cleaner_id: 'w', day_of_week: 5, is_active: true }],
  recurring_tasks: [{ id: 'r', name: 'Jornada hotel', sede_id: context.sedeId, propiedad_id: hotel, cleaner_id: 'w', is_active: true, type: 'limpieza-turistica', frequency: 'weekly', interval_days: 1, days_of_week: [1], start_date: '2026-07-12', end_date: null, start_time: '09:30', end_time: '14:00', duracion: 270 }],
});
const reader = (rows: Record<string, StaffingRow[]>, fail = ''): StaffingReadPage => async s => {
  if (s.table === fail) throw new Error('Fuente no disponible');
  return (rows[s.table] ?? []).filter(r => Object.entries(s.equals ?? {}).every(([k,v]) => r[k] === v) && (!s.within || s.within.ids.includes(String(r[s.within.column]))) && (!s.since || String(r[s.since.column]) >= s.since.value) && (!s.until || String(r[s.until.column]) <= s.until.value)).slice(s.from,s.to+1);
};
test('N01: future recurring hotel commitment counts and blocks once, outside tourism demand', async () => {
  const data = await readForecastDataset(reader(tables()), context.sedeId, '2026-09-28', '2026-11-01');
  const model = buildForecastModel(data, context);
  assert.equal(data.tasks.filter(t => t.date === '2026-10-19').length, 1);
  assert.equal(model.ledgers[0].future, 4 * 270);
  assert.equal(model.ledgers[0].other, 4 * 270);
  assert.equal(model.months[0].known, 0);
  const clash = task('clash', { date: '2026-10-19', windowStart: 600, windowEnd: 660 });
  assert.equal(findCandidates(data, clash, model.placements, model.rests, model.ledgers, context.asOf).length, 0);
});
test('N01: materialized, cancelled and handled occurrences suppress virtual duplicates', async () => {
  const rows = tables();
  rows.tasks = [{ id: 'real', sede_id: context.sedeId, propiedad_id: hotel, cleaner_id: 'w', date: '2026-10-19', status: 'pending', type: 'limpieza-turistica', start_time: '09:30', end_time: '14:00', duracion: 270 }];
  rows.recurring_task_executions = [{ id: 'e', recurring_task_id: 'r', generated_task_id: 'real', success: true, execution_day: '2026-10-19', execution_date: '2026-10-18T22:00:00Z' }];
  let data = await readForecastDataset(reader(rows), context.sedeId, '2026-09-28', '2026-11-01');
  assert.deepEqual(data.tasks.filter(t => t.date === '2026-10-19').map(t=>t.id), ['real']);
  assert.equal(buildForecastModel(data, context).ledgers[0].future, 4*270);
  rows.tasks[0].status = 'cancelled';
  data = await readForecastDataset(reader(rows), context.sedeId, '2026-09-28', '2026-11-01');
  assert.equal(data.tasks.filter(t => t.date === '2026-10-19').length, 0);
  assert.equal(buildForecastModel(data, context).ledgers[0].future, 3*270);
  rows.recurring_task_executions[0].generated_task_id = null;
  assert.equal((await readForecastDataset(reader(rows), context.sedeId, '2026-09-28','2026-11-01')).tasks.filter(t=>t.date==='2026-10-19').length,0);
});
test('N01: recurrence source failure cannot appear as verified zero commitments', async () => {
  for (const source of ['recurring_tasks','recurring_task_executions']) {
    const data = await readForecastDataset(reader(tables(), source), context.sedeId, '2026-09-28','2026-11-01');
    assert.equal(buildForecastModel(data,context).ledgers[0].status,'No verificable');
    assert.ok(data.sources.some(s=>s.name===source && s.status==='unavailable'));
  }
});
test('N02: unassigned bad recorded time with feasible proposal is not lack of capacity', () => {
  const data = dataset({ workers:[worker('w',{restDays:[]})],tasks:[task('marina',{date:'2026-10-19',minutes:33,start:660,end:693,windowStart:720,windowEnd:900})] });
  const model = buildForecastModel(data,context), scope = weekScope('2026-10-19');
  assert.ok(model.placements.some(p=>p.start===720 && p.end===753 && !p.real));
  assert.notEqual(coverageLabel(model,scope),'Tareas sin encaje');
  const changes = simulationChanges(model,buildForecastModel(data,context,15),scope);
  assert.equal(changes.before.length,0);
  assert.equal(changes.conflicts.length,1);
  assert.deepEqual(scopedTasks(model,scope,'record-conflicts').map(t=>t.id),['marina']);
  assert.equal(scopedTasks(model,scope,'no-fit').length,0);
});

test('N01: execution day owns identity across Madrid offset; missing links stay unverified', async () => {
  const rows = tables();
  rows.recurring_task_executions = [{ id:'e',recurring_task_id:'r',generated_task_id:'missing',success:true,execution_day:'2026-10-19',execution_date:'2026-10-18T22:00:00Z' }];
  const data = await readForecastDataset(reader(rows),context.sedeId,'2026-09-28','2026-11-01');
  assert.equal(data.tasks.filter(t=>t.date==='2026-10-19').length,0);
  assert.ok(data.issues.some(i=>i.code==='recurrence-task-unavailable' && i.date==='2026-10-19' && i.workerId==='w'));
  assert.equal(buildForecastModel(data,context).ledgers[0].status,'No verificable');
  rows.recurring_task_executions[0].execution_day = null;
  rows.recurring_task_executions[0].execution_date = 'fecha no verificable';
  const uncertain = await readForecastDataset(reader(rows),context.sedeId,'2026-09-28','2026-11-01');
  assert.equal(uncertain.tasks.length,0);
  assert.equal(buildForecastModel(uncertain,context).ledgers[0].status,'No verificable');
});
test('N01: legacy execution timestamps match the calendar and do not suppress future commitments', async () => {
  const rows = tables();
  rows.tasks = [{ id: 'real', sede_id: context.sedeId, propiedad_id: hotel, cleaner_id: 'w', date: '2026-10-19', status: 'pending', type: 'limpieza-turistica', start_time: '09:30', end_time: '14:00', duracion: 270 }];
  rows.recurring_task_executions = [
    { id:'old',recurring_task_id:'r',generated_task_id:'old-task',success:true,execution_day:null,execution_date:'2026-07-13T00:00:00+00:00' },
    { id:'current',recurring_task_id:'r',generated_task_id:'real',success:true,execution_day:null,execution_date:'2026-10-18T22:00:00Z' },
  ];
  const data = await readForecastDataset(reader(rows),context.sedeId,'2026-09-28','2026-11-01');
  assert.equal(data.tasks.filter(t=>t.date==='2026-10-19').length,1);
  assert.equal(data.tasks.find(t=>t.date==='2026-10-19')?.source,'materialized');
  assert.equal(data.tasks.find(t=>t.date==='2026-10-26')?.source,'recurring');
  assert.equal(buildForecastModel(data,context).ledgers[0].future,4*270);
});
test('N01: recurrence has calendar parity across weekly/daily/monthly intervals, bounds and cancellations', async () => {
  const rows = tables(), recurrence = rows.recurring_tasks[0];
  recurrence.frequency='monthly'; recurrence.start_date='2026-08-31'; recurrence.day_of_month=31; recurrence.interval_days=1;
  let data=await readForecastDataset(reader(rows),context.sedeId,'2026-09-01','2026-10-31');
  assert.deepEqual(data.tasks.map(t=>t.date),['2026-09-30','2026-10-31']);
  recurrence.frequency='daily'; recurrence.start_date='2026-10-01'; recurrence.interval_days=2; recurrence.end_date='2026-10-05';
  data=await readForecastDataset(reader(rows),context.sedeId,'2026-09-28','2026-11-01');
  assert.deepEqual(data.tasks.map(t=>t.date),['2026-10-01','2026-10-03','2026-10-05']);
  recurrence.is_active=false;
  assert.equal((await readForecastDataset(reader(rows),context.sedeId,'2026-09-28','2026-11-01')).tasks.length,0);
});
test('N01: variable shift duration uses its registered service, tourism keeps property duration', async () => {
  const rows=tables(); rows.recurring_tasks[0].end_time='14:30'; rows.recurring_tasks[0].duracion=300;
  const data=await readForecastDataset(reader(rows),context.sedeId,'2026-09-28','2026-11-01');
  assert.equal(data.tasks.find(t=>t.date==='2026-10-19')?.minutes,300);
  assert.equal(buildForecastModel(data,context).ledgers[0].future,4*300);
});
test('N02: incomplete records and historical work do not become a reinforcement workload', () => {
  const data=dataset({workers:[],tasks:[task('missing',{minutes:NaN}),task('past',{date:'2026-09-29'}),task('impossible',{minutes:400})]});
  const c={...context,asOf:'2026-10-01T09:00'};
  const model=buildForecastModel(data,c), sim=buildForecastModel(data,c,15);
  const delta=simulationChanges(model,sim,{from:'2026-09-28',to:'2026-11-01',label:'Periodo',mode:'horizon'});
  assert.deepEqual(delta.before.map(t=>t.id),['impossible']);
  assert.deepEqual(delta.incomplete.map(t=>t.id),['missing']);
  assert.equal(delta.remaining.length,1);
});
