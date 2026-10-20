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
const fixedIds = (result) => result.fixed.map((f) => [f.taskId, f.status]);

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
// Multi-worker task: only the per-person share counts for the overlap.
assert.deepEqual(moves(m.computeCascadeShifts([
  task('shared', '08:00', '12:00', { assignments: [{ cleaner_id: 'c1' }, { cleaner_id: 'c2' }] }),
], drop('10:00', '11:00'))), [], 'shared 08:00-10:00 per person ends before the drop');
// CAL-02 (Dani, 20/10/2026): a shifted shared task keeps its whole service
// window (4 h), so nobody's planned hours shrink. The old rule saved 11:00-13:00.
assert.deepEqual(moves(m.computeCascadeShifts([
  task('shared', '09:00', '13:00', { assignments: [{ cleaner_id: 'c1' }, { cleaner_id: 'c2' }] }),
], drop('10:00', '11:00'))), [['shared', '11:00', '15:00']]);
// ...and the next task of this cleaner only waits for her share (2 h).
assert.deepEqual(moves(m.computeCascadeShifts([
  task('shared', '09:00', '13:00', { assignments: [{ cleaner_id: 'c1' }, { cleaner_id: 'c2' }] }),
  task('after', '12:30', '13:30'),
], drop('10:00', '11:00'))), [['shared', '11:00', '15:00'], ['after', '13:00', '14:00']]);
// CAL-02: started or finished work is never moved; it is reported and the
// chain continues after it, so no shifted task lands on top of it.
const withFixed = m.computeCascadeShifts([
  task('running', '10:30', '11:30', { status: 'in-progress' }),
  task('next', '11:15', '12:00'),
], drop('10:00', '11:00'));
assert.deepEqual(moves(withFixed), [['next', '11:30', '12:15']]);
assert.deepEqual(fixedIds(withFixed), [['running', 'in-progress']]);
// The displayed status (from reports) decides, like everywhere in the calendar.
assert.deepEqual(fixedIds(m.computeCascadeShifts([
  task('reported', '10:30', '11:00', { status: 'pending', calendarStatus: 'completed' }),
], drop('10:00', '11:00'))), [['reported', 'completed']]);
assert.deepEqual(moves(m.computeCascadeShifts([
  task('report-pending', '10:30', '11:00', { status: 'completed', calendarStatus: 'pending' }),
], drop('10:00', '11:00'))), [['report-pending', '11:00', '11:30']]);
// Cancelled tasks never conflict.
const cancelled = m.computeCascadeShifts([task('cancelled', '10:30', '11:00', { status: 'cancelled' })], drop('10:00', '11:00'));
assert.deepEqual([moves(cancelled), cancelled.fixed], [[], []]);
// Never past 23:59 (also for the whole window of a shared task).
assert.deepEqual(m.computeCascadeShifts([task('night', '22:30', '23:30')], drop('22:00', '23:00')),
  { ok: false, shifts: [], fixed: [], blockedBy: 'Piso night' });
assert.equal(m.computeCascadeShifts([
  task('late-shared', '20:30', '23:30', { assignments: [{ cleaner_id: 'c1' }, { cleaner_id: 'c2' }] }),
], drop('20:00', '21:00')).ok, false, 'a 3 h shared window cannot end after 23:59');

// Persistence: real tasks are updated, virtual recurring ones materialized.
const recurring = task('recurring_tpl_2026-10-06', '10:30', '11:00', { isRecurringInstance: true, recurringTaskId: 'tpl' });
const real = task('real', '10:45', '11:15');
const calls = [];
const persistence = (rows = 1) => ({
  updateTaskTimes: async (id, start, end, expected) => { calls.push(['update', id, start, end, expected]); return rows; },
  materializeRecurring: async (t, ...args) => { calls.push(['materialize', t.id, ...args]); },
});
const result = m.computeCascadeShifts([recurring, real], drop('10:00', '11:00'));
const saved = await m.persistCascadeShifts(result.shifts, [recurring, real], persistence());
assert.deepEqual(calls, [
  ['materialize', 'recurring_tpl_2026-10-06', '11:00', '11:30'],
  // The write is conditioned on the times seen in the preview.
  ['update', 'real', '11:30', '12:00', { startTime: '10:45', endTime: '11:15' }],
]);
assert.equal(saved.length, 2);
// An update that changes no row is not reported as saved (no phantom email).
calls.length = 0;
await assert.rejects(m.persistCascadeShifts([result.shifts[1]], [real], persistence(0)), /No se pudo mover "Piso real": ha cambiado mientras tanto/);
await assert.rejects(m.persistCascadeShifts([result.shifts[0]], [recurring], {
  ...persistence(), materializeRecurring: async () => { throw new Error('fallo local'); },
}), /fallo local/);

// CAL-03: settled persistence reports each shift; a partial failure can be
// reverted for stored tasks (materialized recurring ones are only reported).
calls.length = 0;
const twoReal = [task('r1', '10:30', '11:00'), task('r2', '11:00', '11:30')];
const twoShifts = m.computeCascadeShifts(twoReal, drop('10:00', '11:00')).shifts;
const settled = await m.persistCascadeShiftsSettled(twoShifts, twoReal, {
  updateTaskTimes: async (id, start, end, expected) => { calls.push(['update', id, start, end, expected]); if (id === 'r2') throw new Error('red caída'); return 1; },
  materializeRecurring: async () => {},
});
assert.deepEqual(settled.saved.map((s) => s.taskId), ['r1']);
assert.deepEqual(settled.failed.map((f) => [f.shift.taskId, f.error.message]), [['r2', 'red caída']]);
calls.length = 0;
const reverted = await m.revertCascadeShifts([...settled.saved, result.shifts[0]], [...twoReal, recurring], persistence());
assert.deepEqual(calls, [['update', 'r1', '10:30', '11:00', { startTime: '11:00', endTime: '11:30' }]],
  'only the stored task goes back, and only if it still has the times this cascade wrote');
assert.deepEqual([reverted.reverted.map((s) => s.taskId), reverted.notReverted.map((s) => s.taskId)], [['r1'], ['recurring_tpl_2026-10-06']]);

// Someone changed (or started) the task in between: the compensation changes
// 0 rows, never overwrites it, and reports it for manual review.
const concurrent = await m.revertCascadeShifts(settled.saved, twoReal, { updateTaskTimes: async () => 0 });
assert.deepEqual([concurrent.reverted, concurrent.notReverted.map((s) => s.taskId)], [[], ['r1']]);

assert.equal(m.fromMinutes(m.toMinutes('09:05')), '09:05');
console.log('calendar-cascade: OK (contained/earlier/later overlaps, chain, cleaners, shared tasks keep their window, started/finished fixed, cancelled ignored, 23:59 limit, recurring persistence, zero-row updates, partial failure revert; no network)');
