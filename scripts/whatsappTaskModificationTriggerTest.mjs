import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(
  new URL('../supabase/migrations/20260723141226_notify_only_schedule_task_modifications.sql', import.meta.url),
  'utf8',
);
const assignmentService = await readFile(
  new URL('../src/services/storage/taskAssignmentService.ts', import.meta.url),
  'utf8',
);

assert.match(migration, /CREATE OR REPLACE FUNCTION public\.enqueue_task_modified_notifications\(\)/);
assert.match(migration, /ROW\(OLD\.date, OLD\.start_time, OLD\.end_time\)[\s\S]*ROW\(NEW\.date, NEW\.start_time, NEW\.end_time\)/);
assert.match(migration, /OLD\.date IS DISTINCT FROM NEW\.date/);
assert.match(migration, /OLD\.start_time IS DISTINCT FROM NEW\.start_time/);
assert.match(migration, /OLD\.end_time IS DISTINCT FROM NEW\.end_time/);
assert.doesNotMatch(migration, /to_jsonb\((?:OLD|NEW)\)/);
assert.match(migration, /FROM public\.task_assignments[\s\S]*WHERE task_id = NEW\.id/);
assert.match(migration, /UNION[\s\S]*NEW\.cleaner_id/);
assert.match(migration, /event_type[\s\S]*'task_modified'/);
assert.match(migration, /ON CONFLICT \(dedupe_key\) DO NOTHING/);
assert.doesNotMatch(
  assignmentService,
  /createTaskNotificationEvent\(\{\s*eventType: 'task_modified'/,
  'task_modified debe generarse exclusivamente desde el trigger central',
);

console.log('whatsapp-task-modification-trigger-tests: OK');
