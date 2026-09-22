// Optional read-only replay: node scripts/forecastIncidentsReplay.mjs <private SELECT snapshot.json>
// The snapshot stays outside Git. This script calls no network or write API.
import { build } from 'esbuild';
if (!process.argv[2]) throw new Error('Indica la copia privada de las lecturas SELECT de la sede.');
const contents = String.raw`
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { readForecastDataset } from './src/features/staffing/forecastReader';
import { buildForecastModel, findCandidates } from './src/features/staffing/forecastModel';
import { taskAssessment, taskStateLabels, scopedTasks, weekScope, simulationChanges } from './src/features/staffing/forecastPresentation';
const rows = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const read = async s => (rows[s.table] ?? []).filter(r => Object.entries(s.equals ?? {}).every(([k,v]) => r[k] === v) && (!s.within || s.within.ids.includes(String(r[s.within.column]))) && (!s.since || String(r[s.since.column]) >= s.since.value) && (!s.until || String(r[s.until.column]) <= s.until.value)).slice(s.from, s.to+1);
const context = { sedeId:'1e0759ec-5e63-4edd-9dad-e493c715bbba', month:'2026-09', horizon:3, week:'2026-10-19', center:'', scenario:'known', asOf:'2026-09-22T12:00', reinforcementFrom:'2026-10-19', reinforcementTo:'2026-10-25' };
const data = await readForecastDataset(read, context.sedeId, '2026-08-31', '2026-12-06');
assert.ok(data.sources.every(s => s.status === 'ready'));
const started = performance.now();
const model = buildForecastModel(data, context), baseTime = performance.now()-started;
const sim = buildForecastModel(data, context, 15), scope = weekScope('2026-10-19'), delta = simulationChanges(model, sim, scope);
const t = model.tasks.find(t => t.id === '01f808ee-fde0-4e27-93db-3789b6896816');
assert.ok(t);
const a = taskAssessment(t, model), person = '0539c6ca-92f1-4429-acd4-46c0d13f2ea2';
const ledger = model.ledgers.find(l => l.workerId === person && l.month === '2026-10');
const commitments = date => data.tasks.filter(t => t.workerId === person && t.date === date).map(t => ({id:t.id, source:t.source, start:t.start, end:t.end, minutes:t.minutes}));
const unknown = scopedTasks(model, {from:'2026-09-01',to:'2026-11-30',mode:'horizon',label:'Septiembre–noviembre'}, 'unknown-duration');
assert.equal(ledger.future, 117*60);
assert.equal(commitments('2026-10-19').length, 1);
assert.equal(commitments('2026-10-19')[0].source, 'recurring');
assert.equal(commitments('2026-09-22').length, 1);
assert.equal(commitments('2026-09-22')[0].source, 'materialized');
const clash = {...t, id:'audit-overlap', workerId:undefined, start:NaN, end:NaN, windowStart:600, windowEnd:660};
assert.ok(!findCandidates(data, clash, model.placements, model.rests, model.ledgers, context.asOf).some(c => c.worker.id === person));
assert.equal(a.proposal?.start, 720); assert.equal(a.proposal?.end, 753);
console.log('Real weekly populations:', JSON.stringify({review:scopedTasks(model,scope,'uncovered').length,conflicts:delta.conflicts.length,withFit:delta.recordsWithFit.length,noFitBefore:delta.before.length,noFitAfter:delta.remaining.length,insufficient:delta.incomplete.length}));


assert.deepEqual(unknown.filter(t=>t.source !== 'recurring').map(t=>t.date), ['2026-09-04','2026-09-11','2026-09-18','2026-09-25']);
assert.equal(delta.conflicts.length,12); assert.equal(delta.recordsWithFit.length,11); assert.equal(delta.incomplete.length,1);
assert.equal(delta.before.length,0); assert.equal(delta.remaining.length,0);
assert.equal(unknown.filter(t=>t.source === 'recurring').length,9);
const output = {
  checkedAt:new Date().toISOString(),
  source:'SELECT de fuentes reales de la sede; lector y motor ejecutados localmente con copia privada, sin sesión de navegador',
  context, sourceCounts:Object.fromEntries(Object.entries(rows).map(([k,v])=>[k,v.length])), baseCalculationMs:Math.round(baseTime),
  N01:{ledger, october19:commitments('2026-10-19'), september22:commitments('2026-09-22'), overlappingCandidateExcluded:true},
  N02:{task:{id:t.id,date:t.date,minutes:t.minutes,start:t.start,end:t.end,windowStart:t.windowStart,windowEnd:t.windowEnd}, recordDetails:delta.conflicts.map(task=>({id:task.id,date:task.date,name:task.name,records:taskAssessment(task,sim).records,labels:taskStateLabels(task,sim)})), labels:taskStateLabels(t,model), proposal:a.proposal, proposalWorker:data.workers.find(w=>w.id===a.proposal?.workerId)?.name,
    week:{review:scopedTasks(model,scope,'uncovered').map(t=>t.id),recordConflicts:delta.conflicts.map(t=>t.id),recordsWithFit:delta.recordsWithFit.map(t=>t.id),noFitBefore:delta.before.map(t=>t.id),noFitAfter:delta.remaining.map(t=>t.id),insufficient:delta.incomplete.map(t=>t.id)}},
  N03:{unknownDuration:unknown.map(t=>({id:t.id,date:t.date,name:t.name,source:t.source,recurringId:t.recurringId})),days:[...new Set(unknown.map(t=>t.date))]}, authenticatedBrowserQA:false
};
fs.writeFileSync('docs/previsor/incidencias-datos-reales-sede.json', JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({N01:{futureHours:ledger.future/60,otherHours:ledger.other/60,status:ledger.status,october19:output.N01.october19,september22:output.N01.september22},N02:{review:output.N02.week.review.length,recordConflicts:delta.conflicts.length,recordsWithFit:delta.recordsWithFit.length,noFitBefore:delta.before.length,noFitAfter:delta.remaining.length,proposalWorker:output.N02.proposalWorker,proposal:a.proposal},N03:output.N03,baseCalculationMs:output.baseCalculationMs},null,2));
`;
const result = await build({ stdin: { contents, resolveDir: process.cwd(), loader:'ts' }, bundle:true, write:false, platform:'node', format:'esm' });
try { await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64')); }
catch (error) { console.error(error.message); process.exitCode = 1; }
