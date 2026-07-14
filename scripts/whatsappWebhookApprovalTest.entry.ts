import {
  buildApprovalTransition,
  buttonCallbackDedupeKey,
  processApprovalButton,
  rejectionAlertDedupeKey,
} from '../supabase/functions/_shared/whatsappApproval';

export async function run(assert: typeof import('node:assert/strict')) {
  const rejectedAt = '2026-07-14T14:12:05.526Z';
  const approvedAt = '2026-07-14T14:12:14.739Z';

  const rejected = buildApprovalTransition('reject', rejectedAt);
  assert.deepEqual(rejected.taskPatch, {
    approval_status: 'rejected',
    approved_at: null,
    rejected_at: rejectedAt,
    approval_response_source: 'whatsapp',
  });
  assert.equal(rejected.auditAction, 'rejected');
  assert.equal(rejected.shouldCreateRejectionAlert, true);

  const approved = buildApprovalTransition('approve', approvedAt);
  const finalTask = { ...rejected.taskPatch, ...approved.taskPatch };
  assert.equal(finalTask.approval_status, 'approved');
  assert.equal(finalTask.approved_at, approvedAt);
  assert.equal(finalTask.rejected_at, null);
  assert.equal(approved.auditAction, 'approved');
  assert.equal(approved.shouldCreateRejectionAlert, false);

  assert.equal(buttonCallbackDedupeKey('wamid-1'), 'whatsapp-button:wamid-1');
  assert.equal(buttonCallbackDedupeKey('wamid-1'), buttonCallbackDedupeKey('wamid-1'));
  assert.notEqual(buttonCallbackDedupeKey('wamid-1'), buttonCallbackDedupeKey('wamid-2'));

  assert.equal(
    rejectionAlertDedupeKey('task-1', 'wamid-1'),
    'task_rejected_alert:task-1:wamid-1',
  );

  const task: Record<string, unknown> = { approval_status: 'pending' };
  const processedMessages = new Set<string>();
  const audits: Array<{ action: string; whatsappMessageId: string }> = [];
  const alerts: Array<{ taskId: string; dedupeKey: string }> = [];
  const repository = {
    async wasMessageProcessed(whatsappMessageId: string) {
      return processedMessages.has(whatsappMessageId);
    },
    async updateTask(_taskId: string, patch: Record<string, unknown>) {
      Object.assign(task, patch);
    },
    async insertAudit(input: { action: string; whatsappMessageId: string }) {
      processedMessages.add(input.whatsappMessageId);
      audits.push(input);
    },
    async insertRejectionAlert(input: { taskId: string; dedupeKey: string }) {
      alerts.push(input);
    },
  };

  const rejectedResult = await processApprovalButton({
    taskId: 'task-1',
    cleanerId: 'cleaner-1',
    action: 'reject',
    whatsappMessageId: 'wamid-reject',
    occurredAt: rejectedAt,
  }, repository);
  assert.equal(rejectedResult.status, 'applied');
  assert.equal(task.approval_status, 'rejected');
  assert.equal(audits.length, 1);
  assert.equal(alerts.length, 1);

  const approvedResult = await processApprovalButton({
    taskId: 'task-1',
    cleanerId: 'cleaner-1',
    action: 'approve',
    whatsappMessageId: 'wamid-approve',
    occurredAt: approvedAt,
  }, repository);
  assert.equal(approvedResult.status, 'applied');
  assert.equal(task.approval_status, 'approved');
  assert.equal(task.rejected_at, null);
  assert.equal(audits.length, 2);
  assert.equal(alerts.length, 1);

  const duplicateResult = await processApprovalButton({
    taskId: 'task-1',
    cleanerId: 'cleaner-1',
    action: 'approve',
    whatsappMessageId: 'wamid-approve',
    occurredAt: approvedAt,
  }, repository);
  assert.equal(duplicateResult.status, 'duplicate');
  assert.equal(audits.length, 2);
  assert.equal(alerts.length, 1);
}
