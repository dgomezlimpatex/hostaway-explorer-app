import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migrationPath = new URL('../supabase/migrations/20260721152000_add_whatsapp_attempt_history_and_recipient_snapshot.sql', import.meta.url);
const migration = readFileSync(migrationPath, 'utf8');

const snapshotFunction = migration.match(/CREATE OR REPLACE FUNCTION public\.snapshot_notification_recipient[\s\S]*?\n\$\$;/)?.[0] ?? '';
assert.match(snapshotFunction, /telefono_digits/);
assert.match(snapshotFunction, /whatsapp_digits/);
assert.match(snapshotFunction, /telefono_national[\s\S]*substring\(telefono_national from 1 for 1\) IN \('6',\s*'7'\)/);
assert.match(snapshotFunction, /whatsapp_national[\s\S]*substring\(whatsapp_national from 1 for 1\) IN \('6',\s*'7'\)/);
assert.doesNotMatch(snapshotFunction, /whatsapp_opt_in\s*(?:=|IS)|whatsapp_notifications_enabled\s*(?:=|IS)/);

assert.match(migration, /CREATE OR REPLACE FUNCTION public\.enqueue_deleted_cleaner_cancellations/);
assert.match(migration, /CREATE TRIGGER trg_cleaners_enqueue_deleted_cleaner_cancellations\s+BEFORE DELETE ON public\.cleaners/);
assert.match(migration, /tasks_before_cleaner_delete_trigger/);
assert.match(migration, /ON CONFLICT \(dedupe_key\) DO NOTHING/);

const retryFunction = migration.match(/CREATE OR REPLACE FUNCTION public\.claim_bounded_whatsapp_retry[\s\S]*?\n\$\$;/)?.[0] ?? '';
assert.match(retryFunction, /notification_delivery_attempts/);
assert.match(retryFunction, /state = 'completed_uncertain'/);
assert.match(retryFunction, /error_code = 'worker_crash_recovered'/);
assert.match(retryFunction, /attempt_count <> 1/);
assert.match(retryFunction, /started_at <= now\(\) - interval '15 minutes'/);

const statusBinder = migration.match(/CREATE OR REPLACE FUNCTION public\.bind_whatsapp_delivery_from_status[\s\S]*?\n\$\$;/)?.[0] ?? '';
assert.match(statusBinder, /attempt\.provider_message_id = _provider_message_id/);
assert.doesNotMatch(statusBinder, /normalized_recipient|regexp_replace\([^)]*recipient|callback_provisional/);

const finalizeAttempt = migration.match(/CREATE OR REPLACE FUNCTION public\.finalize_whatsapp_send_attempt[\s\S]*?\n\$\$;/)?.[0] ?? '';
assert.match(finalizeAttempt, /replay_whatsapp_status_callbacks\(_provider_message_id\)/);
assert.doesNotMatch(finalizeAttempt, /callback_provisional/);

const metaMutators = [
  'claim_bounded_whatsapp_retry',
  'begin_whatsapp_send_attempt',
  'finalize_whatsapp_send_attempt',
  'finalize_whatsapp_send_attempt_uncertain',
  'finalize_whatsapp_send_attempt_non_delivery',
  'apply_whatsapp_delivery_status',
  'bind_whatsapp_delivery_from_button',
];
for (const functionName of metaMutators) {
  const source = migration.match(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${functionName}[\\s\\S]*?\\n\\$\\$;`))?.[0] ?? '';
  assert.ok(source, `${functionName} must exist`);
  const advisory = source.indexOf('pg_advisory_xact_lock');
  const lockedSource = advisory >= 0 ? source.slice(advisory) : '';
  const eventLock = lockedSource.search(/notification_events[\s\S]{0,500}FOR UPDATE/);
  const deliveryLock = lockedSource.search(/notification_deliveries[\s\S]{0,500}FOR UPDATE/);
  const attemptOrder = lockedSource.indexOf('ORDER BY attempt.attempt_no, attempt.id');
  const attemptLock = lockedSource.search(/notification_delivery_attempts[\s\S]{0,500}FOR UPDATE/);
  assert.ok(advisory >= 0 && eventLock >= 0 && deliveryLock > eventLock
      && attemptOrder > deliveryLock && attemptLock > deliveryLock,
    `${functionName} must lock advisory -> event -> delivery -> ordered attempts (${JSON.stringify({ advisory, eventLock, deliveryLock, attemptOrder, attemptLock })})`);
}

assert.match(migration, /INSERT INTO public\.notification_delivery_attempts[\s\S]*meta_attempt_count[\s\S]*ON CONFLICT \(delivery_id, attempt_no\) DO NOTHING/);
assert.match(migration, /'reconciled'/);

console.log('whatsapp cancellation fail-closed contracts: OK');
