// Orquestador de notificaciones (frontend).
// Crea notification_events para su procesamiento backend asíncrono. El navegador
// nunca invoca el emisor privilegiado ni necesita conocer su feature flag.

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
 * Crea un evento operativo. El cron backend lo reclama y envía sin depender de
 * que la sesión o el navegador permanezcan abiertos.
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

    return data.id;
  } catch (error) {
    console.error('createTaskNotificationEvent exception:', error);
    return null;
  }
}
