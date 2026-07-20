// whatsapp-webhook: verificación GET de Meta + recepción POST de estados y
// respuestas de botones. Valida la firma X-Hub-Signature-256.
// Modo preparación: si falta WHATSAPP_APP_SECRET, responde 200 sin procesar.

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { getWhatsAppConfig, hasWebhookSecret } from '../_shared/featureFlags.ts';
import { processApprovalButton } from '../_shared/whatsappApproval.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256',
};

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
  if (parts.length < 3) return null;
  return { action: parts[0], taskId: parts[1], nonce: parts[2] };
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

  // 2. Modo preparación: sin secret no procesamos, pero respondemos 200 (Meta exige 200).
  if (!hasWebhookSecret()) {
    console.log('whatsapp-webhook en modo preparación (sin WHATSAPP_APP_SECRET): evento ignorado de forma segura');
    return new Response(JSON.stringify({ ok: true, mode: 'preparation' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
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

  const invokeNotificationSender = async (eventId: string, forceEmailFallback: boolean) => {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify({ eventId, forceEmailFallback }),
    });
    if (!response.ok) {
      console.error('No se pudo invocar send-whatsapp-notification', response.status);
    }
    return response;
  };

  try {
    const body = JSON.parse(rawBody);
    const entries = body?.entry ?? [];

    for (const entry of entries) {
      for (const change of entry?.changes ?? []) {
        const value = change?.value ?? {};

        // 3a. Estados de entrega
        for (const status of value?.statuses ?? []) {
          const providerMessageId = status?.id;
          const newStatus = status?.status; // sent | delivered | read | failed
          if (!providerMessageId || !newStatus) continue;
          const patch: Record<string, unknown> = { status: newStatus };
          const ts = new Date().toISOString();
          if (newStatus === 'sent') patch.sent_at = ts;
          if (newStatus === 'delivered') patch.delivered_at = ts;
          if (newStatus === 'read') patch.read_at = ts;
          if (newStatus === 'failed') {
            patch.failed_at = ts;
            patch.error_message = JSON.stringify(status?.errors ?? {});
          }
          const { data: updatedDeliveries, error: deliveryUpdateError } = await supabase
            .from('notification_deliveries')
            .update(patch)
            .eq('provider_message_id', providerMessageId)
            .select('id,notification_event_id');
          if (deliveryUpdateError) throw deliveryUpdateError;

          if (newStatus === 'failed') {
            for (const delivery of updatedDeliveries ?? []) {
              const { data: notificationEvent } = await supabase
                .from('notification_events')
                .select('event_type')
                .eq('id', delivery.notification_event_id)
                .maybeSingle();
              if (notificationEvent?.event_type !== 'task_rejected_alert') continue;

              const fallbackResponse = await invokeNotificationSender(
                delivery.notification_event_id,
                true,
              );
              if (!fallbackResponse.ok) {
                console.error('No se pudo activar fallback email', fallbackResponse.status);
              }
            }
          }
        }

        // 3b. Mensajes entrantes (respuestas de botones)
        for (const message of value?.messages ?? []) {
          const buttonPayload = message?.button?.payload
            ?? message?.interactive?.button_reply?.id
            ?? null;
          const waMessageId = message?.id ?? null;
          if (!buttonPayload) continue;

          const parsed = parseButtonPayload(buttonPayload);
          if (!parsed) continue;
          const { action, taskId } = parsed;

          if ((action === 'approve' || action === 'reject') && waMessageId) {
            const { data: task, error: taskError } = await supabase
              .from('tasks')
              .select('cleaner_id')
              .eq('id', taskId)
              .single();
            if (taskError || !task) throw taskError ?? new Error('Tarea no encontrada');

            let rejectionAlertEventId: string | null = null;
            await processApprovalButton({
              taskId,
              cleanerId: task.cleaner_id ?? null,
              action,
              whatsappMessageId: waMessageId,
              occurredAt: new Date().toISOString(),
            }, {
              async wasMessageProcessed(messageId) {
                const { data, error } = await supabase
                  .from('task_approval_events')
                  .select('id')
                  .eq('whatsapp_message_id', messageId)
                  .maybeSingle();
                if (error) throw error;
                return Boolean(data);
              },
              async updateTask(id, patch) {
                const { error } = await supabase.from('tasks').update(patch).eq('id', id);
                if (error) throw error;
              },
              async insertAudit(input) {
                const { error } = await supabase.from('task_approval_events').insert({
                  task_id: input.taskId,
                  cleaner_id: input.cleanerId,
                  action: input.action,
                  source: 'whatsapp',
                  whatsapp_message_id: input.whatsappMessageId,
                });
                if (error) throw error;
              },
              async insertRejectionAlert(input) {
                const { data, error } = await supabase.from('notification_events').insert({
                  event_type: 'task_rejected_alert',
                  entity_type: 'tasks',
                  entity_id: input.taskId,
                  task_id: input.taskId,
                  cleaner_id: input.cleanerId,
                  dedupe_key: input.dedupeKey,
                  payload: {
                    source: 'whatsapp',
                    whatsapp_message_id: input.whatsappMessageId,
                  },
                }).select('id').single();
                if (error?.code === '23505') {
                  const { data: existing } = await supabase
                    .from('notification_events')
                    .select('id')
                    .eq('dedupe_key', input.dedupeKey)
                    .maybeSingle();
                  rejectionAlertEventId = existing?.id ?? null;
                  return;
                }
                if (error) throw error;
                rejectionAlertEventId = data?.id ?? null;
              },
            });

            if (action === 'reject' && rejectionAlertEventId) {
              await invokeNotificationSender(rejectionAlertEventId, false);
            }
          } else if (action === 'late_started' || action === 'late_issue') {
            await supabase.from('task_approval_events').insert({
              task_id: taskId,
              action: 'admin_override',
              source: 'whatsapp',
              whatsapp_message_id: waMessageId,
              reason: action,
            });
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    console.error('whatsapp-webhook error', error instanceof Error ? error.message : error);
    // Aun con error devolvemos 200 para que Meta no reintente en bucle, pero lo registramos.
    return new Response(JSON.stringify({ ok: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
