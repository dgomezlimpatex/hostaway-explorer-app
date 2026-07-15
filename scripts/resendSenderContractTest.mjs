import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (relativePath) => readFileSync(join(root, relativePath), 'utf8');
const senderAddress = 'alertas@limpatexgestion.es';

const resendFiles = [
  'supabase/functions/batch-create-tasks/index.ts',
  'supabase/functions/daily-staffing-forecast/index.ts',
  'supabase/functions/hostaway-sync/email-service.ts',
  'supabase/functions/notify-extraordinary-request/index.ts',
  'supabase/functions/send-avantio-error-email/index.ts',
  'supabase/functions/send-incident-notification-email/index.ts',
  'supabase/functions/send-invitation-email/index.ts',
  'supabase/functions/send-one-night-alert/index.ts',
  'supabase/functions/send-planning-batch-email/index.ts',
  'supabase/functions/send-portal-change-notification/index.ts',
  'supabase/functions/send-recurring-task-email/index.ts',
  'supabase/functions/send-reservation-digest-email/index.ts',
  'supabase/functions/send-subtask-notification-email/index.ts',
  'supabase/functions/send-sync-error-email/index.ts',
  'supabase/functions/send-task-assignment-email/index.ts',
  'supabase/functions/send-task-reschedule-batch-email/index.ts',
  'supabase/functions/send-task-schedule-change-email/index.ts',
  'supabase/functions/send-task-unassignment-email/index.ts',
  'supabase/functions/send-whatsapp-notification/index.ts',
];

const combined = resendFiles.map(read).join('\n');
const senderOccurrences = combined.match(new RegExp(senderAddress.replaceAll('.', '\\.'), 'g')) || [];

assert.equal(senderOccurrences.length, 20, 'all 20 Resend sender declarations must use the verified limpatexgestion.es domain');
assert.doesNotMatch(combined, /@gestionlimpatex\.es/, 'the unverified reversed domain gestionlimpatex.es must never be used');
assert.doesNotMatch(combined, /@(limpatexgestion\.com|resend\.dev)/, 'legacy Resend sender domains must not remain');

const assignmentEmail = read('supabase/functions/send-task-assignment-email/index.ts');
assert.match(assignmentEmail, /if\s*\(emailResponse\.error\)/, 'task assignment email must reject Resend API errors');
assert.match(assignmentEmail, /status:\s*500/, 'task assignment email must expose provider failures as HTTP errors');

const batchEmail = read('supabase/functions/batch-create-tasks/index.ts');
assert.match(batchEmail, /if\s*\(emailResponse\.error\)/, 'batch task email must not count a rejected Resend request as sent');

console.log('Resend sender contract test passed');
