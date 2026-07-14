export type WhatsAppApprovalButtonAction = 'approve' | 'reject';
export type WhatsAppApprovalAuditAction = 'approved' | 'rejected';

export interface WhatsAppApprovalTransition {
  taskPatch: {
    approval_status: WhatsAppApprovalAuditAction;
    approved_at: string | null;
    rejected_at: string | null;
    approval_response_source: 'whatsapp';
  };
  auditAction: WhatsAppApprovalAuditAction;
  shouldCreateRejectionAlert: boolean;
}

/**
 * Construye una transición "último botón válido gana".
 * Limpia siempre el timestamp de la respuesta sustituida.
 */
export function buildApprovalTransition(
  action: WhatsAppApprovalButtonAction,
  occurredAt: string,
): WhatsAppApprovalTransition {
  if (action === 'approve') {
    return {
      taskPatch: {
        approval_status: 'approved',
        approved_at: occurredAt,
        rejected_at: null,
        approval_response_source: 'whatsapp',
      },
      auditAction: 'approved',
      shouldCreateRejectionAlert: false,
    };
  }

  return {
    taskPatch: {
      approval_status: 'rejected',
      approved_at: null,
      rejected_at: occurredAt,
      approval_response_source: 'whatsapp',
    },
    auditAction: 'rejected',
    shouldCreateRejectionAlert: true,
  };
}

export function buttonCallbackDedupeKey(whatsappMessageId: string): string {
  return `whatsapp-button:${whatsappMessageId}`;
}

export function rejectionAlertDedupeKey(taskId: string, whatsappMessageId: string): string {
  return `task_rejected_alert:${taskId}:${whatsappMessageId}`;
}

export interface ApprovalButtonInput {
  taskId: string;
  cleanerId: string | null;
  action: WhatsAppApprovalButtonAction;
  whatsappMessageId: string;
  occurredAt: string;
}

export interface ApprovalButtonRepository {
  wasMessageProcessed(whatsappMessageId: string): Promise<boolean>;
  updateTask(taskId: string, patch: WhatsAppApprovalTransition['taskPatch']): Promise<void>;
  insertAudit(input: {
    taskId: string;
    cleanerId: string | null;
    action: WhatsAppApprovalAuditAction;
    whatsappMessageId: string;
  }): Promise<void>;
  insertRejectionAlert(input: {
    taskId: string;
    cleanerId: string | null;
    dedupeKey: string;
    whatsappMessageId: string;
  }): Promise<void>;
}

export async function processApprovalButton(
  input: ApprovalButtonInput,
  repository: ApprovalButtonRepository,
): Promise<{ status: 'applied' | 'duplicate'; action: WhatsAppApprovalAuditAction }> {
  const transition = buildApprovalTransition(input.action, input.occurredAt);
  if (await repository.wasMessageProcessed(input.whatsappMessageId)) {
    return { status: 'duplicate', action: transition.auditAction };
  }

  await repository.updateTask(input.taskId, transition.taskPatch);
  await repository.insertAudit({
    taskId: input.taskId,
    cleanerId: input.cleanerId,
    action: transition.auditAction,
    whatsappMessageId: input.whatsappMessageId,
  });

  if (transition.shouldCreateRejectionAlert) {
    await repository.insertRejectionAlert({
      taskId: input.taskId,
      cleanerId: input.cleanerId,
      dedupeKey: rejectionAlertDedupeKey(input.taskId, input.whatsappMessageId),
      whatsappMessageId: input.whatsappMessageId,
    });
  }

  return { status: 'applied', action: transition.auditAction };
}
