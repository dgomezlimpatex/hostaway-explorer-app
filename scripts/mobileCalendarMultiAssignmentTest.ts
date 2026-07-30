import assert from 'node:assert/strict';
import {
  buildTaskAssignmentsMap,
  canCleanerAccessTaskByAssignments,
  countTasksByAssignedCleaner,
  getTaskAssignedCleanerIds,
  isTaskAssignedToCleaner,
  parseTaskAssignmentCounts,
} from '../src/utils/taskAssignments';

const daianeId = 'daiane';
const cristianId = 'cristian';
const vicenteId = 'vicente';

const lugarSas = {
  id: 'lugar-sas',
  cleanerId: daianeId,
  cleaner: 'DAIANE, CRISTIAN, VICENTE',
  assignments: [
    { cleaner_id: daianeId },
    { cleaner_id: cristianId },
    { cleaner_id: vicenteId },
  ],
};

const prioral = {
  id: 'prioral',
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

const staleLegacyAssignment = {
  id: 'stale-legacy',
  cleanerId: daianeId,
  cleaner: 'DAIANE',
  assignments: [{ cleaner_id: cristianId }],
};
assert.equal(
  isTaskAssignedToCleaner(staleLegacyAssignment as never, daianeId),
  false,
  'Una asignación canónica distinta debe prevalecer sobre cleanerId legacy obsoleto',
);
assert.equal(
  isTaskAssignedToCleaner(staleLegacyAssignment as never, cristianId),
  true,
  'La limpiadora canónica sí debe conservar la tarea',
);

assert.deepEqual(
  getTaskAssignedCleanerIds({ cleanerId: daianeId }),
  [daianeId],
  'Las tareas antiguas sin assignments deben seguir usando cleanerId',
);

assert.deepEqual(
  buildTaskAssignmentsMap([
    lugarSas,
    prioral,
    { id: 'legacy-task', cleanerId: daianeId },
  ] as never[]),
  {
    'lugar-sas': [daianeId, cristianId, vicenteId],
    prioral: [daianeId, cristianId, vicenteId],
    'legacy-task': [daianeId],
  },
  'El calendario debe reutilizar asignaciones múltiples y mantener tareas antiguas',
);

assert.equal(
  canCleanerAccessTaskByAssignments({
    visibleCanonicalCleanerIds: [],
    canonicalAssignmentCount: 1,
    legacyCleanerId: daianeId,
  }, daianeId),
  false,
  'RLS no debe convertir una asignación canónica oculta en un fallback legacy',
);
assert.equal(
  canCleanerAccessTaskByAssignments({
    visibleCanonicalCleanerIds: [],
    canonicalAssignmentCount: 0,
    legacyCleanerId: daianeId,
  }, daianeId),
  true,
  'Una tarea realmente legacy sin filas canónicas debe conservarse',
);
assert.equal(
  canCleanerAccessTaskByAssignments({
    visibleCanonicalCleanerIds: [daianeId],
    canonicalAssignmentCount: 2,
    legacyCleanerId: daianeId,
  }, daianeId),
  true,
  'Una multioperaria debe ver la tarea cuando su propia fila canónica es visible',
);

assert.deepEqual(
  Array.from(parseTaskAssignmentCounts([
    { task_id: 'task-a', assignment_count: 2 },
  ], ['task-a', 'task-legacy']).entries()),
  [['task-a', 2]],
  'El parser debe conservar conteos canónicos válidos y permitir que una tarea sin fila represente cero asignaciones',
);

for (const invalidRows of [
  [{ task_id: 'task-a' }],
  [{ task_id: 'task-a', assignment_count: null }],
  [{ task_id: 'task-a', assignment_count: '1' }],
  [{ assignment_count: 1 }],
  [{ task_id: 'task-a', assignment_count: 0 }],
  [{ task_id: 'task-a', assignment_count: 1.5 }],
  [{ task_id: 'task-a', assignment_count: 1 }, { task_id: 'task-a', assignment_count: 1 }],
  [{ task_id: 'task-outside-request', assignment_count: 1 }],
  [null],
] as unknown[][]) {
  assert.throws(
    () => parseTaskAssignmentCounts(invalidRows, ['task-a']),
    'Una respuesta RPC malformada, duplicada o ajena debe fallar cerrada',
  );
}

console.log('Mobile calendar multi-assignment regression test passed');