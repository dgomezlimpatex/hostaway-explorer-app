// Orquestador de notificaciones (frontend).
// Crea notification_events (capa lógica desacoplada del canal) y, si el flag de
// WhatsApp está activo, dispara el envío. Con el flag apagado registra el evento
// como cancelado/preparado para auditoría, sin invocar ningún canal.

import { supabase } from '@/integrations/supabase/client';
import { isWhatsAppNotificationsEnabled } from '@/services/whatsapp/whatsappConfig';
import type { NotificationEventType } from '@/types/notifications';

interface CreateTaskNotificationEventParams {
  eventType: NotificationEventType;
  taskId: string;
  cleanerId?: string | null;
  sedeId?: string | null;
  payload?: Record<string, unknown>;
  /** Clave de deduplicación; si no se pasa se genera una básica. */
  dedupeKey?: string;
}

/**
 * Crea un evento de notificación operativa. Devuelve el id del evento o null.
 * No lanza: es fire-and-forget; cualquier error se loguea sin romper el flujo.
 * Con el feature flag de WhatsApp apagado, crea el evento como `cancelled` para
 * dejar rastro lógico/auditoría sin generar entregas ni envíos.
 */
export async function createTaskNotificationEvent(
  params: CreateTaskNotificationEventParams,
): Promise<string | null> {
  const { eventType, taskId, cleanerId, sedeId, payload } = params;
  const dedupeKey = params.dedupeKey ?? `${eventType}:${taskId}:${Date.now()}`;
  const whatsappEnabled = isWhatsAppNotificationsEnabled();

  try {
    const { data, error } = await supabase
      .from('notification_events')
      .insert({
        event_type: eventType,
        entity_type: 'tasks',
        entity_id: taskId,
        task_id: taskId,
        cleaner_id: cleanerId ?? null,
        sede_id: sedeId ?? null,
        payload: {
          ...(payload ?? {}),
          whatsappEnabled,
        },
        dedupe_key: dedupeKey,
        status: whatsappEnabled ? 'pending' : 'cancelled',
      })
      .select('id')
      .single();

    if (error) {
      console.error('createTaskNotificationEvent error:', error.message);
      return null;
    }

    // Disparar envío (fire-and-forget) solo cuando el canal está activo. La
    // función decide dry-run según secrets.
    if (whatsappEnabled && data?.id) {
      void supabase.functions
        .invoke('send-whatsapp-notification', { body: { eventId: data.id } })
        .catch((e) => console.error('send-whatsapp-notification invoke error:', e));
    }

    return data?.id ?? null;
  } catch (e) {
    console.error('createTaskNotificationEvent exception:', e);
    return null;
  }
}
