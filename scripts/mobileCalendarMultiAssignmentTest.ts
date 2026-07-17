import assert from 'node:assert/strict';
import {
  countTasksByAssignedCleaner,
  getTaskAssignedCleanerIds,
  isTaskAssignedToCleaner,
} from '../src/utils/taskAssignments';

const daianeId = 'daiane';
const cristianId = 'cristian';
const vicenteId = 'vicente';

const lugarSas = {
  cleanerId: daianeId,
  cleaner: 'DAIANE, CRISTIAN, VICENTE',
  assignments: [
    { cleaner_id: daianeId },
    { cleaner_id: cristianId },
    { cleaner_id: vicenteId },
  ],
};

const prioral = {
  cleanerId: daianeId,
  cleaner: 'DAIANE, CRISTIAN, VICENTE',
  assignments: [
    { cleaner_id: daianeId },
    { cleaner_id: cristianId },
    { cleaner_id: vicenteId },
  ],
};

assert.deepEqual(
  getTaskAssignedCleanerIds(lugarSas as never),
  [daianeId, cristianId, vicenteId],
  'La tarea debe conservar todas las asignaciones, no solo cleanerId',
);

const counts = countTasksByAssignedCleaner([lugarSas, prioral] as never[]);
assert.equal(counts.get(daianeId), 2);
assert.equal(counts.get(cristianId), 2);
assert.equal(counts.get(vicenteId), 2);

assert.equal(isTaskAssignedToCleaner(lugarSas as never, cristianId), true);
assert.equal(isTaskAssignedToCleaner(lugarSas as never, vicenteId), true);
assert.equal(isTaskAssignedToCleaner(lugarSas as never, 'otro'), false);

assert.deepEqual(
  getTaskAssignedCleanerIds({ cleanerId: daianeId }),
  [daianeId],
  'Las tareas antiguas sin assignments deben seguir usando cleanerId',
);

console.log('Mobile calendar multi-assignment regression test passed');