import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (path) => readFileSync(join(process.cwd(), path), 'utf8');
const migration = read('supabase/migrations/20260721130000_transactional_canonical_assignment_writers.sql');
const batch = read('supabase/functions/batch-create-tasks/index.ts');
const ai = read('supabase/functions/apply-ai-actions/index.ts');
const autoEdge = read('supabase/functions/auto-assign-tasks/index.ts');
const autoFrontend = read('src/services/autoAssignment/databaseService.ts');
const engine = read('src/services/autoAssignment/autoAssignmentEngine.ts');
const planning = read('src/services/planning/operationalPlanningService.ts');
const useTasks = read('src/hooks/useTasks.ts');
const bulkAuto = read('src/components/tasks/components/BulkAutoAssignButton.tsx');

for (const signature of [
  'batch_create_tasks_transactional',
  'apply_ai_actions_transactional',
  'auto_assign_task_transactional',
]) {
  assert.match(migration, new RegExp(`CREATE OR REPLACE FUNCTION public\\.${signature}`));
  assert.match(migration, new RegExp(`REVOKE ALL ON FUNCTION public\\.${signature}`));
}
assert.match(migration, /SECURITY DEFINER[\s\S]*SET search_path = public, pg_temp/);
assert.match(migration, /FOR UPDATE[\s\S]*RAISE EXCEPTION/);
assert.match(migration, /worker_absences/);
assert.match(migration, /worker_fixed_days_off/);
assert.match(migration, /worker_maintenance_cleanings/);
assert.match(migration, /cleaner_availability/);
assert.match(migration, /auto_assignment_logs/);
assert.match(migration, /ai_action_audit_logs/);
assert.match(migration, /notification_events/);
assert.match(migration, /batch_task_creation_requests/);
assert.match(migration, /batch_task_email_deliveries/);
assert.match(migration, /_idempotency_key text/);
assert.match(migration, /_payload_hash text/);
assert.match(migration, /jsonb_array_elements\(v_proposal\.actions\)[\s\S]*ORDER BY ids\.task_id[\s\S]*FOR UPDATE/);
assert.match(migration, /existing\.cleaner_id/);
assert.match(
  migration,
  /SELECT \* INTO v_task FROM public\.tasks WHERE id = _task_id FOR UPDATE;[\s\S]*ORDER BY c\.id[\s\S]*FOR UPDATE OF c;[\s\S]*FROM public\.properties p[\s\S]*FOR KEY SHARE;[\s\S]*FROM public\.property_group_assignments pga[\s\S]*FOR UPDATE;[\s\S]*FROM public\.property_groups pg[\s\S]*FOR UPDATE;/,
);
assert.match(migration, /v_all_cleaner_ids[\s\S]*ORDER BY c\.id[\s\S]*FOR KEY SHARE/);
assert.match(migration, /user_has_sede_access|get_user_accessible_sedes/);
assert.match(migration, /ERRCODE = '42501'/);

assert.match(batch, /assertAdminManagerOrServiceRole/);
assert.match(batch, /actor\.kind !== 'user'/);
assert.match(batch, /\.rpc\('batch_create_tasks_transactional'/);
assert.doesNotMatch(batch, /\.from\(['"]tasks['"]\)[\s\S]*\.insert\(/);
assert.doesNotMatch(batch, /task\.cleanerEmail|task\.cleanerName|task\.cleanerEmails|task\.cleanerNames/);
assert.match(batch, /batch\.cleanerName/);
assert.match(batch, /if \(rpcError\)/);
assert.match(batch, /, 500\);/);
assert.match(batch, /emailBatches/);
assert.match(batch, /emailResponse\.error/);
assert.match(batch, /idempotencyKey/);
assert.match(batch, /idempotency_key/);
assert.match(batch, /batch_task_email_deliveries/);
assert.match(batch, /idempotencyKey: delivery\.idempotency_key/);

assert.match(ai, /\.rpc\("apply_ai_actions_transactional"/);
assert.doesNotMatch(ai, /for \(const rawAction of actions\)/);
assert.doesNotMatch(ai, /\.from\("tasks"\)[\s\S]*\.(?:insert|update|delete)\(/);
assert.match(ai, /if \(rpcError\)/);
assert.match(ai, /already_applied/);

assert.match(autoEdge, /assertAdminManagerOrServiceRole/);
assert.match(autoEdge, /\.rpc\('auto_assign_task_transactional'/);
assert.doesNotMatch(autoEdge, /\.from\('tasks'\)[\s\S]*\.update\(/);
assert.doesNotMatch(autoEdge, /set_task_assignments/);
assert.doesNotMatch(autoEdge, /failedCount > 0 \? 409/);
assert.match(autoEdge, /partial: assigned > 0 && failedCount > 0/);

assert.doesNotMatch(useTasks, /Bearer eyJ/);
assert.match(useTasks, /supabase\.auth\.getSession\(\)/);
assert.match(useTasks, /idempotencyKey/);
assert.match(useTasks, /localStorage\.getItem\(idempotencyStorageKey\)/);
assert.match(useTasks, /estado es incierto/);
assert.match(useTasks, /tasksCommitted/);
assert.match(useTasks, /refetchQueries/);
assert.match(bulkAuto, /data\?\.summary/);
assert.match(bulkAuto, /assigned > 0/);
assert.match(bulkAuto, /onAssignmentComplete\(\)/);

assert.match(autoFrontend, /\.rpc\('auto_assign_task_transactional'/);
assert.doesNotMatch(autoFrontend, /set_task_assignments/);
assert.doesNotMatch(autoFrontend, /\.from\('tasks'\)[\s\S]*\.update\(/);
assert.doesNotMatch(autoFrontend, /\.from\('auto_assignment_logs'\)[\s\S]*\.insert\(/);
assert.doesNotMatch(engine, /logAssignment\(/);

// Esta rama no debe fingir atomicidad en el bucle legacy de planning.
assert.doesNotMatch(planning, /const \{ error: assignmentError \} = await rpcUntyped\('set_task_assignments'/);

console.log('canonical-assignment-writers-contract: OK');
