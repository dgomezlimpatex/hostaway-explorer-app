// send-whatsapp-notification: envía una notificación WhatsApp a partir de un
// notification_events.id. En modo preparación queda registrada como 'skipped'.

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { sendWhatsAppTemplateMessage } from '../_shared/whatsappClient.ts';
import {
  templateForEventType,
  WHATSAPP_TEMPLATES,
} from '../_shared/whatsappTemplates.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function fmtMadridDate(dateStr: string): string {
  try {
    const d = new Date(`${dateStr}T00:00:00`);
    return d.toLocaleDateString('es-ES', {
      timeZone: 'Europe/Madrid',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  try {
    const { eventId } = await req.json();
    if (!eventId) {
      return new Response(JSON.stringify({ error: 'eventId requerido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // 1. Leer evento
    const { data: event, error: evErr } = await supabase
      .from('notification_events')
      .select('*')
      .eq('id', eventId)
      .single();
    if (evErr || !event) {
      return new Response(JSON.stringify({ error: 'Evento no encontrado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const templateName = templateForEventType(event.event_type);
    if (!templateName) {
      await supabase.from('notification_events').update({
        status: 'failed',
        processed_at: new Date().toISOString(),
        error_message: `Sin plantilla para event_type ${event.event_type}`,
      }).eq('id', eventId);
      return new Response(JSON.stringify({ error: 'Sin plantilla para el evento' }), {
        status: 422,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // 2. Leer tarea y limpiadora
    const { data: task } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', event.task_id)
      .single();
    const { data: cleaner } = await supabase
      .from('cleaners')
      .select('*')
      .eq('id', event.cleaner_id)
      .single();

    if (!task || !cleaner) {
      await supabase.from('notification_events').update({
        status: 'failed',
        processed_at: new Date().toISOString(),
        error_message: 'Tarea o limpiadora no encontrada',
      }).eq('id', eventId);
      return new Response(JSON.stringify({ error: 'Tarea o limpiadora no encontrada' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // 3. Validar que la limpiadora tiene WhatsApp habilitado
    const recipient: string | null = cleaner.whatsapp_phone_e164 ?? null;
    const enabled = Boolean(cleaner.whatsapp_notifications_enabled) && Boolean(recipient);

    // 4. Construir parámetros del cuerpo según plantilla
    const def = WHATSAPP_TEMPLATES[templateName];
    const name = cleaner.name ?? '';
    const property = task.property ?? '';
    const address = task.address ?? '';
    const date = fmtMadridDate(task.date ?? '');
    const start = task.start_time ?? task.startTime ?? '';
    const end = task.end_time ?? task.endTime ?? '';

    let bodyParameters: string[] = [];
    switch (templateName) {
      case 'task_assigned_approval_es':
        bodyParameters = [name, address, property, date, start, end];
        break;
      case 'task_modified_es':
        bodyParameters = [name, property, date, start, end];
        break;
      case 'task_cancelled_es':
        bodyParameters = [name, property, date, start, end];
        break;
      case 'task_approval_reminder_es':
        bodyParameters = [name, property, start, end];
        break;
      case 'task_late_start_reminder_es':
        bodyParameters = [name, property, start];
        break;
      default:
        bodyParameters = [name, property, date, start, end].slice(0, def.bodyParamCount);
    }

    // 5. Botones (payloads compactos) si la plantilla los tiene
    const nonce = crypto.randomUUID().slice(0, 8);
    let buttonPayloads: string[] | undefined;
    if (def.hasButtons) {
      if (templateName === 'task_late_start_reminder_es') {
        buttonPayloads = [`late_started:${task.id}:${nonce}`, `late_issue:${task.id}:${nonce}`];
      } else {
        buttonPayloads = [`approve:${task.id}:${nonce}`, `reject:${task.id}:${nonce}`];
      }
    }

    // 6. Crear delivery en estado inicial
    const { data: delivery } = await supabase
      .from('notification_deliveries')
      .insert({
        notification_event_id: eventId,
        channel: 'whatsapp',
        provider: 'meta_cloud_api',
        recipient: recipient ?? 'sin_telefono',
        template_name: templateName,
        status: 'queued',
        provider_payload: { bodyParameters, buttonPayloads },
      })
      .select()
      .single();

    // Si la limpiadora no está habilitada para WhatsApp, marcamos skipped y salimos.
    if (!enabled) {
      await supabase.from('notification_deliveries').update({
        status: 'skipped',
        error_message: 'Limpiadora sin teléfono/opt-in de WhatsApp',
      }).eq('id', delivery?.id);
      await supabase.from('notification_events').update({
        status: 'sent',
        processed_at: new Date().toISOString(),
        error_message: 'Omitido: limpiadora sin WhatsApp habilitado (modo preparación)',
      }).eq('id', eventId);
      return new Response(JSON.stringify({ ok: true, status: 'skipped', reason: 'cleaner_not_enabled' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // 7. Enviar (o dry-run según feature flag)
    const result = await sendWhatsAppTemplateMessage({
      to: recipient as string,
      templateName,
      languageCode: def.languageCode,
      bodyParameters,
      buttonPayloads,
      idempotencyKey: event.dedupe_key,
    });

    const now = new Date().toISOString();
    await supabase.from('notification_deliveries').update({
      status: result.status,
      provider_message_id: result.providerMessageId,
      provider_response: result.response ?? {},
      error_code: result.errorCode ?? null,
      error_message: result.errorMessage ?? null,
      sent_at: result.status === 'sent' ? now : null,
    }).eq('id', delivery?.id);

    await supabase.from('notification_events').update({
      status: result.ok ? 'sent' : 'failed',
      processed_at: now,
      error_message: result.ok ? null : result.errorMessage,
    }).eq('id', eventId);

    return new Response(JSON.stringify({
      ok: result.ok,
      status: result.status,
      dryRun: result.dryRun,
      providerMessageId: result.providerMessageId,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    console.error('send-whatsapp-notification error', error instanceof Error ? error.message : error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
