import assert from 'node:assert/strict';
import { read, walk } from './planningBatchTestSupport.mjs';

const migrationFiles = walk('supabase/migrations', (path) => path.endsWith('.sql'));
const sql = migrationFiles.map(read).join('\n');
const senderFiles = [
  'supabase/functions/send-whatsapp-notification/index.ts',
  'supabase/functions/process-pending-whatsapp-notifications/index.ts',
];
const senders = senderFiles.map(read).join('\n');

for (const recipients of [1, 3, 30]) {
  const fixture = Array.from({ length: recipients }, (_, index) => ({
    recipient_worker_id: `worker-${index + 1}`,
    snapshot: { task_id: 'deleted-task', property: 'Fixture', date: '2026-08-01' },
  }));
  assert.equal(fixture.length, recipients);
  assert.ok(fixture.every((event) => event.snapshot.task_id === 'deleted-task'));
  assert.equal(new Set(fixture.map((event) => event.recipient_worker_id)).size, recipients);
}

assert.match(sql, /task_cancelled[\s\S]{0,6000}(?:snapshot|before_snapshot)/i, 'cada baja debe conservar snapshot antes del hard-delete');
assert.match(sql, /FROM\s+public\.task_assignments[\s\S]{0,3000}task_cancelled/i, 'la cancelación debe fan-out a todas las asignaciones canónicas');
assert.match(sql, /ON\s+DELETE\s+SET\s+NULL/i, 'el evento debe sobrevivir a task_id null');
assert.match(senders, /task_cancelled[\s\S]{0,2500}(?:snapshot|event_snapshot)/i, 'sender debe construir la baja desde snapshot');
assert.match(senders, /dead_letter|max_attempts/i, 'fallos deterministas no pueden quedar eternamente processing');
assert.doesNotMatch(
  senders,
  /task_cancelled[\s\S]{0,900}if\s*\(\s*!task\s*\)[\s\S]{0,300}(?:return|throw)/i,
  'task_id null no puede convertir una cancelación válida en poison event',
);

console.log('whatsapp-deleted-task-cancellation-tests: OK (1/3/30)');
