import assert from 'node:assert/strict';
import { build } from 'esbuild';

// The indexed slot check must answer exactly like the original per-slot scan.
// Real helpers, deterministic random fixtures; no network.
const built = await build({
  entryPoints: ['src/utils/taskPositioning.ts'], bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'silent', metafile: true,
});
assert.equal(Object.keys(built.metafile.inputs).some(path => path.includes('integrations/supabase')), false);
const m = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));

let seed = 42;
const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = list => list[Math.floor(random() * list.length)];
const pad = n => String(n).padStart(2, '0');
const cleaners = [{ id: 'c1', name: 'Ana Prueba' }, { id: 'c2', name: 'Berta Prueba' }, { id: 'c3', name: 'Carmen' }, { id: 'c4', name: 'Dora' }];
const slots = [];
for (let h = 6; h <= 22; h++) for (const min of [0, 30]) if (h < 22 || min === 0) slots.push([h, min]);

for (let round = 0; round < 40; round++) {
  const tasks = Array.from({ length: 25 }, (_, i) => {
    const start = 6 * 60 + Math.floor(random() * 28) * 30 + pick([0, 15]);
    const duration = pick([30, 45, 60, 90, 120, 180, 240]);
    const owner = pick(cleaners);
    const task = { id: `t${round}-${i}`, date: '2026-10-06', startTime: `${pad(Math.floor(start / 60))}:${pad(start % 60)}`,
      endTime: `${pad(Math.min(23, Math.floor((start + duration) / 60)))}:${pad((start + duration) % 60)}`, propertyDurationMinutes: duration };
    const kind = pick(['id', 'name', 'names', 'list', 'shared']);
    if (kind === 'id') task.cleanerId = owner.id;
    if (kind === 'name') task.cleaner = owner.name.toLowerCase();
    if (kind === 'names') task.cleaner = `${owner.name}, ${pick(cleaners).name}`;
    if (kind === 'list') task.assignments = [{ cleaner_id: owner.id }];
    if (kind === 'shared') { task.assignments = [{ cleaner_id: owner.id }, { cleaner_id: pick(cleaners).id }]; task.assignmentCount = 2; }
    return task;
  });
  const assignmentsMap = Object.fromEntries(tasks.filter(t => t.assignments).map(t => [t.id, t.assignments.map(a => a.cleaner_id)]));
  const exclude = round % 3 === 0 ? tasks[round % tasks.length].id : undefined;
  const indexed = m.buildTimeSlotOccupancy(tasks, cleaners, exclude, assignmentsMap);
  for (const cleaner of [...cleaners, { id: 'unknown', name: 'Nadie' }]) {
    for (const [h, min] of slots) {
      assert.equal(indexed(cleaner.id, h, min), m.isTimeSlotOccupied(cleaner.id, h, min, tasks, cleaners, exclude, assignmentsMap),
        `round ${round} ${cleaner.id} ${h}:${min}`);
    }
  }
}
// The dragged task never blocks its own slots.
const task = { id: 'drag', startTime: '09:00', endTime: '10:00', cleanerId: 'c1' };
assert.equal(m.buildTimeSlotOccupancy([task], cleaners)('c1', 9, 30), true);
assert.equal(m.buildTimeSlotOccupancy([task], cleaners, 'drag')('c1', 9, 30), false);
console.log('calendar-slot-occupancy: OK (indexed check identical to the per-slot scan in 40 random rounds; no network)');
