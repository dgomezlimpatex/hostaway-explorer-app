import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (path) => readFileSync(join(process.cwd(), path), 'utf8');
const cleanersHook = read('src/hooks/useCleaners.ts');
const workersList = read('src/components/workers/WorkersList.tsx');
const attemptMigration = read('supabase/migrations/20260721152000_add_whatsapp_attempt_history_and_recipient_snapshot.sql');
const sender = read('supabase/functions/send-whatsapp-notification/index.ts');

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
assert.match(
  attemptMigration,
  /enqueue_deleted_cleaner_cancellations[\s\S]*?VALUES\s*\([\s\S]*?'task_cancelled'\s*,\s*'tasks'\s*,\s*task_row\.id\s*,\s*NULL\s*,\s*NULL/i,
  'el hard-delete de cleaner no debe adquirir FKs task/cleaner al insertar la cancelación',
);
assert.match(
  attemptMigration,
  /recipient_worker_id[\s\S]{0,500}OLD\.id/i,
  'la identidad del destinatario borrado debe preservarse fuera de la FK cleaner_id',
);
assert.match(sender, /event\.snapshot\?\.recipient/);
assert.match(sender, /event\.snapshot\?\.task/);

console.log('cleaner-deletion-canonical-tests: OK');
