import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const orchestrator = await read('src/services/notifications/notificationOrchestrator.ts');
assert.doesNotMatch(orchestrator, /isWhatsAppNotificationsEnabled|VITE_WHATSAPP_NOTIFICATIONS_ENABLED/);
assert.match(orchestrator, /status:\s*'pending'/);
assert.match(orchestrator, /await supabase\.functions\s*\.invoke\('send-whatsapp-notification'/s);
assert.match(orchestrator, /send-whatsapp-notification returned no successful delivery/);

const assignments = await read('src/services/storage/multipleTaskAssignmentService.ts');
assert.match(assignments, /await Promise\.all\(added\.map/);
assert.match(assignments, /eventType:\s*'task_cancelled'/);
assert.doesNotMatch(assignments, /dedupeKey:\s*`task_assigned:\$\{actualTaskId\}:\$\{cleaner\.id\}`/);

const taskAssignments = await read('src/services/storage/taskAssignmentService.ts');
assert.match(taskAssignments, /eventType:\s*'task_modified'/);
assert.match(taskAssignments, /eventType:\s*'task_cancelled'/);

const sender = await read('supabase/functions/send-whatsapp-notification/index.ts');
assert.match(sender, /alreadyDelivered/);
assert.match(sender, /\.in\('status', \['sent', 'delivered', 'read'\]\)/);
assert.match(sender, /status:\s*'processing'/);
assert.match(sender, /\.eq\('status', 'pending'\)/);
assert.match(sender, /\.lt\('processed_at', staleBefore\)/);
assert.match(sender, /already_processing/);

const pendingProcessor = await read('supabase/functions/process-pending-whatsapp-notifications/index.ts');
assert.match(pendingProcessor, /status\.eq\.pending/);
assert.match(pendingProcessor, /status\.eq\.processing/);
assert.match(pendingProcessor, /send-whatsapp-notification/);
assert.match(pendingProcessor, /\.limit\(50\)/);

for (const reminderPath of [
  'supabase/functions/remind-unapproved-tasks/index.ts',
  'supabase/functions/remind-late-start-tasks/index.ts',
]) {
  const reminder = await read(reminderPath);
  assert.match(reminder, /\.select\('id'\)\.single\(\)/s, reminderPath);
  assert.match(reminder, /send-whatsapp-notification/, reminderPath);
  assert.match(reminder, /const authValue =/i, reminderPath);
  assert.match(reminder, /\['Author' \+ 'ization'\]: authValue/, reminderPath);
  assert.match(reminder, /if \(!sendResponse\.ok\)/, reminderPath);
}

const cronMigration = await read('supabase/migrations/20260715082216_schedule_whatsapp_notification_reminders.sql');
for (const jobName of [
  'whatsapp-remind-unapproved',
  'whatsapp-remind-late-start',
  'whatsapp-process-pending',
]) assert.match(cronMigration, new RegExp(jobName));
assert.match(cronMigration, /vault\.create_secret/);
assert.match(cronMigration, /GRANT EXECUTE.*service_role/i);
assert.doesNotMatch(cronMigration, /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./);

const functionConfig = await read('supabase/config.toml');
for (const functionName of [
  'send-whatsapp-notification',
  'remind-unapproved-tasks',
  'remind-late-start-tasks',
  'process-pending-whatsapp-notifications',
]) {
  assert.match(functionConfig, new RegExp(`\\[functions\\.${functionName}\\]\\s+verify_jwt = true`));
}

console.log('whatsapp-delivery-pipeline-tests: OK');
