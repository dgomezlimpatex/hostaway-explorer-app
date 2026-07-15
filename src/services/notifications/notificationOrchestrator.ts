// Orquestador de notificaciones (frontend).
// Crea notification_events y solicita el envío al backend. El feature flag real
// vive únicamente en la Edge Function para evitar builds de Vercel desalineados.

import { supabase } from '@/integrations/supabase/client';
import type { NotificationEventType } from '@/types/notifications';

interface CreateTaskNotificationEventParams {
  eventType: NotificationEventType;
  taskId: string;
  cleanerId?: string | null;
  sedeId?: string | null;
  payload?: Record<string, unknown>;
  /** Clave de deduplicación; si no se pasa se genera una por operación. */
  dedupeKey?: string;
}

/**
 * Crea un evento operativo y espera a que la Edge Function acepte el envío.
 * Si falla la invocación, el evento queda pending para diagnóstico/reintento.
 */
export async function createTaskNotificationEvent(
  params: CreateTaskNotificationEventParams,
): Promise<string | null> {
  const { eventType, taskId, cleanerId, sedeId, payload } = params;
  const dedupeKey = params.dedupeKey ?? `${eventType}:${taskId}:${cleanerId ?? 'none'}:${Date.now()}`;

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
        payload: payload ?? {},
        dedupe_key: dedupeKey,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error || !data?.id) {
      console.error('createTaskNotificationEvent error:', error?.message ?? 'event id missing');
      return null;
    }

    const { data: sendResult, error: sendError } = await supabase.functions
      .invoke('send-whatsapp-notification', { body: { eventId: data.id } });

    if (sendError || sendResult?.ok !== true) {
      throw new Error(
        `send-whatsapp-notification returned no successful delivery: ${sendError?.message ?? sendResult?.status ?? 'unknown'}`,
      );
    }

    return data.id;
  } catch (error) {
    console.error('createTaskNotificationEvent exception:', error);
    return null;
  }
}
