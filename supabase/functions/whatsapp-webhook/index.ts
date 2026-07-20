// whatsapp-webhook: verificación GET de Meta + recepción POST de estados y
// respuestas de botones. Valida la firma X-Hub-Signature-256.
// Si falta WHATSAPP_APP_SECRET, responde 503 para que Meta reintente; nunca se
// confirma un callback que no pudo autenticarse ni persistirse.

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { getWhatsAppConfig, hasWebhookSecret } from '../_shared/featureFlags.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256',
};

const supportedDeliveryStatuses = new Set(['sent', 'delivered', 'read', 'failed']);

/** Valida la firma HMAC SHA256 del cuerpo con el app secret. */
async function isValidSignature(rawBody: string, signatureHeader: string | null, appSecret: string): Promise<boolean> {
  if (!signatureHeader) return false;
  const expectedPrefix = 'sha256=';
  if (!signatureHeader.startsWith(expectedPrefix)) return false;
  const provided = signatureHeader.slice(expectedPrefix.length);

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const computed = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Comparación de longitud constante
  if (computed.length !== provided.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return diff === 0;
}

function parseButtonPayload(payload: string): { action: string; taskId: string; nonce: string } | null {
  const parts = payload.split(':');
  if (
    parts.length !== 3
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parts[1])
    || !/^[A-Za-z0-9_-]{1,32}$/.test(parts[2])
  ) return null;
  return { action: parts[0], taskId: parts[1], nonce: parts[2] };
}

function metaOccurredAt(rawTimestamp: unknown): string | null {
  const seconds = Number(rawTimestamp);
  const nowSeconds = Math.floor(Date.now() / 1000);
  // Meta entrega segundos Unix. Rechazamos enteros fuera del rango razonable
  // para que Date#toISOString nunca convierta el webhook en un 500 permanente.
  if (
    Number.isSafeInteger(seconds)
    && seconds >= 946_684_800 // 2000-01-01
    && seconds <= nowSeconds + 86_400
  ) {
    return new Date(seconds * 1000).toISOString();
  }
  return null;
}

async function signedPayloadDigest(payload: string): Promise<string> {
  const bytes = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const cfg = getWhatsAppConfig();

  // 1. Verificación de webhook (GET)
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    if (mode === 'subscribe' && token && token === cfg.verifyToken) {
      return new Response(challenge ?? '', { status: 200 });
    }
    return new Response('Forbidden', { status: 403 });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const rawBody = await req.text();

  // 2. Sin secret no podemos autenticar ni persistir con seguridad. Respondemos
  // un error temporal para que Meta reintente tras restaurar la configuración.
  if (!hasWebhookSecret()) {
    console.error('whatsapp_webhook_unavailable:missing_app_secret');
    return new Response(JSON.stringify({ ok: false, error: 'webhook_temporarily_unavailable' }), {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': '60',
        ...corsHeaders,
      },
    });
  }

  // 3. Validar firma
  const signature = req.headers.get('x-hub-signature-256');
  const valid = await isValidSignature(rawBody, signature, cfg.appSecret);
  if (!valid) {
    console.error('whatsapp-webhook: firma inválida');
    return new Response('Invalid signature', { status: 401, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const quarantineSignedCallback = async (payload: string, reason: string) => {
    const digest = await signedPayloadDigest(payload);
    const { data, error } = await supabase.rpc('record_whatsapp_webhook_quarantine', {
      _callback_key: `quarantine:${reason}:${digest}`,
      _reason: reason,
    });
    if (error) throw error;
    if (!data) throw new Error('whatsapp_quarantine_id_missing');
    console.warn(`whatsapp_signed_callback_quarantined:${reason}`);
  };

  const recordCallback = async (params: Record<string, unknown>) => {
    const { data: recordedCallbacks, error } = await supabase.rpc(
      'record_whatsapp_webhook_callback',
      params,
    );
    if (error) throw error;
    return recordedCallbacks?.[0]?.callback_id as string | undefined;
  };

  const markCallback = async (
    callbackId: string | undefined,
    outcome: string,
    processed: boolean,
    lastError: string | null = null,
  ) => {
    if (!callbackId) throw new Error('whatsapp_callback_id_missing');
    const { error } = await supabase.rpc('mark_whatsapp_webhook_callback', {
      _callback_id: callbackId,
      _outcome: outcome,
      _processed: processed,
      _last_error: lastError,
    });
    if (error) throw error;
  };

  const invokeNotificationSender = async (
    eventId: string,
    forceEmailFallback: boolean,
    fallbackWhatsappDeliveryId: string | null = null,
  ) => {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify({ eventId, forceEmailFallback, fallbackWhatsappDeliveryId }),
    });
    const payload = await response.json().catch(() => null);
    const completedStatuses = new Set(['sent', 'fallback_sent', 'already_sent']);
    const ok = response.ok
      && payload?.ok === true
      && completedStatuses.has(payload?.status);
    if (!ok) {
      console.error('No se pudo completar send-whatsapp-notification', response.status, payload?.status);
    }
    return { response, payload, ok };
  };

  const applyDeliveryStatusWithRetry = async (
    providerMessageId: string,
    newStatus: string,
    occurredAt: string,
    errorMessage: string | null,
  ) => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: transitions, error } = await supabase.rpc(
        'apply_whatsapp_delivery_status',
        {
          _provider_message_id: providerMessageId,
          _status: newStatus,
          _occurred_at: occurredAt,
          _error_message: errorMessage,
        },
      );
      if (error) throw error;
      const transition = transitions?.[0];
      if (transition) return transition;
      if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, 250 * (2 ** attempt)));
    }
    return null;
  };

  try {
    const retryErrors: string[] = [];
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      await quarantineSignedCallback(rawBody, 'malformed_json');
      return new Response(JSON.stringify({ ok: true, quarantined: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
    if (!Array.isArray(body?.entry) || body.entry.length === 0) {
      await quarantineSignedCallback(rawBody, 'invalid_envelope');
      return new Response(JSON.stringify({ ok: true, quarantined: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
    const entries = body?.entry ?? [];

    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : null;
      if (!changes || changes.length === 0) {
        await quarantineSignedCallback(JSON.stringify(entry ?? null), 'invalid_entry_changes');
        continue;
      }

      for (const change of changes) {
        const value = change?.value;
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          await quarantineSignedCallback(JSON.stringify(change ?? null), 'invalid_change_value');
          continue;
        }

        const hasStatuses = Object.prototype.hasOwnProperty.call(value, 'statuses');
        const hasMessages = Object.prototype.hasOwnProperty.call(value, 'messages');
        const statuses = Array.isArray(value?.statuses) ? value.statuses : [];
        const messages = Array.isArray(value?.messages) ? value.messages : [];
        let invalidCollection = false;

        if (hasStatuses && !Array.isArray(value?.statuses)) {
          await quarantineSignedCallback(JSON.stringify(change), 'invalid_statuses_collection');
          invalidCollection = true;
        }
        if (hasMessages && !Array.isArray(value?.messages)) {
          await quarantineSignedCallback(JSON.stringify(change), 'invalid_messages_collection');
          invalidCollection = true;
        }
        if (statuses.length === 0 && messages.length === 0 && !invalidCollection) {
          await quarantineSignedCallback(JSON.stringify(change), 'empty_callback_value');
          continue;
        }

        // 3a. Estados de entrega
        for (const status of statuses) {
          const providerMessageId = typeof status?.id === 'string' ? status.id.trim() : '';
          const newStatus = typeof status?.status === 'string' ? status.status.trim() : '';
          if (!providerMessageId || !newStatus) {
            await quarantineSignedCallback(JSON.stringify(status), 'invalid_status_payload');
            continue;
          }
          const occurredAt = metaOccurredAt(status?.timestamp);
          if (!occurredAt) {
            await quarantineSignedCallback(JSON.stringify(status), 'invalid_status_timestamp');
            continue;
          }
          const callbackError = newStatus === 'failed' ? JSON.stringify(status?.errors ?? []) : null;
          let callbackId: string | undefined;
          try {
            callbackId = await recordCallback({
              _callback_key: `status:${providerMessageId}:${newStatus}:${status?.timestamp ?? ''}`,
              _callback_kind: 'status',
              _provider_message_id: providerMessageId,
              _whatsapp_message_id: null,
              _sender: status?.recipient_id ?? null,
              _button_payload: null,
              _action: null,
              _task_id: null,
              _delivery_status: newStatus,
              _occurred_at: occurredAt,
              _error_message: callbackError,
            });
          } catch (error) {
            retryErrors.push(`callback_persist:${providerMessageId.slice(0, 24)}`);
            console.error('whatsapp_callback_persist_failed', error instanceof Error ? error.message : error);
            continue;
          }
          if (!supportedDeliveryStatuses.has(newStatus)) {
            await markCallback(
              callbackId,
              'unsupported_status',
              false,
              `Estado Meta no soportado: ${newStatus.slice(0, 30)}`,
            );
            console.warn('whatsapp_unsupported_status_preserved', newStatus.slice(0, 30));
            continue;
          }
          let transition;
          try {
            const { error: bindStatusError } = await supabase.rpc(
              'bind_whatsapp_delivery_from_status',
              {
                _provider_message_id: providerMessageId,
                _recipient: status?.recipient_id ?? '',
                _occurred_at: occurredAt,
              },
            );
            if (bindStatusError) throw bindStatusError;
            transition = await applyDeliveryStatusWithRetry(
              providerMessageId,
              newStatus,
              occurredAt,
              callbackError,
            );
          } catch (error) {
            retryErrors.push(`status_rpc:${providerMessageId.slice(0, 24)}`);
            console.error('whatsapp_status_rpc_failed', error instanceof Error ? error.message : error);
            continue;
          }
          if (!transition) {
            // Puede ser histórico/ajeno o haber llegado antes de persistir el ID.
            // Se conserva para reconciliación sin forzar reintentos infinitos.
            await markCallback(callbackId, 'awaiting_delivery', false);
            console.warn('whatsapp_unknown_status_preserved', providerMessageId.slice(0, 24));
            continue;
          }
          // El callback se cerrará después de cualquier fallback derivado.
          // El claim idempotente permite reintentar también callbacks duplicados.
          if (newStatus === 'failed' && transition.effective_status === 'failed') {
            const { data: notificationEvent, error: notificationEventError } = await supabase
              .from('notification_events')
              .select('event_type')
              .eq('id', transition.notification_event_id)
              .maybeSingle();
            if (notificationEventError) throw notificationEventError;

            if (notificationEvent?.event_type === 'task_rejected_alert') {
              const fallbackResult = await invokeNotificationSender(
                transition.notification_event_id,
                true,
                transition.delivery_id,
              );
              if (!fallbackResult.ok) {
                retryErrors.push(`fallback_notification_failed:${fallbackResult.response.status}`);
                continue;
              }
            }
          }
          await markCallback(callbackId, transition.effective_status, true);
          // El callback solo se cierra después de completar cualquier fallback
          // derivado; si falla, el inbox permanece pendiente para el cron.
        }

        // 3b. Mensajes entrantes (respuestas de botones)
        for (const message of messages) {
          const buttonPayload = message?.button?.payload
            ?? message?.interactive?.button_reply?.id
            ?? null;
          const waMessageId = message?.id ?? null;
          if (!buttonPayload) {
            await quarantineSignedCallback(JSON.stringify(message), 'invalid_button_payload');
            continue;
          }

          const parsed = parseButtonPayload(buttonPayload);
          if (!parsed) {
            await quarantineSignedCallback(JSON.stringify(message), 'invalid_button_payload');
            continue;
          }
          const { action, taskId } = parsed;

          if (!['approve', 'reject', 'late_started', 'late_issue'].includes(action)) {
            await quarantineSignedCallback(JSON.stringify(message), 'unsupported_action');
            continue;
          }

          if (waMessageId) {
            const occurredAt = metaOccurredAt(message?.timestamp);
            const sourceMessageId = message?.context?.id ?? null;
            const sender = message?.from ?? null;
            if (!occurredAt || !sourceMessageId || !sender) {
              await quarantineSignedCallback(JSON.stringify(message), 'invalid_button_context');
              continue;
            }

            let callbackId: string | undefined;
            try {
              callbackId = await recordCallback({
                _callback_key: `button:${waMessageId}`,
                _callback_kind: 'button',
                _provider_message_id: sourceMessageId,
                _whatsapp_message_id: waMessageId,
                _sender: sender,
                _button_payload: buttonPayload,
                _action: action,
                _task_id: taskId,
                _delivery_status: null,
                _occurred_at: occurredAt,
                _error_message: null,
              });
              const { error: bindError } = await supabase.rpc(
                'bind_whatsapp_delivery_from_button',
                {
                  _source_provider_message_id: sourceMessageId,
                  _sender: sender,
                  _button_payload: buttonPayload,
                },
              );
              if (bindError) throw bindError;
            } catch (error) {
              retryErrors.push(`button_callback_persist:${waMessageId.slice(0, 24)}`);
              console.error('whatsapp_button_callback_persist_failed', error instanceof Error ? error.message : error);
              continue;
            }

            const { data: outcomes, error: approvalError } = await supabase.rpc(
              'apply_whatsapp_approval_response',
              {
                _whatsapp_message_id: waMessageId,
                _source_provider_message_id: sourceMessageId,
                _sender: sender,
                _button_payload: buttonPayload,
                _action: action,
                _task_id: taskId,
                _occurred_at: occurredAt,
              },
            );
            if (approvalError) {
              retryErrors.push(`approval_rpc:${waMessageId.slice(0, 24)}`);
              console.error('whatsapp_approval_rpc_failed', approvalError.message);
              continue;
            }
            const outcome = outcomes?.[0];
            if (!outcome) {
              retryErrors.push(`approval_without_result:${waMessageId.slice(0, 24)}`);
              continue;
            }

            if (outcome.outcome === 'source_not_found') {
              await markCallback(callbackId, 'awaiting_delivery', false);
              console.warn('whatsapp_button_source_not_found_preserved');
              continue;
            }

            if (['invalid', 'expired', 'stale', 'superseded', 'not_actionable', 'unauthorized_sender'].includes(outcome.outcome)) {
              await markCallback(callbackId, outcome.outcome, true);
              console.warn(`whatsapp_button_${outcome.outcome}_ignored`);
              continue;
            }

            if (action === 'reject') {
              if (!outcome.rejection_event_id) {
                retryErrors.push(`rejection_alert_missing:${waMessageId.slice(0, 24)}`);
                continue;
              }
              const fallbackResult = await invokeNotificationSender(outcome.rejection_event_id, false);
              if (!fallbackResult.ok) {
                retryErrors.push(`fallback_notification_failed:${fallbackResult.response.status}`);
                continue;
              }
            }
            await markCallback(callbackId, outcome.outcome, true);
          } else {
            await quarantineSignedCallback(JSON.stringify(message), 'invalid_button_context');
          }
        }
      }
    }

    if (retryErrors.length > 0) {
      throw new Error(`whatsapp_batch_retry_required:${retryErrors.join(',')}`);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    console.error('whatsapp-webhook error', error instanceof Error ? error.message : error);
    // Un error transitorio debe hacer que Meta reintente; responder 200 perdería
    // definitivamente el estado o la respuesta de la trabajadora.
    return new Response(JSON.stringify({ ok: false }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
