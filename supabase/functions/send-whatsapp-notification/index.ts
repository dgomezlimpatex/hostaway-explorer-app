// send-whatsapp-notification: envía una notificación WhatsApp a partir de un
// notification_events.id. En modo preparación queda registrada como 'skipped'.

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { Resend } from 'npm:resend@2.0.0';
import { sendWhatsAppTemplateMessage } from '../_shared/whatsappClient.ts';
import {
  buildRejectedAlertBodyParameters,
  buildRejectedAlertEmail,
  resolveNotificationRecipient,
  shouldSendAdminEmailFallback,
} from '../_shared/whatsappNotificationRouting.ts';
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

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    serviceRoleKey,
  );

  try {
    const { eventId, forceEmailFallback = false } = await req.json();
    if (forceEmailFallback && req.headers.get('Authorization') !== `Bearer ${serviceRoleKey}`) {
      return new Response(JSON.stringify({ error: 'Fallback forzado requiere service role' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
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

    const { data: alreadyDelivered } = await supabase
      .from('notification_deliveries')
      .select('status,provider_message_id')
      .eq('notification_event_id', eventId)
      .eq('channel', 'whatsapp')
      .in('status', ['sent', 'delivered', 'read'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (alreadyDelivered) {
      return new Response(JSON.stringify({
        ok: true,
        status: 'already_sent',
        providerMessageId: alreadyDelivered.provider_message_id,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Reclamo atómico: evita que el envío inmediato y el procesador cron
    // procesen a la vez el mismo evento. Un claim abandonado puede recuperarse
    // después de 10 minutos.
    const claimedAt = new Date().toISOString();
    const staleBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    let claimedEvent: { id: string } | null = null;

    if (event.status === 'pending') {
      const { data } = await supabase
        .from('notification_events')
        .update({ status: 'processing', processed_at: claimedAt, error_message: null })
        .eq('id', eventId)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle();
      claimedEvent = data;
    } else if (
      event.status === 'processing'
      && event.processed_at
      && event.processed_at < staleBefore
    ) {
      const { data } = await supabase
        .from('notification_events')
        .update({ processed_at: claimedAt, error_message: null })
        .eq('id', eventId)
        .eq('status', 'processing')
        .lt('processed_at', staleBefore)
        .select('id')
        .maybeSingle();
      claimedEvent = data;
    }

    if (!claimedEvent) {
      return new Response(JSON.stringify({
        ok: true,
        status: event.status === 'processing' ? 'already_processing' : `not_pending:${event.status}`,
      }), {
        status: 202,
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

    // 3. Resolver destinatario: trabajadora para eventos normales, administración para rechazos.
    const adminPhone = Deno.env.get('WHATSAPP_ADMIN_PHONE_E164') ?? '';
    const fallbackEmail = Deno.env.get('WHATSAPP_ADMIN_FALLBACK_EMAIL') ?? '';
    const routing = resolveNotificationRecipient(event.event_type, cleaner, adminPhone);
    const recipient = routing.recipient;
    const enabled = routing.enabled;

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
        bodyParameters = [name, property, date, start, end];
        break;
      case 'task_late_start_reminder_es':
        bodyParameters = [name, property, start];
        break;
      case 'task_rejected_admin_alert_es':
        bodyParameters = buildRejectedAlertBodyParameters(cleaner, task, event.payload ?? {}, date);
        break;
      default:
        bodyParameters = [name, property, date, start, end].slice(0, def.bodyParamCount);
    }

    const sendAdminFallbackEmail = async (
      whatsappSucceeded: boolean,
      triggerError: string | null,
    ): Promise<{ attempted: boolean; ok: boolean; providerMessageId?: string; errorMessage?: string }> => {
      if (!shouldSendAdminEmailFallback(event.event_type, whatsappSucceeded, fallbackEmail)) {
        return { attempted: false, ok: false };
      }

      const emailContent = buildRejectedAlertEmail(cleaner, task, event.payload ?? {}, date);
      const { data: emailDelivery, error: emailDeliveryError } = await supabase
        .from('notification_deliveries')
        .insert({
          notification_event_id: eventId,
          channel: 'email',
          provider: 'resend',
          recipient: fallbackEmail,
          template_name: 'task_rejected_admin_fallback_email',
          status: 'queued',
          provider_payload: { triggerError },
        })
        .select('id')
        .single();

      if (emailDeliveryError) {
        if (emailDeliveryError.code === '23505') {
          const { data: existing } = await supabase
            .from('notification_deliveries')
            .select('status,provider_message_id,error_message')
            .eq('notification_event_id', eventId)
            .eq('channel', 'email')
            .eq('template_name', 'task_rejected_admin_fallback_email')
            .maybeSingle();
          const existingOk = Boolean(existing) && existing.status !== 'failed';
          return {
            attempted: false,
            ok: existingOk,
            providerMessageId: existing?.provider_message_id ?? undefined,
            errorMessage: existingOk ? undefined : (existing?.error_message ?? 'Fallback email ya registrado como fallido'),
          };
        }
        return { attempted: true, ok: false, errorMessage: emailDeliveryError.message };
      }

      const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
      const fallbackFrom = Deno.env.get('WHATSAPP_ADMIN_FALLBACK_FROM')
        ?? 'Limpatex Gestión <alertas@gestionlimpatex.es>';
      let providerMessageId: string | undefined;
      let errorMessage: string | undefined;

      if (!resendApiKey) {
        errorMessage = 'RESEND_API_KEY no configurada';
      } else {
        try {
          const response = await new Resend(resendApiKey).emails.send({
            from: fallbackFrom,
            to: [fallbackEmail],
            subject: emailContent.subject,
            html: emailContent.html,
          });
          if (response.error) {
            errorMessage = response.error.message ?? JSON.stringify(response.error);
          } else {
            providerMessageId = response.data?.id;
          }
        } catch (error) {
          errorMessage = error instanceof Error ? error.message : String(error);
        }
      }

      const ok = Boolean(providerMessageId) && !errorMessage;
      await supabase.from('notification_deliveries').update({
        status: ok ? 'sent' : 'failed',
        provider_message_id: providerMessageId ?? null,
        provider_response: providerMessageId ? { id: providerMessageId } : {},
        error_code: ok ? null : 'resend_error',
        error_message: errorMessage ?? null,
        sent_at: ok ? new Date().toISOString() : null,
      }).eq('id', emailDelivery.id);

      return { attempted: true, ok, providerMessageId, errorMessage };
    };

    if (forceEmailFallback) {
      if (event.event_type !== 'task_rejected_alert') {
        return new Response(JSON.stringify({ error: 'Fallback forzado no permitido para este evento' }), {
          status: 422,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      const fallback = await sendAdminFallbackEmail(false, 'Meta informó fallo asíncrono de WhatsApp');
      const now = new Date().toISOString();
      await supabase.from('notification_events').update({
        status: fallback.ok ? 'sent' : 'failed',
        processed_at: now,
        error_message: fallback.ok
          ? 'WhatsApp falló de forma asíncrona; correo de respaldo enviado'
          : (fallback.errorMessage ?? 'Fallaron WhatsApp y correo de respaldo'),
      }).eq('id', eventId);

      return new Response(JSON.stringify({
        ok: fallback.ok,
        status: fallback.ok ? 'fallback_sent' : 'failed',
        fallbackChannel: fallback.ok ? 'email' : null,
        fallbackProviderMessageId: fallback.providerMessageId,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
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

    // Si no hay canal WhatsApp disponible, la alerta administrativa cae a correo.
    if (!enabled) {
      const unavailableReason = routing.kind === 'admin'
        ? 'Teléfono administrativo de WhatsApp no configurado'
        : 'Limpiadora sin teléfono/opt-in de WhatsApp';
      await supabase.from('notification_deliveries').update({
        status: 'skipped',
        error_message: unavailableReason,
      }).eq('id', delivery?.id);

      const fallback = await sendAdminFallbackEmail(false, unavailableReason);
      const now = new Date().toISOString();

      if (routing.kind === 'admin') {
        await supabase.from('notification_events').update({
          status: fallback.ok ? 'sent' : 'failed',
          processed_at: now,
          error_message: fallback.ok ? unavailableReason : (fallback.errorMessage ?? unavailableReason),
        }).eq('id', eventId);
        return new Response(JSON.stringify({
          ok: fallback.ok,
          status: fallback.ok ? 'fallback_sent' : 'failed',
          fallbackChannel: fallback.ok ? 'email' : null,
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      await supabase.from('notification_events').update({
        status: 'sent',
        processed_at: now,
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

    const fallback = await sendAdminFallbackEmail(result.ok, result.errorMessage ?? null);
    const finalOk = result.ok || fallback.ok;

    await supabase.from('notification_events').update({
      status: finalOk ? 'sent' : 'failed',
      processed_at: now,
      error_message: result.ok ? null : (fallback.ok
        ? `WhatsApp falló; correo de respaldo enviado: ${result.errorMessage ?? 'error desconocido'}`
        : (fallback.errorMessage ?? result.errorMessage)),
    }).eq('id', eventId);

    return new Response(JSON.stringify({
      ok: finalOk,
      status: fallback.ok ? 'fallback_sent' : result.status,
      dryRun: result.dryRun,
      providerMessageId: result.providerMessageId,
      fallbackChannel: fallback.ok ? 'email' : null,
      fallbackProviderMessageId: fallback.providerMessageId,
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
