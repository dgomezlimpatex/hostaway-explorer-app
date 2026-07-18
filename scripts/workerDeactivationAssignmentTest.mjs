import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const hook = await readFile(
  new URL('../src/hooks/useDeactivateCleaner.ts', import.meta.url),
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

console.log('worker-deactivation-assignment-contract-tests: OK');
