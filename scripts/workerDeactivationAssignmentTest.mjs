import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const hook = await readFile(
  new URL('../src/hooks/useDeactivateCleaner.ts', import.meta.url),
  'utf8',
);
const dialog = await readFile(
  new URL('../src/components/workers/DeactivateWorkerDialog.tsx', import.meta.url),
  'utf8',
);
const workerDetail = await readFile(
  new URL('../src/components/workers/WorkerDetailModal.tsx', import.meta.url),
  'utf8',
);
const atomicMigration = await readFile(
  new URL('../supabase/migrations/20260718225000_atomic_cleaner_deactivation.sql', import.meta.url),
  'utf8',
);
const hardeningMigration = await readFile(
  new URL('../supabase/migrations/20260718230500_harden_cleaner_deactivation_permissions.sql', import.meta.url),
  'utf8',
);
const migrationsUrl = new URL('../supabase/migrations/', import.meta.url);
const migrationFiles = (await readdir(migrationsUrl)).filter((name) => name.endsWith('.sql'));
const allMigrations = (await Promise.all(
  migrationFiles.map((name) => readFile(new URL(name, migrationsUrl), 'utf8')),
)).join('\n');
const migration = `${atomicMigration}\n${hardeningMigration}`;

assert.match(hook, /rpcUntyped\('get_future_pending_tasks_for_cleaner'/);
assert.match(hook, /rpcUntyped\('deactivate_cleaner_with_future_assignments'/);
assert.doesNotMatch(hook, /\.from\('task_assignments'\)/);
assert.doesNotMatch(hook, /setTaskAssignments/);

assert.match(migration, /CREATE OR REPLACE FUNCTION public\.deactivate_cleaner_with_future_assignments/);
assert.match(migration, /FROM public\.cleaners[\s\S]*FOR UPDATE/);
assert.match(migration, /DELETE FROM public\.task_assignments[\s\S]*cleaner_id = _cleaner_id/);
assert.match(migration, /UPDATE public\.cleaners[\s\S]*is_active = false/);
assert.match(migration, /c\.is_active = true/);
assert.match(migration, /v_valid_cleaner_count <> cardinality\(v_ids\)/);
assert.match(migration, /user_is_admin_or_manager\(\)/);
assert.match(hardeningMigration, /has_role\(auth\.uid\(\), 'supervisor'\)/);
assert.match(hardeningMigration, /get_user_accessible_sedes\(\)/);
assert.match(hardeningMigration, /REVOKE ALL ON FUNCTION public\.set_task_assignments\(uuid, uuid\[\]\) FROM PUBLIC, anon/);
assert.match(hardeningMigration, /REVOKE ALL ON FUNCTION public\.get_future_pending_tasks_for_cleaner\(uuid\) FROM PUBLIC, anon/);
assert.match(hardeningMigration, /legacy-deactivation:', v_cleaner\.activation_cycle_id::text/);
assert.match(hardeningMigration, /cleaners_rotate_activation_cycle/);

// La ficha nunca puede desactivar con un update genérico: debe abrir el flujo seguro.
assert.match(workerDetail, /DeactivateWorkerDialog/);
assert.match(workerDetail, /setDeactivateOpen\(true\)/);
assert.doesNotMatch(workerDetail, /updates:\s*\{[\s\S]{0,500}isActive:\s*formData\.isActive/);

// Un fallo al previsualizar tareas debe ser visible y bloquear la baja.
assert.match(dialog, /isError:\s*previewFailed/);
assert.match(dialog, /No se pudieron comprobar las tareas pendientes/);
assert.match(dialog, /disabled=\{deactivate\.isPending \|\| loadingTasks \|\| previewFailed\}/);
assert.match(dialog, /unassignFutureTasks:\s*true/);

// Defensa de base de datos: ninguna ruta futura puede inactivar dejando trabajo pendiente.
assert.match(allMigrations, /prevent_cleaner_deactivation_with_future_tasks/);
assert.match(allMigrations, /BEFORE UPDATE OF is_active ON public\.cleaners/);
assert.match(allMigrations, /No se puede desactivar.*tareas futuras pendientes/);

console.log('worker-deactivation-assignment-contract-tests: OK');
