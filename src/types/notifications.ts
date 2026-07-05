// Tipos de la capa de notificaciones operativas + aprobación de tareas.
// Preparación para WhatsApp Business API. No cambian el comportamiento actual
// hasta activar el feature flag de WhatsApp.

/** Estado de aprobación de una tarea por parte de la limpiadora. */
export type ApprovalStatus =
  | 'not_required'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'auto_approved_by_admin';

/** Acción de auditoría registrada en task_approval_events. */
export type ApprovalAction =
  | 'requested'
  | 'approved'
  | 'rejected'
  | 'reminded'
  | 'expired'
  | 'admin_override';

/** Origen de una acción de aprobación. */
export type ApprovalSource = 'whatsapp' | 'admin' | 'system' | 'worker_app';

/** Tipo de evento de notificación, independiente del canal. */
export type NotificationEventType =
  | 'task_assigned'
  | 'task_modified'
  | 'task_cancelled'
  | 'task_approval_reminder'
  | 'task_late_start_reminder'
  | 'task_rejected_alert'
  | 'task_approved_confirmation';

/** Estado de procesamiento del evento lógico. */
export type NotificationEventStatus =
  | 'pending'
  | 'processing'
  | 'sent'
  | 'failed'
  | 'cancelled';

/** Canal de entrega de una notificación. */
export type NotificationChannel = 'email' | 'whatsapp';

/** Estado de una entrega concreta por canal/proveedor. */
export type NotificationDeliveryStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'undeliverable'
  | 'skipped';

/** Evento lógico de notificación (tabla notification_events). */
export interface NotificationEvent {
  id: string;
  eventType: NotificationEventType;
  entityType: string;
  entityId: string;
  taskId?: string | null;
  cleanerId?: string | null;
  sedeId?: string | null;
  payload: Record<string, unknown>;
  dedupeKey: string;
  status: NotificationEventStatus;
  createdAt: string;
  processedAt?: string | null;
  errorMessage?: string | null;
}

/** Intento de entrega por canal (tabla notification_deliveries). */
export interface NotificationDelivery {
  id: string;
  notificationEventId: string;
  channel: NotificationChannel;
  provider: string;
  providerMessageId?: string | null;
  recipient: string;
  templateName?: string | null;
  status: NotificationDeliveryStatus;
  providerPayload: Record<string, unknown>;
  providerResponse: Record<string, unknown>;
  errorCode?: string | null;
  errorMessage?: string | null;
  sentAt?: string | null;
  deliveredAt?: string | null;
  readAt?: string | null;
  failedAt?: string | null;
  createdAt: string;
}

/** Evento de auditoría de aprobación (tabla task_approval_events). */
export interface TaskApprovalEvent {
  id: string;
  taskId: string;
  cleanerId?: string | null;
  action: ApprovalAction;
  source: ApprovalSource;
  whatsappMessageId?: string | null;
  reason?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}
