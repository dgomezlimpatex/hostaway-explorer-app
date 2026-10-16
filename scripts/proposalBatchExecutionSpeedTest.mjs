import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFileSync} from 'node:fs';

const result = await build({entryPoints:['src/utils/cleaning-planning/proposalBatchExecution.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {executeProposalBatch} = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const plan = (n, over = {}) => ({taskId:`t${n}`, cleanerIds:[`new${n}`], previousCleanerIds:[`old${n}`],
  proposedStartTime:'10:00', proposedEndTime:'11:00', previousStartTime:'09:00:00', previousEndTime:'10:00:00', ...over});
const harness = (overrides = {}) => {
  const log = [];
  let running = 0, peak = 0;
  const track = async (name, id, ms = 5) => { running += 1; peak = Math.max(peak, running); log.push([name, id]); await sleep(ms); running -= 1; };
  return {log, peak: () => peak, dependencies: {
    updateSchedule: async (id, start, end) => { await track('schedule', id); await overrides.updateSchedule?.(id, start, end); },
    setAssignments: async (id, ids) => { await track('assign', id); await overrides.setAssignments?.(id, ids); return {id, ids}; },
    revertAssignments: async (id, ids) => { log.push(['revert-assign', id, ids]); },
  }};
};

// Por defecto, una tarea detrás de otra y en el mismo orden de siempre.
const sequential = harness();
const plans = Array.from({length:6}, (_, i) => plan(i + 1));
const sequentialResults = await executeProposalBatch(plans, sequential.dependencies);
assert.equal(sequential.peak(), 1);
assert.deepEqual(sequential.log.map(([name, id]) => `${name}:${id}`),
  plans.flatMap(p => [`schedule:${p.taskId}`, `assign:${p.taskId}`]));
assert.deepEqual(sequentialResults.map(r => r.taskId), plans.map(p => p.taskId));

// Con concurrencia 4: se guardan a la vez (sin pasar de 4), todas una sola vez y los resultados salen en el orden del reparto.
const fast = harness({setAssignments: async id => { await sleep(Number(id.slice(1)) % 3 * 8); }});
const many = Array.from({length:14}, (_, i) => plan(i + 1));
const fastResults = await executeProposalBatch(many, fast.dependencies, {concurrency:4});
assert.ok(fast.peak() > 1 && fast.peak() <= 4, `Paralelismo acotado (pico ${fast.peak()})`);
assert.deepEqual(fastResults.map(r => r.taskId), many.map(p => p.taskId), 'Resultados en el orden del reparto');
assert.deepEqual(fast.log.filter(([name]) => name === 'assign').map(([, id]) => id).sort(), many.map(p => p.taskId).sort(), 'Cada tarea se guarda una vez');
assert.equal(fast.log.filter(([name]) => name === 'revert-assign').length, 0);
assert.equal((await executeProposalBatch(many.slice(0, 2), harness().dependencies, {concurrency:0})).length, 2, 'Valores raros caen a 1');
assert.equal((await executeProposalBatch([], harness().dependencies, {concurrency:4})).length, 0);

// No se reescribe un horario que la base ya tiene (con o sin segundos); si cambia, sí.
const skip = harness();
await executeProposalBatch([
  plan(1, {proposedStartTime:'09:00', proposedEndTime:'10:00'}),
  plan(2, {proposedStartTime:'09:00:00', proposedEndTime:'10:00:00'}),
  plan(3, {proposedStartTime:'09:15', proposedEndTime:'10:00'}),
  plan(4, {proposedStartTime:'09:00', proposedEndTime:'10:30'}),
], skip.dependencies);
assert.deepEqual(skip.log.filter(([name]) => name === 'schedule').map(([, id]) => id), ['t3', 't4']);
assert.deepEqual(skip.log.filter(([name]) => name === 'assign').map(([, id]) => id), ['t1', 't2', 't3', 't4'], 'Las asignaciones se guardan siempre');

// Fallo a mitad con concurrencia: no se empiezan tareas nuevas, las que estaban en marcha terminan y todo lo intentado se deshace sin avisos.
const failing = harness({setAssignments: async id => { if (id === 't5') throw new Error('falla t5'); }});
const batch = Array.from({length:12}, (_, i) => plan(i + 1));
await assert.rejects(() => executeProposalBatch(batch, failing.dependencies, {concurrency:3}), /falla t5/);
const started = new Set(failing.log.filter(([name]) => name === 'schedule').map(([, id]) => id));
const assigned = new Set(failing.log.filter(([name]) => name === 'assign').map(([, id]) => id));
const reverted = failing.log.filter(([name]) => name === 'revert-assign');
const rescheduled = failing.log.filter(([name], index) => name === 'schedule' && index > failing.log.findIndex(([n]) => n === 'revert-assign'));
assert.ok(started.size < batch.length, 'Tras el fallo no se empieza el resto');
assert.deepEqual(new Set(reverted.map(([, id]) => id)), assigned, 'Se deshace toda asignación intentada');
assert.ok(reverted.every(([, id, ids]) => ids[0] === `old${id.slice(1)}`), 'Vuelven a su responsable anterior');
assert.deepEqual(new Set(rescheduled.map(([, id]) => id)), started, 'Se restaura el horario de toda tarea cuyo horario se escribió');
const lastAssignIndex = failing.log.reduce((last, [name], index) => name === 'assign' ? index : last, -1);
assert.ok(failing.log.findIndex(([name]) => name === 'revert-assign') > lastAssignIndex, 'Se deshace cuando ya no hay tareas en marcha');

// Si falla el horario, esa tarea no llega a asignarse y solo se restaura su horario.
const scheduleFails = harness({updateSchedule: async id => { if (id === 't2') throw new Error('falla horario'); }});
await assert.rejects(() => executeProposalBatch([plan(1), plan(2), plan(3)], scheduleFails.dependencies), /falla horario/);
assert.ok(!scheduleFails.log.some(([name, id]) => name === 'assign' && id === 't2'));
assert.ok(scheduleFails.log.some(([name, id]) => name === 'revert-assign' && id === 't1'));
assert.ok(!scheduleFails.log.some(([name, id]) => name === 'revert-assign' && id === 't2'));

// Un horario incompleto se rechaza igual que antes.
await assert.rejects(() => executeProposalBatch([plan(1, {proposedEndTime:undefined})], harness().dependencies), /horario propuesto completo/);

// La app usa la concurrencia acotada.
assert.match(readFileSync('src/hooks/useCleaningPlanningActions.ts', 'utf8'), /\}, \{ concurrency: 4 \}\);/);
console.log('PASS: guardado del reparto en paralelo acotado, orden de resultados, horarios sin cambios omitidos y deshacer completo ante fallos');
