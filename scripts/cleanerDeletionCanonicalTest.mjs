import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (path) => readFileSync(join(process.cwd(), path), 'utf8');
const cleanersHook = read('src/hooks/useCleaners.ts');
const workersList = read('src/components/workers/WorkersList.tsx');

assert.doesNotMatch(
  cleanersHook,
  /export const useDeleteCleaner/,
  'la eliminación física legacy no debe seguir exportada desde el frontend',
);
assert.doesNotMatch(
  cleanersHook,
  /\.from\(['"]task_assignments['"]\)[\s\S]{0,160}?\.delete\(\)/,
  'el frontend no debe borrar asignaciones directamente',
);
assert.doesNotMatch(
  workersList,
  /Eliminar definitivamente|Eliminar trabajador/,
  'la UI debe usar la baja transaccional y no prometer borrado físico',
);
assert.match(
  workersList,
  /DeactivateWorkerDialog/,
  'la baja segura debe permanecer disponible',
);

console.log('cleaner-deletion-canonical-tests: OK');
