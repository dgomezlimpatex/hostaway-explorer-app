import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const migrationPath = 'supabase/migrations/20260721151000_fix_deleted_task_cancellation_notifications.sql';
const migration = await read(migrationPath);
const attemptMigration = await read('supabase/migrations/20260721152000_add_whatsapp_attempt_history_and_recipient_snapshot.sql');
const sender = await read('supabase/functions/send-whatsapp-notification/index.ts');

assert.match(migration, /ADD COLUMN IF NOT EXISTS snapshot jsonb/);
assert.match(migration, /ADD COLUMN IF NOT EXISTS processing_attempts integer NOT NULL DEFAULT 0/);
assert.match(migration, /ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 3/);
assert.match(migration, /status IN \('pending', 'processing', 'sent', 'failed', 'cancelled', 'dead_letter'\)/);

const hardDeleteBlock = migration.slice(
  migration.indexOf('CREATE OR REPLACE FUNCTION public.enqueue_deleted_task_cancellations'),
  migration.indexOf('CREATE OR REPLACE FUNCTION public.enqueue_task_assignment_notification'),
);
assert.match(hardDeleteBlock, /BEFORE DELETE ON public\.tasks/);
assert.match(hardDeleteBlock, /FROM public\.task_assignments candidate/);
assert.match(hardDeleteBlock, /WHERE candidate\.task_id = OLD\.id/);
assert.match(hardDeleteBlock, /'task_cancelled'/);
assert.match(hardDeleteBlock, /'task'[\s\S]*'assignment'/);
assert.match(hardDeleteBlock, /OLD\.property/);
assert.match(hardDeleteBlock, /OLD\.date/);
assert.match(hardDeleteBlock, /OLD\.start_time/);
assert.match(hardDeleteBlock, /OLD\.end_time/);
assert.match(hardDeleteBlock, /ON CONFLICT \(dedupe_key\) DO NOTHING/);

// Un único recorrido por task_assignments y una única sentencia INSERT por fila
// debe conservar exactamente un evento por asignación, también en lotes grandes.
for (const assignmentCount of [1, 3, 30]) {
  const assignments = Array.from({ length: assignmentCount }, (_, index) => ({
    id: `assignment-${index + 1}`,
    cleanerId: `cleaner-${index + 1}`,
  }));
  const dedupeKeys = assignments.map(({ id, cleanerId }) =>
    `task_cancelled:task-1:${cleanerId}:assignment:${id}`);
  assert.equal(dedupeKeys.length, assignmentCount);
  assert.equal(new Set(dedupeKeys).size, assignmentCount);
}

assert.match(migration, /CREATE OR REPLACE FUNCTION public\.prevent_notification_event_snapshot_mutation/);
assert.match(migration, /OLD\.snapshot IS DISTINCT FROM NEW\.snapshot/);
assert.match(migration, /BEFORE UPDATE OF snapshot ON public\.notification_events/);

const assignmentTriggerBlock = migration.slice(
  migration.indexOf('CREATE OR REPLACE FUNCTION public.enqueue_task_assignment_notification'),
  migration.indexOf('CREATE OR REPLACE FUNCTION public.finalize_whatsapp_pre_delivery_failure'),
);
assert.match(assignmentTriggerBlock, /notification_type := 'task_cancelled'/);
assert.match(assignmentTriggerBlock, /task_snapshot/);
assert.match(assignmentTriggerBlock, /ON CONFLICT \(dedupe_key\) DO NOTHING/);

const poisonFinalizerBlock = migration.slice(
  migration.indexOf('CREATE OR REPLACE FUNCTION public.finalize_whatsapp_pre_delivery_failure'),
);
assert.match(poisonFinalizerBlock, /processing_lease_token IS NOT DISTINCT FROM _lease_token/);
assert.match(poisonFinalizerBlock, /processing_attempts >= max_attempts THEN 'dead_letter'/);
assert.match(poisonFinalizerBlock, /ELSE 'pending'/);
assert.match(poisonFinalizerBlock, /processing_lease_token = NULL/);
assert.match(poisonFinalizerBlock, /GRANT EXECUTE[\s\S]*TO service_role/);

assert.match(sender, /event\.event_type === 'task_cancelled'[\s\S]{0,300}event\.snapshot\?\.task/);
assert.match(sender, /let task = cancellationTaskSnapshot \?\? batchTaskSnapshot/);
assert.match(sender, /const taskData = task/);
assert.match(sender, /if \(!task && event\.task_id\)[\s\S]{0,300}\.from\('tasks'\)/);
const templateDataBlock = sender.slice(
  sender.indexOf('// 4. Construir parámetros del cuerpo según plantilla'),
  sender.indexOf('const sendAdminFallbackEmail'),
);
assert.match(templateDataBlock, /taskData\.property/);
assert.match(templateDataBlock, /taskData\.address/);
assert.doesNotMatch(templateDataBlock, /\btask\./, 'la plantilla snapshot no puede desreferenciar la tarea eliminada');
const buttonPayloadBlock = sender.slice(
  sender.indexOf('let buttonPayloads:'),
  sender.indexOf('// 6. Preparar o recuperar'),
);
assert.match(buttonPayloadBlock, /taskData\.id/);
assert.doesNotMatch(buttonPayloadBlock, /\btask\./, 'los correladores deben usar la tarea efectiva o su snapshot');
assert.match(sender, /processing_attempts:\s*nextProcessingAttempt/);
assert.match(
  sender,
  /nextProcessingAttempt > Number\(event\.max_attempts[\s\S]{0,900}status:\s*'dead_letter'/,
  'un worker que cae antes del catch no puede renovar processing más allá del presupuesto',
);
assert.match(sender, /let providerPostStarted = false/);
const boundedRetryWaitBlock = sender.slice(
  sender.indexOf('const queuedDeliveryIds ='),
  sender.indexOf("const reconciliationMessage = 'Resultado de Meta incierto"),
);
assert.match(boundedRetryWaitBlock, /send_started_at/);
assert.match(boundedRetryWaitBlock, /15 \* 60 \* 1000/);
assert.match(boundedRetryWaitBlock, /status:\s*'retry_not_due'/);
assert.doesNotMatch(
  boundedRetryWaitBlock.slice(boundedRetryWaitBlock.indexOf("status: 'retry_not_due'")),
  /finalize_whatsapp_notification_event|finalize_uncertain_whatsapp_send_delivery/,
  'esperar al intento 2/2 no puede renovar processed_at ni finalizar la entrega',
);
assert.match(
  sender,
  /const sendResult = await sendWhatsAppTemplateMessage[\s\S]{0,800}providerPostStarted = !sendResult\.dryRun[\s\S]{0,80}invalid_phone/,
);
assert.match(
  sender,
  /catch \(error\)[\s\S]{0,500}!providerPostStarted[\s\S]{0,500}finalize_whatsapp_pre_delivery_failure/,
  'toda excepción anterior al POST debe liberar o terminalizar el claim cercado',
);

assert.match(attemptMigration, /CREATE TABLE public\.notification_delivery_attempts/);
assert.match(attemptMigration, /UNIQUE \(delivery_id, attempt_no\)/);
assert.match(attemptMigration, /CREATE UNIQUE INDEX[\s\S]*provider_message_id/);
assert.match(attemptMigration, /CREATE OR REPLACE FUNCTION public\.begin_whatsapp_send_attempt/);
assert.match(attemptMigration, /attempt_no >= 2[\s\S]*RETURN QUERY[\s\S]*false/);
assert.match(attemptMigration, /CREATE OR REPLACE FUNCTION public\.finalize_whatsapp_send_attempt/);
assert.match(attemptMigration, /CREATE OR REPLACE FUNCTION public\.bind_whatsapp_delivery_from_button/);
assert.match(attemptMigration, /CREATE OR REPLACE FUNCTION public\.bind_whatsapp_delivery_from_status/);
assert.match(attemptMigration, /snapshot_notification_recipient/);
assert.match(attemptMigration, /'effective_phone_e164'/);
assert.match(attemptMigration, /'whatsapp_notifications_enabled'/);
assert.match(attemptMigration, /'whatsapp_opt_in'/);
assert.match(sender, /let cleaner = cancellationRecipientSnapshot \?\? batchRecipientSnapshot/);
assert.match(sender, /const cleanerData = cleaner/);
assert.match(sender, /resolveNotificationRecipient\(event\.event_type, cleanerData, adminPhone\)/);
assert.match(sender, /begin_whatsapp_send_attempt/);
assert.match(sender, /finalize_whatsapp_send_attempt/);

console.log('whatsapp-deleted-task-cancellation-tests: OK');
