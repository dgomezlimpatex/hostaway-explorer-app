import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(
  new URL('../supabase/migrations/20260717160000_notify_all_assigned_cleaners_on_task_changes.sql', import.meta.url),
  'utf8',
);
const assignmentService = await readFile(
  new URL('../src/services/storage/taskAssignmentService.ts', import.meta.url),
  'utf8',
);

assert.match(migration, /CREATE OR REPLACE FUNCTION public\.enqueue_task_modified_notifications\(\)/);
assert.match(migration, /AFTER UPDATE ON public\.tasks/);
assert.match(migration, /to_jsonb\(NEW\)[\s\S]*-[\s\S]*'updated_at'/);
assert.match(migration, /'approval_status'[\s\S]*'late_start_reminder_sent_at'/);
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
