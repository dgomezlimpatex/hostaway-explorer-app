import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const hook = await readFile(new URL('../src/hooks/useInlineFieldSave.ts', import.meta.url), 'utf8');

const snapshotIndex = hook.indexOf('const originalTaskBeforeOptimisticUpdate');
const optimisticPatchIndex = hook.indexOf('queryClient.setQueriesData');

assert.ok(
  snapshotIndex >= 0,
  'La edición inline debe capturar la tarea original antes de aplicar el parche optimista',
);
assert.ok(
  optimisticPatchIndex >= 0 && snapshotIndex < optimisticPatchIndex,
  'La captura original debe ocurrir antes de queryClient.setQueriesData',
);
assert.match(
  hook,
  /updateTaskSchedule\(taskId, updates, originalTaskBeforeOptimisticUpdate\)/,
  'updateTaskSchedule debe recibir la instantánea anterior, no la caché ya modificada',
);

console.log('whatsapp-schedule-modification-tests: OK');
