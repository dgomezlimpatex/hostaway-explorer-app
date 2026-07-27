import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  hasTaskReportStarted,
  lateStartThreshold,
  LATE_START_GRACE_MINUTES,
} from '../supabase/functions/_shared/lateStartReminder.ts';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const reminder = await read('supabase/functions/remind-late-start-tasks/index.ts');
const sender = await read('supabase/functions/send-whatsapp-notification/index.ts');

assert.match(reminder, /LATE_START_GRACE_MINUTES/);
assert.match(reminder, /\.from\('task_reports'\)/);
assert.match(reminder, /hasTaskReportStarted/);
assert.match(reminder, /lateStartThreshold/);
assert.match(reminder, /\['sent', 'delivered', 'read', 'already_sent'\]\.includes\(sendResult\?\.status\)/);
assert.doesNotMatch(reminder, /subtractMinutes\(nowTimeMadrid\(\),\s*15\)/);

assert.match(sender, /event\.event_type === 'task_late_start_reminder'/);
assert.match(sender, /\.from\('task_reports'\)/);
assert.match(sender, /hasTaskReportStarted/);
assert.match(sender, /skipped:task_already_started/);
assert.match(sender, /processing_lease_token/);

assert.equal(LATE_START_GRACE_MINUTES, 30);
assert.equal(lateStartThreshold('10:00'), '09:30');
assert.equal(lateStartThreshold('00:20'), '00:00');
assert.equal(hasTaskReportStarted([]), false);
assert.equal(hasTaskReportStarted([{ start_time: null, overall_status: 'pending' }]), false);
assert.equal(hasTaskReportStarted([{ start_time: '2026-07-23T08:01:00Z', overall_status: 'pending' }]), true);
assert.equal(hasTaskReportStarted([{ start_time: null, overall_status: 'in_progress' }]), true);
assert.equal(hasTaskReportStarted([{ start_time: null, overall_status: 'completed' }]), true);
assert.equal(hasTaskReportStarted([{ start_time: null, overall_status: 'needs_review' }]), true);

console.log('whatsapp-late-start-reminder-tests: OK');
