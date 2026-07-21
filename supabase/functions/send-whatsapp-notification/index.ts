// send-whatsapp-notification: envía una notificación WhatsApp a partir de un
// notification_events.id. En modo preparación queda registrada como 'skipped'.

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { Resend } from 'npm:resend@6.17.2';
import { sendWhatsAppTemplateMessage } from '../_shared/whatsappClient.ts';
import { classifyApprovalCallbackOutcome } from '../_shared/whatsappApprovalOutcome.ts';
import { classifyResendSendResponse } from '../_shared/resendDeliverySemantics.ts';
import { normalizeSpanishPhoneE164 } from '../_shared/phone.ts';
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
  const authorization = req.headers.get('Authorization') ?? '';
  if (!serviceRoleKey || authorization !== `Bearer ${serviceRoleKey}`) {
    return new Response(JSON.stringify({ error: 'Invocación backend no autorizada' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const invokeDerivedNotification = async (derivedEventId: string) => {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify({ eventId: derivedEventId }),
    });
    const payload = await response.json().catch(() => null);
    const completedStatuses = new Set(['sent', 'fallback_sent', 'already_sent']);
    return response.ok
      && payload?.ok === true
      && completedStatuses.has(payload?.status);
  };

  try {
    const {
      eventId,
      forceEmailFallback = false,
      fallbackWhatsappDeliveryId = null,
    } = await req.json();
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

    // Defensa final antes de claim/retry/fallback/proveedor. Los eventos
    // productivos legados (sin batch) siguen live; cualquier evento Hermes,
    // incluso si un writer intentó marcarlo live, queda bloqueado.
    if (event.notification_mode !== 'live' || event.batch_id != null) {
      return new Response(JSON.stringify({ ok: false, status: 'non_live_blocked' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const shouldForceFallback = forceEmailFallback;
    let processingLeaseToken: string | null = null;
    let metaRetryClaimed = false;
    const finalizeClaimedEventFailure = async (errorMessage: string): Promise<boolean> => {
      // Los fallos de la ruta forzada ya parten de un evento terminal y no deben
      // mutarlo. En la ruta normal, solo la generación que conserva el lease
      // puede cerrar el evento y la fila devuelta confirma que lo hizo.
      if (!processingLeaseToken) return true;
      const { data: finalizedEvent, error: finalizeEventError } = await supabase
        .from('notification_events')
        .update({
          status: 'failed',
          processed_at: new Date().toISOString(),
          processing_lease_token: null,
          error_message: errorMessage,
        })
        .eq('id', eventId)
        .eq('status', 'processing')
        .eq('processing_lease_token', processingLeaseToken)
        .select('id')
        .maybeSingle();
      if (finalizeEventError) throw finalizeEventError;
      return Boolean(finalizedEvent);
    };

    if (!shouldForceFallback) {
      const { data: alreadyDelivered, error: alreadyDeliveredError } = await supabase
        .from('notification_deliveries')
        .select('id,status,provider_message_id')
        .eq('notification_event_id', eventId)
        .eq('channel', 'whatsapp')
        .in('status', ['sent', 'delivered', 'read'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (alreadyDeliveredError) throw alreadyDeliveredError;

      if (alreadyDelivered) {
        const { data: finalRows, error: reconcileEventError } = await supabase.rpc(
          'finalize_whatsapp_notification_event',
          { _delivery_id: alreadyDelivered.id, _fallback_ok: false, _fallback_error: null, _send_error: null },
        );
        if (reconcileEventError) throw reconcileEventError;
        const finalEvent = finalRows?.[0];
        if (!finalEvent) throw new Error('Falta estado final de la entrega ya enviada');
        return new Response(JSON.stringify({
          ok: Boolean(finalEvent.send_ok),
          status: 'already_sent',
          eventStatus: finalEvent.event_status,
          providerMessageId: alreadyDelivered.provider_message_id,
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Reutiliza una entrega creada por un worker caído antes de contactar Meta.
      // Si existe más de una, o alguna ya marcó send_started_at, se bloquea el
      // reenvío y se deriva a reconciliación manual: Meta no ofrece idempotencia.
      const { data: queuedDeliveries, error: queuedDeliveriesError } = await supabase
        .from('notification_deliveries')
        .select('id,provider_payload')
        .eq('notification_event_id', eventId)
        .eq('channel', 'whatsapp')
        .eq('status', 'queued')
        .is('provider_message_id', null)
        .order('created_at', { ascending: false })
        .limit(2);
      if (queuedDeliveriesError) throw queuedDeliveriesError;

      const queuedDeliveryIds = (queuedDeliveries ?? []).map((delivery) => delivery.id);
      const hasStartedDelivery = (queuedDeliveries ?? []).some(
        (delivery) => Boolean(delivery.provider_payload?.send_started_at),
      );

      // Política aceptada por operación: priorizar entrega. Tras 15 minutos sin
      // evidencia, SQL puede autorizar exactamente un segundo POST. Existe un
      // riesgo excepcional de duplicado, siempre visible en provider_payload.
      if (queuedDeliveryIds.length === 1 && hasStartedDelivery) {
        processingLeaseToken = crypto.randomUUID();
        const { data: retryDeliveryId, error: retryClaimError } = await supabase.rpc(
          'claim_bounded_whatsapp_retry',
          { _event_id: eventId, _lease_token: processingLeaseToken },
        );
        if (retryClaimError) throw retryClaimError;
        metaRetryClaimed = retryDeliveryId === queuedDeliveryIds[0];
        if (!metaRetryClaimed) processingLeaseToken = null;
      }

      if (queuedDeliveryIds.length > 0 && (hasStartedDelivery || queuedDeliveryIds.length > 1) && !metaRetryClaimed) {
        const reconciliationMessage = 'Resultado de Meta incierto: requiere reconciliación manual para evitar duplicados';
        let concurrentlyReconciled: { deliveryId: string; status: string; providerMessageId?: string } | null = null;
        for (const queuedDeliveryId of queuedDeliveryIds) {
          const { data: recoveryRows, error: uncertainDeliveryUpdateError } = await supabase.rpc(
            'finalize_uncertain_whatsapp_send_delivery',
            {
              _delivery_id: queuedDeliveryId,
              _lease_token: null,
              _provider_response: { worker_recovery: true },
              _error_message: reconciliationMessage,
            },
          );
          if (uncertainDeliveryUpdateError) throw uncertainDeliveryUpdateError;
          const recovery = recoveryRows?.[0];
          if (!recovery) throw new Error('Falta resultado al recuperar una entrega WhatsApp incierta');
          if (!recovery.reconciliation_required) {
            concurrentlyReconciled = {
              deliveryId: queuedDeliveryId,
              status: recovery.effective_status,
              providerMessageId: recovery.provider_message_id ?? undefined,
            };
          }
        }
        if (concurrentlyReconciled) {
          const { data: finalRows, error: reconciledEventError } = await supabase.rpc(
            'finalize_whatsapp_notification_event',
            {
              _delivery_id: concurrentlyReconciled.deliveryId,
              _fallback_ok: false,
              _fallback_error: null,
              _send_error: reconciliationMessage,
            },
          );
          if (reconciledEventError) throw reconciledEventError;
          const finalEvent = finalRows?.[0];
          if (!finalEvent) throw new Error('Falta estado final de la entrega conciliada');
          const reconciledOk = Boolean(finalEvent.send_ok);
          return new Response(JSON.stringify({
            ok: reconciledOk,
            status: `already_reconciled:${finalEvent.effective_delivery_status}`,
            eventStatus: finalEvent.event_status,
            providerMessageId: concurrentlyReconciled.providerMessageId,
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        if (queuedDeliveryIds.length === 1) {
          const { error: exhaustedEventError } = await supabase.rpc(
            'finalize_whatsapp_notification_event',
            {
              _delivery_id: queuedDeliveryIds[0],
              _fallback_ok: false,
              _fallback_error: null,
              _send_error: reconciliationMessage,
            },
          );
          if (exhaustedEventError) throw exhaustedEventError;
        }
        return new Response(JSON.stringify({ ok: false, status: 'reconciliation_required' }), {
          status: 202,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Si el reintento acotado ya obtuvo un lease desde SQL, no repetimos el
      // claim genérico del evento. En la ruta normal, un claim abandonado puede
      // recuperarse después de 10 minutos.
      if (!metaRetryClaimed) {
        const claimedAt = new Date().toISOString();
        const staleBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        processingLeaseToken = crypto.randomUUID();
        let claimedEvent: { id: string } | null = null;

      if (event.status === 'pending') {
        const { data, error: claimEventError } = await supabase
          .from('notification_events')
          .update({
            status: 'processing',
            processed_at: claimedAt,
            processing_lease_token: processingLeaseToken,
            error_message: null,
          })
          .eq('id', eventId)
          .eq('status', 'pending')
          .select('id')
          .maybeSingle();
        if (claimEventError) throw claimEventError;
        claimedEvent = data;
      } else if (
        event.status === 'processing'
        && event.processed_at
        && event.processed_at < staleBefore
      ) {
        const { data, error: reclaimEventError } = await supabase
          .from('notification_events')
          .update({
            processed_at: claimedAt,
            processing_lease_token: processingLeaseToken,
            error_message: null,
          })
          .eq('id', eventId)
          .eq('status', 'processing')
          .lt('processed_at', staleBefore)
          .select('id')
          .maybeSingle();
        if (reclaimEventError) throw reclaimEventError;
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
      }

    }

    const templateName = templateForEventType(event.event_type);
    if (!templateName) {
      const failurePersisted = await finalizeClaimedEventFailure(`Sin plantilla para event_type ${event.event_type}`);
      if (!failurePersisted) {
        return new Response(JSON.stringify({ ok: true, status: 'stale_claim' }), {
          status: 202,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
      return new Response(JSON.stringify({ error: 'Sin plantilla para el evento' }), {
        status: 422,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // 2. Para eventos de batch, snapshots y routing son la fuente durable. El
    // lookup live queda únicamente como fallback para eventos legacy.
    const hasBatchTaskSnapshot = Boolean(
      event.batch_id && event.snapshot && typeof event.snapshot === 'object'
      && Object.keys(event.snapshot).length > 0,
    );
    let task = hasBatchTaskSnapshot ? event.snapshot : null;
    let taskError: { message?: string } | null = null;
    if (!task) {
      const liveTask = await supabase
        .from('tasks')
        .select('*')
        .eq('id', event.task_id)
        .maybeSingle();
      task = liveTask.data;
      taskError = liveTask.error;
    }

    let cleaner = event.batch_id && event.recipient_name_snapshot
      ? {
        id: event.recipient_worker_id ?? event.cleaner_id,
        name: event.recipient_name_snapshot,
        telefono: event.recipient_phone_snapshot,
        whatsapp_phone_e164: event.recipient_phone_snapshot,
      }
      : null;
    let cleanerError: { message?: string } | null = null;
    if (!cleaner) {
      const liveCleaner = await supabase
        .from('cleaners')
        .select('*')
        .eq('id', event.cleaner_id)
        .maybeSingle();
      cleaner = liveCleaner.data;
      cleanerError = liveCleaner.error;
    }

    if (taskError) throw taskError;
    if (cleanerError) throw cleanerError;
    if (!task || !cleaner) {
      const failurePersisted = await finalizeClaimedEventFailure('Tarea o limpiadora no encontrada');
      if (!failurePersisted) {
        return new Response(JSON.stringify({ ok: true, status: 'stale_claim' }), {
          status: 202,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
      return new Response(JSON.stringify({ error: 'Tarea o limpiadora no encontrada' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // 3. Resolver destinatario: trabajadora para eventos normales, administración para rechazos.
    const adminPhone = Deno.env.get('WHATSAPP_ADMIN_PHONE_E164') ?? '';
    const fallbackEmail = Deno.env.get('WHATSAPP_ADMIN_FALLBACK_EMAIL') ?? '';
    const liveRouting = resolveNotificationRecipient(event.event_type, cleaner, adminPhone);
    const snapshotRecipient = event.batch_id
      ? normalizeSpanishPhoneE164(event.recipient_phone_snapshot)
      : null;
    const routing = snapshotRecipient && liveRouting.kind !== 'admin'
      ? { recipient: snapshotRecipient, enabled: true, kind: 'cleaner' as const }
      : liveRouting;
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
        bodyParameters = buildRejectedAlertBodyParameters(cleaner, task, date);
        break;
      default:
        bodyParameters = [name, property, date, start, end].slice(0, def.bodyParamCount);
    }

    const sendAdminFallbackEmail = async (
      whatsappSucceeded: boolean,
      triggerError: string | null,
    ): Promise<{
      attempted: boolean;
      ok: boolean;
      skippedBecauseWhatsappSucceeded?: boolean;
      providerMessageId?: string;
      errorMessage?: string;
    }> => {
      if (!shouldSendAdminEmailFallback(event.event_type, whatsappSucceeded, fallbackEmail)) {
        return { attempted: false, ok: false };
      }

      const emailContent = buildRejectedAlertEmail(cleaner, task, event.payload ?? {}, date);
      const { data: claims, error: claimError } = await supabase.rpc(
        'claim_whatsapp_admin_fallback',
        {
          _notification_event_id: eventId,
          _recipient: fallbackEmail,
          _trigger_error: triggerError,
        },
      );
      if (claimError) return { attempted: false, ok: false, errorMessage: claimError.message };

      const claim = claims?.[0];
      if (claim?.delivery_status === 'whatsapp_succeeded') {
        return {
          attempted: false,
          ok: true,
          skippedBecauseWhatsappSucceeded: true,
          providerMessageId: claim.provider_message_id ?? undefined,
        };
      }
      if (claim?.delivery_status === 'whatsapp_in_flight') {
        return {
          attempted: false,
          ok: false,
          errorMessage: claim.error_message ?? 'WhatsApp pendiente de conciliación',
        };
      }
      if (!claim?.delivery_id) {
        return { attempted: false, ok: false, errorMessage: 'No se pudo reclamar el email de respaldo' };
      }
      if (!claim.claimed) {
        const existingOk = ['sent', 'delivered', 'read'].includes(claim.delivery_status);
        return {
          attempted: false,
          ok: existingOk,
          providerMessageId: claim.provider_message_id ?? undefined,
          errorMessage: existingOk
            ? undefined
            : (claim.error_message ?? 'Email de respaldo en curso; se reintentará el webhook'),
        };
      }

      const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
      const fallbackFrom = Deno.env.get('WHATSAPP_ADMIN_FALLBACK_FROM')
        ?? 'Limpatex Gestión <alertas@limpatexgestion.es>';
      let providerMessageId: string | undefined;
      let errorMessage: string | undefined;
      let uncertainResult = false;

      if (!claim.claim_token) {
        return { attempted: false, ok: false, errorMessage: 'Claim de fallback sin token de fencing' };
      }
      if (!resendApiKey) {
        errorMessage = 'RESEND_API_KEY no configurada';
      } else {
        const { data: sendIntentStarted, error: sendIntentError } = await supabase.rpc(
          'begin_whatsapp_admin_fallback_send',
          {
            _delivery_id: claim.delivery_id,
            _notification_event_id: eventId,
            _claim_token: claim.claim_token,
          },
        );
        if (sendIntentError) {
          return { attempted: false, ok: false, errorMessage: sendIntentError.message };
        }
        if (!sendIntentStarted) {
          return { attempted: false, ok: false, errorMessage: 'Fallback email reclamado por otro worker o bloqueado por WhatsApp' };
        }

        try {
          const response = await new Resend(resendApiKey).emails.send(
            {
              from: fallbackFrom,
              to: [fallbackEmail],
              subject: emailContent.subject,
              html: emailContent.html,
            },
            { idempotencyKey: `whatsapp-admin-fallback/${eventId}` },
          );
          const resendOutcome = classifyResendSendResponse(response);
          uncertainResult = resendOutcome.effectUncertain;
          providerMessageId = resendOutcome.providerMessageId ?? undefined;
          errorMessage = resendOutcome.errorMessage ?? undefined;
        } catch (error) {
          uncertainResult = true;
          errorMessage = error instanceof Error ? error.message : String(error);
        }
      }

      const { data: effectiveFallbackStatus, error: deliveryUpdateError } = await supabase.rpc(
        'finalize_whatsapp_admin_fallback_send',
        {
          _delivery_id: claim.delivery_id,
          _notification_event_id: eventId,
          _claim_token: claim.claim_token,
          _provider_message_id: providerMessageId ?? null,
          _uncertain: uncertainResult,
          _error_message: errorMessage ?? null,
        },
      );
      if (deliveryUpdateError) {
        return { attempted: true, ok: false, errorMessage: deliveryUpdateError.message };
      }

      const effectiveOk = effectiveFallbackStatus === 'sent';
      return {
        attempted: true,
        ok: effectiveOk,
        providerMessageId: effectiveOk ? providerMessageId : undefined,
        errorMessage: effectiveOk ? undefined : errorMessage,
      };
    };

    if (shouldForceFallback) {
      if (event.event_type !== 'task_rejected_alert') {
        return new Response(JSON.stringify({ error: 'Fallback forzado no permitido para este evento' }), {
          status: 422,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // El callback propaga la entrega exacta que falló. Para reintentos
      // históricos sin ese dato solo aceptamos una única delivery fallida;
      // nunca inferimos por "la más reciente".
      let resolvedFallbackDeliveryId = fallbackWhatsappDeliveryId;
      if (!resolvedFallbackDeliveryId) {
        const { data: failedCandidates, error: failedCandidatesError } = await supabase
          .from('notification_deliveries')
          .select('id')
          .eq('notification_event_id', eventId)
          .eq('channel', 'whatsapp')
          .eq('provider', 'meta_cloud_api')
          .eq('status', 'failed')
          .limit(2);
        if (failedCandidatesError) throw failedCandidatesError;
        if ((failedCandidates ?? []).length !== 1) {
          return new Response(JSON.stringify({ error: 'Entrega WhatsApp ambigua para el fallback' }), {
            status: 409,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        resolvedFallbackDeliveryId = failedCandidates[0].id;
      }

      const { data: fallbackWhatsappDelivery, error: fallbackWhatsappDeliveryError } = await supabase
        .from('notification_deliveries')
        .select('id,status')
        .eq('id', resolvedFallbackDeliveryId)
        .eq('notification_event_id', eventId)
        .eq('channel', 'whatsapp')
        .eq('provider', 'meta_cloud_api')
        .maybeSingle();
      if (fallbackWhatsappDeliveryError) throw fallbackWhatsappDeliveryError;
      if (!fallbackWhatsappDelivery) {
        return new Response(JSON.stringify({ error: 'Entrega WhatsApp no encontrada para el fallback' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      if (fallbackWhatsappDelivery.status !== 'failed') {
        return new Response(JSON.stringify({ error: 'La entrega indicada no está fallida' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      const fallback = await sendAdminFallbackEmail(false, 'Meta informó fallo asíncrono de WhatsApp');
      const fallbackEmailSent = fallback.ok && !fallback.skippedBecauseWhatsappSucceeded;
      const { data: finalRows, error: forcedFallbackEventError } = await supabase.rpc(
        'finalize_whatsapp_notification_event',
        {
          _delivery_id: fallbackWhatsappDelivery.id,
          _fallback_ok: fallbackEmailSent,
          _fallback_error: fallback.errorMessage,
          _send_error: 'Meta informó fallo asíncrono de WhatsApp',
        },
      );
      if (forcedFallbackEventError) throw forcedFallbackEventError;
      const finalEvent = finalRows?.[0];
      if (!finalEvent) throw new Error('Falta estado final del fallback administrativo');
      const completed = Boolean(finalEvent.send_ok) || fallbackEmailSent;
      const responseStatus = fallback.skippedBecauseWhatsappSucceeded
        ? 'already_sent'
        : (fallbackEmailSent ? 'fallback_sent' : (finalEvent.send_ok ? 'already_sent' : 'failed'));

      return new Response(JSON.stringify({
        ok: completed,
        status: responseStatus,
        eventStatus: finalEvent.event_status,
        fallbackChannel: fallbackEmailSent ? 'email' : null,
        fallbackProviderMessageId: fallbackEmailSent ? fallback.providerMessageId : undefined,
        providerMessageId: fallback.skippedBecauseWhatsappSucceeded ? fallback.providerMessageId : undefined,
      }), {
        status: completed ? 200 : 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // El correlador de botón es estable por evento. Ambos POST del presupuesto
    // acotado 2/2 deben aceptar el mismo payload para que un callback firmado
    // del primer intento siga siendo vinculable durante la preparación del segundo.
    const nonce = eventId.replaceAll('-', '').slice(0, 8);
    let buttonPayloads: string[] | undefined;
    if (def.hasButtons) {
      if (templateName === 'task_late_start_reminder_es') {
        buttonPayloads = [`late_started:${task.id}:${nonce}`, `late_issue:${task.id}:${nonce}`];
      } else {
        buttonPayloads = [`approve:${task.id}:${nonce}`, `reject:${task.id}:${nonce}`];
      }
    }

    // 6. Preparar o recuperar la única delivery activa bajo el mismo lease.
    // La RPC serializa por evento y rechaza workers cuya generación caducó.
    if (!processingLeaseToken) {
      throw new Error('Falta token de lease para preparar la entrega WhatsApp');
    }
    const { data: preparedRows, error: prepareDeliveryError } = await supabase.rpc(
      'prepare_whatsapp_send_delivery',
      {
        _event_id: eventId,
        _lease_token: processingLeaseToken,
        _recipient: recipient ?? 'sin_telefono',
        _template_name: templateName,
        _provider_payload: { bodyParameters, buttonPayloads },
      },
    );
    if (prepareDeliveryError) throw prepareDeliveryError;
    const prepared = preparedRows?.[0];
    if (!prepared) throw new Error('Falta resultado al preparar la entrega WhatsApp');

    if (prepared.effective_status === 'stale_lease') {
      return new Response(JSON.stringify({ ok: true, status: 'already_processing' }), {
        status: 202,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
    if (['sent', 'delivered', 'read'].includes(prepared.effective_status)) {
      return new Response(JSON.stringify({
        ok: true,
        status: 'already_sent',
        providerMessageId: prepared.provider_message_id,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
    if (prepared.effective_status === 'fallback_sent') {
      return new Response(JSON.stringify({
        ok: true,
        status: 'fallback_sent',
        fallbackChannel: 'email',
        fallbackProviderMessageId: prepared.provider_message_id,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
    if (prepared.effective_status === 'fallback_committed') {
      return new Response(JSON.stringify({ ok: false, status: 'reconciliation_required' }), {
        status: 202,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
    if (prepared.reconciliation_required) {
      return new Response(JSON.stringify({ ok: false, status: 'reconciliation_required' }), {
        status: 202,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
    if (!prepared.ready_to_send || !prepared.delivery_id) {
      throw new Error(`Entrega WhatsApp no preparada: ${prepared.effective_status}`);
    }
    const delivery = { id: prepared.delivery_id };

    // Si no hay canal WhatsApp disponible, la alerta administrativa cae a correo.
    if (!enabled) {
      const unavailableReason = routing.kind === 'admin'
        ? 'Teléfono administrativo de WhatsApp no configurado'
        : 'Limpiadora sin teléfono/opt-in de WhatsApp';
      const { data: skippedFinalized, error: skippedUpdateError } = await supabase.rpc(
        'finalize_whatsapp_unavailable_delivery',
        {
          _delivery_id: delivery.id,
          _event_id: eventId,
          _lease_token: processingLeaseToken,
          _reason: unavailableReason,
        },
      );
      if (skippedUpdateError) throw skippedUpdateError;
      if (!skippedFinalized) {
        return new Response(JSON.stringify({ ok: true, status: 'already_processing' }), {
          status: 202,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      const fallback = await sendAdminFallbackEmail(false, unavailableReason);
      const fallbackEmailSent = fallback.ok && !fallback.skippedBecauseWhatsappSucceeded;
      const fallbackSucceeded = fallbackEmailSent || Boolean(fallback.skippedBecauseWhatsappSucceeded);

      if (routing.kind === 'admin') {
        const { error: adminFallbackEventError } = await supabase.rpc(
          'finalize_whatsapp_notification_event',
          {
            _delivery_id: delivery.id,
            _fallback_ok: fallbackEmailSent,
            _fallback_error: fallback.errorMessage ?? null,
            _send_error: unavailableReason,
          },
        );
        if (adminFallbackEventError) throw adminFallbackEventError;
        return new Response(JSON.stringify({
          ok: fallbackSucceeded,
          status: fallback.skippedBecauseWhatsappSucceeded
            ? 'already_sent'
            : (fallbackEmailSent ? 'fallback_sent' : 'failed'),
          fallbackChannel: fallbackEmailSent ? 'email' : null,
          providerMessageId: fallback.skippedBecauseWhatsappSucceeded
            ? fallback.providerMessageId
            : undefined,
        }), {
          status: fallbackSucceeded ? 200 : 502,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      return new Response(JSON.stringify({ ok: false, status: 'skipped', reason: 'cleaner_not_enabled' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // 7. Persistir intención solo si este worker conserva el lease. La RPC
    // serializa el evento y la delivery; un worker reanudado con token antiguo
    // se detiene antes de contactar Meta.
    const { data: sendIntentStarted, error: sendIntentError } = await supabase.rpc(
      'begin_whatsapp_send_delivery',
      {
        _delivery_id: delivery.id,
        _event_id: eventId,
        _lease_token: processingLeaseToken,
        _provider_payload: { bodyParameters, buttonPayloads },
      },
    );
    if (sendIntentError) throw sendIntentError;
    if (!sendIntentStarted) {
      return new Response(JSON.stringify({ ok: true, status: 'already_processing' }), {
        status: 202,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // 8. Enviar (o dry-run según feature flag)
    const sendResult = await sendWhatsAppTemplateMessage({
      to: recipient as string,
      templateName,
      languageCode: def.languageCode,
      bodyParameters,
      buttonPayloads,
      idempotencyKey: event.dedupe_key,
    });

    const now = new Date().toISOString();
    const uncertainSendResult = sendResult.effectUncertain === true;
    let effectiveDeliveryStatus = sendResult.status;
    let effectiveProviderMessageId = sendResult.providerMessageId;
    if (uncertainSendResult) {
      const reconciliationMessage = metaRetryClaimed
        ? `Resultado de Meta incierto (${sendResult.errorCode}) tras el intento 2/2: reintentos automáticos agotados; requiere conciliación manual`
        : `Resultado de Meta incierto (${sendResult.errorCode}): tras 15 minutos se permitirá un único reintento 2/2 para priorizar entrega; existe riesgo excepcional de duplicado`;
      const { data: uncertainRows, error: uncertainDeliveryUpdateError } = await supabase.rpc(
        'finalize_uncertain_whatsapp_send_delivery',
        {
          _delivery_id: delivery.id,
          _lease_token: processingLeaseToken,
          _provider_response: sendResult.response ?? {},
          _error_message: reconciliationMessage,
        },
      );
      if (uncertainDeliveryUpdateError) throw uncertainDeliveryUpdateError;
      const uncertainResolution = uncertainRows?.[0];
      if (!uncertainResolution) throw new Error('Falta resultado de conciliación del envío incierto');
      effectiveDeliveryStatus = uncertainResolution.effective_status;
      effectiveProviderMessageId = uncertainResolution.provider_message_id ?? undefined;

      if (uncertainResolution.reconciliation_required) {
        const { data: uncertainEventRows, error: uncertainEventUpdateError } = await supabase.rpc(
          'finalize_whatsapp_notification_event',
          {
            _delivery_id: delivery.id,
            _fallback_ok: false,
            _fallback_error: null,
            _send_error: reconciliationMessage,
          },
        );
        if (uncertainEventUpdateError) throw uncertainEventUpdateError;
        const uncertainEvent = uncertainEventRows?.[0];
        if (!uncertainEvent) throw new Error('Falta estado final del envío incierto');

        // Si un botón se vinculó entre ambas RPC, la segunda lectura bajo
        // bloqueo observa sent/delivered/read y nunca vuelve a processing.
        if (uncertainEvent.send_ok) {
          return new Response(JSON.stringify({
            ok: true,
            status: `already_reconciled:${uncertainEvent.effective_delivery_status}`,
            eventStatus: uncertainEvent.event_status,
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        return new Response(JSON.stringify({
          ok: false,
          status: 'reconciliation_required',
          eventStatus: uncertainEvent.event_status,
        }), {
          status: 202,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    if (!uncertainSendResult && sendResult.providerMessageId) {
      const { data: finalizedStatus, error: finalizeDeliveryError } = await supabase.rpc(
        'finalize_whatsapp_send_delivery',
        {
          _delivery_id: delivery.id,
          _lease_token: processingLeaseToken,
          _provider_message_id: sendResult.providerMessageId,
          _provider_response: sendResult.response ?? {},
          _sent_at: now,
        },
      );
      if (finalizeDeliveryError) throw finalizeDeliveryError;
      effectiveDeliveryStatus = finalizedStatus ?? sendResult.status;
      effectiveProviderMessageId = sendResult.providerMessageId;
    } else if (!uncertainSendResult) {
      const { data: nonDeliveryRows, error: nonDeliveryError } = await supabase.rpc(
        'finalize_whatsapp_non_delivery_result',
        {
          _delivery_id: delivery.id,
          _lease_token: processingLeaseToken,
          _result_status: sendResult.status,
          _provider_response: sendResult.response ?? {},
          _error_code: sendResult.errorCode ?? null,
          _error_message: sendResult.errorMessage ?? null,
        },
      );
      if (nonDeliveryError) throw nonDeliveryError;
      const nonDeliveryResolution = nonDeliveryRows?.[0];
      if (!nonDeliveryResolution) throw new Error('Falta resultado final del intento WhatsApp sin entrega');
      effectiveDeliveryStatus = nonDeliveryResolution.effective_status;
      effectiveProviderMessageId = nonDeliveryResolution.provider_message_id ?? undefined;
    }

    // Un callback firmado puede adelantarse unos segundos a esta persistencia.
    // Reproducimos estados y botones guardados en la bandeja duradera.
    let replayedFailure = effectiveDeliveryStatus === 'failed';
    let replayedFailedCallbackIds: string[] = [];
    if (effectiveProviderMessageId) {
      const { data: replayedStatuses, error: replayStatusError } = await supabase.rpc(
        'replay_whatsapp_status_callbacks',
        { _provider_message_id: effectiveProviderMessageId },
      );
      if (replayStatusError) throw replayStatusError;
      replayedFailure = replayedFailure || (replayedStatuses ?? []).some(
        (status: { effective_status?: string }) => status.effective_status === 'failed',
      );
      replayedFailedCallbackIds = (replayedStatuses ?? [])
        .filter((status: { effective_status?: string }) => status.effective_status === 'failed')
        .map((status: { callback_id: string }) => status.callback_id);

      const { data: pendingButtons, error: pendingButtonsError } = await supabase
        .from('whatsapp_webhook_inbox')
        .select('id,whatsapp_message_id,sender,button_payload,action,task_id,occurred_at')
        .eq('callback_kind', 'button')
        .eq('processing_status', 'pending')
        .eq('provider_message_id', effectiveProviderMessageId)
        .order('occurred_at', { ascending: true });
      if (pendingButtonsError) throw pendingButtonsError;

      for (const callback of pendingButtons ?? []) {
        const { data: outcomes, error: replayButtonError } = await supabase.rpc(
          'apply_whatsapp_approval_response',
          {
            _whatsapp_message_id: callback.whatsapp_message_id,
            _source_provider_message_id: effectiveProviderMessageId,
            _sender: callback.sender,
            _button_payload: callback.button_payload,
            _action: callback.action,
            _task_id: callback.task_id,
            _occurred_at: callback.occurred_at,
          },
        );
        if (replayButtonError) throw replayButtonError;
        const outcomeRow = outcomes?.[0];
        const outcome = outcomeRow?.outcome;
        const classification = classifyApprovalCallbackOutcome(
          callback.action,
          outcome,
          outcomeRow?.rejection_event_id,
        );
        if (classification.missingDerivedEvent) {
          throw new Error('rejection_event_missing_after_sender_replay');
        }
        if (classification.derivedEventId) {
          const rejectionSent = await invokeDerivedNotification(classification.derivedEventId);
          if (!rejectionSent) {
            throw new Error('rejection_notification_failed_after_sender_replay');
          }
        }
        const processed = classification.processed;
        const { error: markReplayError } = await supabase.rpc('mark_whatsapp_webhook_callback', {
          _callback_id: callback.id,
          _outcome: outcome ?? 'approval_outcome_missing',
          _processed: processed,
          _last_error: processed ? null : 'delivery_persisted_but_button_not_correlated',
        });
        if (markReplayError) throw markReplayError;
      }
    }

    const fallback = await sendAdminFallbackEmail(
      ['sent', 'delivered', 'read'].includes(effectiveDeliveryStatus) && !replayedFailure,
      replayedFailure ? 'Meta informó fallo antes de persistir la respuesta de envío' : (sendResult.errorMessage ?? null),
    );
    const fallbackEmailSent = fallback.ok && !fallback.skippedBecauseWhatsappSucceeded;

    // La RPC vuelve a leer y bloquea la delivery después del replay. Así, un
    // callback concurrente decide el estado final y delivered/read se traducen
    // al único estado lógico válido del evento: sent.
    const { data: finalEventRows, error: finalEventError } = await supabase.rpc(
      'finalize_whatsapp_notification_event',
      {
        _delivery_id: delivery.id,
        _fallback_ok: fallbackEmailSent,
        _fallback_error: fallback.errorMessage,
        _send_error: sendResult.errorMessage,
      },
    );
    if (finalEventError) throw finalEventError;
    const finalEvent = finalEventRows?.[0];
    if (!finalEvent) throw new Error('Falta resultado final del evento WhatsApp');

    const adminFallbackRequired = shouldSendAdminEmailFallback(
      event.event_type,
      false,
      fallbackEmail,
    );
    const replayedFailureResolved = !adminFallbackRequired
      || fallbackEmailSent
      || Boolean(fallback.skippedBecauseWhatsappSucceeded);
    if (replayedFailureResolved) {
      for (const callbackId of replayedFailedCallbackIds) {
        const { error: markFailedReplayError } = await supabase.rpc(
          'mark_whatsapp_webhook_callback',
          {
            _callback_id: callbackId,
            _outcome: 'failed',
            _processed: true,
            _last_error: null,
          },
        );
        if (markFailedReplayError) throw markFailedReplayError;
      }
    }

    effectiveDeliveryStatus = finalEvent.effective_delivery_status;
    const effectiveSendOk = Boolean(finalEvent.send_ok);
    replayedFailure = effectiveDeliveryStatus === 'failed';

    return new Response(JSON.stringify({
      ok: effectiveSendOk || fallbackEmailSent || Boolean(fallback.skippedBecauseWhatsappSucceeded),
      status: fallback.skippedBecauseWhatsappSucceeded
        ? 'already_sent'
        : (fallbackEmailSent ? 'fallback_sent' : effectiveDeliveryStatus),
      eventStatus: finalEvent.event_status,
      dryRun: sendResult.dryRun,
      providerMessageId: effectiveProviderMessageId,
      fallbackChannel: fallbackEmailSent ? 'email' : null,
      fallbackProviderMessageId: fallbackEmailSent ? fallback.providerMessageId : undefined,
    }), {
      status: routing.kind === 'admin'
        ? ((effectiveSendOk || fallbackEmailSent || fallback.skippedBecauseWhatsappSucceeded) ? 200 : 502)
        : 200,
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
