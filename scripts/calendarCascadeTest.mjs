import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Runs the real cascade helpers with local fixtures and fake persistence: no
// database, session, email or network.
const built = await build({
  entryPoints: ['src/utils/calendarCascade.ts'], bundle: true, write: false,
  platform: 'node', format: 'esm', logLevel: 'silent', metafile: true,
});
assert.equal(Object.keys(built.metafile.inputs).some((path) => path.includes('integrations/supabase')), false);
const m = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));

const task = (id, startTime, endTime, extra = {}) => ({
  id, startTime, endTime, date: '2026-10-06', property: `Piso ${id}`, address: '', type: 'limpieza',
  status: 'pending', checkIn: '', checkOut: '', cleanerId: 'c1', cleaner: 'Ana Prueba', ...extra,
});
const drop = (startTime, endTime, extra = {}) => ({
  taskId: 'dropped', date: '2026-10-06', startTime, endTime, cleanerId: 'c1', cleanerName: 'Ana Prueba', ...extra,
});
const moves = (result) => (assert.equal(result.ok, true), result.shifts.map((s) => [s.taskId, s.newStartTime, s.newEndTime]));

// Regression: a task fully inside the dropped range used to stay overlapped.
assert.deepEqual(moves(m.computeCascadeShifts([task('inside', '10:30', '10:45')], drop('10:00', '11:00'))),
  [['inside', '11:00', '11:15']]);
// Regression: a task that started before and ended inside the dropped range.
assert.deepEqual(moves(m.computeCascadeShifts([task('before', '09:00', '10:30')], drop('10:00', '11:00'))),
  [['before', '11:00', '12:30']]);
// Overlapping the end keeps working, and the chain continues.
assert.deepEqual(moves(m.computeCascadeShifts([
  task('a', '10:30', '11:30'), task('b', '11:30', '12:00'), task('free', '14:00', '15:00'),
], drop('10:00', '11:00'))), [['a', '11:00', '12:00'], ['b', '12:00', '12:30']]);
// Tasks that end before the dropped start, or start after the chain, stay.
assert.deepEqual(moves(m.computeCascadeShifts([task('early', '08:00', '10:00'), task('late', '11:00', '12:00')], drop('10:00', '11:00'))), []);
// Other cleaners, other days and the dropped task itself are ignored.
assert.deepEqual(moves(m.computeCascadeShifts([
  task('other-cleaner', '10:00', '11:00', { cleanerId: 'c2', cleaner: 'Berta' }),
  task('other-day', '10:00', '11:00', { date: '2026-10-07' }),
  task('dropped', '10:00', '11:00'),
], drop('10:00', '11:00'))), []);
// Assignment list and legacy name both identify the cleaner.
assert.deepEqual(moves(m.computeCascadeShifts([
  task('by-list', '10:15', '10:45', { cleanerId: undefined, cleaner: undefined, assignments: [{ cleaner_id: 'c1' }] }),
], drop('10:00', '11:00'))), [['by-list', '11:00', '11:30']]);
// Multi-worker task: only the per-person share counts and moves.
assert.deepEqual(moves(m.computeCascadeShifts([
  task('shared', '08:00', '12:00', { assignments: [{ cleaner_id: 'c1' }, { cleaner_id: 'c2' }] }),
], drop('10:00', '11:00'))), [], 'shared 08:00-10:00 per person ends before the drop');
assert.deepEqual(moves(m.computeCascadeShifts([
  task('shared', '09:00', '13:00', { assignments: [{ cleaner_id: 'c1' }, { cleaner_id: 'c2' }] }),
], drop('10:00', '11:00'))), [['shared', '11:00', '13:00']]);
// Never past 23:59.
assert.deepEqual(m.computeCascadeShifts([task('night', '22:30', '23:30')], drop('22:00', '23:00')),
  { ok: false, shifts: [], blockedBy: 'Piso night' });

// Persistence: real tasks are updated, virtual recurring ones materialized.
const recurring = task('recurring_tpl_2026-10-06', '10:30', '11:00', { isRecurringInstance: true, recurringTaskId: 'tpl' });
const real = task('real', '10:45', '11:15');
const calls = [];
const persistence = (rows = 1) => ({
  updateTaskTimes: async (...args) => { calls.push(['update', ...args]); return rows; },
  materializeRecurring: async (t, ...args) => { calls.push(['materialize', t.id, ...args]); },
});
const result = m.computeCascadeShifts([recurring, real], drop('10:00', '11:00'));
const saved = await m.persistCascadeShifts(result.shifts, [recurring, real], persistence());
assert.deepEqual(calls, [
  ['materialize', 'recurring_tpl_2026-10-06', '11:00', '11:30'],
  ['update', 'real', '11:30', '12:00'],
]);
assert.equal(saved.length, 2);
// An update that changes no row is not reported as saved (no phantom email).
calls.length = 0;
await assert.rejects(m.persistCascadeShifts([result.shifts[1]], [real], persistence(0)), /No se pudo mover "Piso real"/);
await assert.rejects(m.persistCascadeShifts([result.shifts[0]], [recurring], {
  ...persistence(), materializeRecurring: async () => { throw new Error('fallo local'); },
}), /fallo local/);

assert.equal(m.fromMinutes(m.toMinutes('09:05')), '09:05');
console.log('calendar-cascade: OK (contained/earlier/later overlaps, chain, cleaners, shared tasks, 23:59 limit, recurring persistence, zero-row updates; no network)');
