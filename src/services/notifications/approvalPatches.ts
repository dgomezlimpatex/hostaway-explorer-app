// Constructores puros de patches de approval_status (sin dependencias de runtime).
// Aislados para poder testearlos bajo Node sin importar el cliente de Supabase.

export type ApprovalStatusValue =
  | 'not_required'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'auto_approved_by_admin';

export interface TaskApprovalPatch {
  approval_status: ApprovalStatusValue;
  approval_requested_at?: string | null;
  approved_at?: string | null;
  rejected_at?: string | null;
  approval_response_source?: string | null;
  approval_rejection_reason?: string | null;
}

/** Marca una tarea como pendiente de aprobación (al asignar o reasignar). */
export function buildPendingApprovalPatch(): TaskApprovalPatch {
  return {
    approval_status: 'pending',
    approval_requested_at: new Date().toISOString(),
    approved_at: null,
    rejected_at: null,
    approval_response_source: null,
    approval_rejection_reason: null,
  };
}

/** Patch para cuando un cambio de horario/propiedad invalida la aprobación previa. */
export function buildReapprovalPatch(): TaskApprovalPatch {
  return buildPendingApprovalPatch();
}

/** Patch para cancelación/desasignación: no requiere aprobación. */
export function buildNotRequiredPatch(): TaskApprovalPatch {
  return { approval_status: 'not_required' };
}

/** Deduplicación determinista para recordatorio de aprobación del mismo día. */
export function approvalReminderDedupeKey(taskId: string, date: string): string {
  return `task_approval_reminder:${taskId}:${date}`;
}

/** Deduplicación determinista para recordatorio de inicio tardío. */
export function lateStartDedupeKey(taskId: string): string {
  return `task_late_start_reminder:${taskId}`;
}
