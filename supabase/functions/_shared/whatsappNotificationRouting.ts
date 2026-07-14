interface CleanerLike {
  name?: string | null;
  whatsapp_phone_e164?: string | null;
  whatsapp_notifications_enabled?: boolean | null;
}

interface TaskLike {
  property?: string | null;
  date?: string | null;
  start_time?: string | null;
  startTime?: string | null;
}

interface EventPayloadLike {
  reason?: string | null;
  rejection_reason?: string | null;
}

export interface NotificationRecipient {
  recipient: string | null;
  enabled: boolean;
  kind: 'cleaner' | 'admin';
}

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

function rejectionReason(payload: EventPayloadLike): string {
  return clean(payload.reason) || clean(payload.rejection_reason) || 'No disponible';
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function resolveNotificationRecipient(
  eventType: string,
  cleaner: CleanerLike,
  adminPhone: string | null | undefined,
): NotificationRecipient {
  if (eventType === 'task_rejected_alert') {
    const recipient = clean(adminPhone) || null;
    return { recipient, enabled: Boolean(recipient), kind: 'admin' };
  }

  const recipient = clean(cleaner.whatsapp_phone_e164) || null;
  return {
    recipient,
    enabled: Boolean(cleaner.whatsapp_notifications_enabled) && Boolean(recipient),
    kind: 'cleaner',
  };
}

export function buildRejectedAlertBodyParameters(
  cleaner: CleanerLike,
  task: TaskLike,
  payload: EventPayloadLike,
  formattedDate: string,
): string[] {
  return [
    clean(cleaner.name) || 'Trabajadora sin nombre',
    clean(task.property) || 'Tarea sin propiedad',
    formattedDate,
    clean(task.start_time ?? task.startTime) || 'Sin hora',
    rejectionReason(payload),
  ];
}

export function shouldSendAdminEmailFallback(
  eventType: string,
  whatsappSucceeded: boolean,
  fallbackEmail: string | null | undefined,
): boolean {
  return eventType === 'task_rejected_alert'
    && !whatsappSucceeded
    && Boolean(clean(fallbackEmail));
}

export function buildRejectedAlertEmail(
  cleaner: CleanerLike,
  task: TaskLike,
  payload: EventPayloadLike,
  formattedDate: string,
): { subject: string; html: string } {
  const cleanerName = clean(cleaner.name) || 'Trabajadora sin nombre';
  const property = clean(task.property) || 'Tarea sin propiedad';
  const start = clean(task.start_time ?? task.startTime) || 'Sin hora';
  const reason = rejectionReason(payload);

  return {
    subject: `Tarea rechazada · ${cleanerName} · ${property}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px;background:#f8fafc">
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:28px">
          <p style="margin:0 0 8px;color:#dc2626;font-size:12px;font-weight:700;text-transform:uppercase">Tarea rechazada</p>
          <h1 style="margin:0 0 18px;color:#111827;font-size:22px">Revisión operativa necesaria</h1>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:7px 0;color:#6b7280">Trabajadora</td><td style="padding:7px 0;font-weight:600">${escapeHtml(cleanerName)}</td></tr>
            <tr><td style="padding:7px 0;color:#6b7280">Propiedad</td><td style="padding:7px 0">${escapeHtml(property)}</td></tr>
            <tr><td style="padding:7px 0;color:#6b7280">Fecha</td><td style="padding:7px 0">${escapeHtml(formattedDate)}</td></tr>
            <tr><td style="padding:7px 0;color:#6b7280">Hora</td><td style="padding:7px 0">${escapeHtml(start)}</td></tr>
            <tr><td style="padding:7px 0;color:#6b7280">Motivo</td><td style="padding:7px 0">${escapeHtml(reason)}</td></tr>
          </table>
          <p style="margin:22px 0 0;color:#6b7280;font-size:12px">WhatsApp administrativo no pudo entregar el aviso. Este correo es el canal de respaldo automático.</p>
        </div>
      </div>`,
  };
}
