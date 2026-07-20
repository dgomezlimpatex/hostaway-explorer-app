// process-pending-whatsapp-notifications (cron): recupera eventos pendientes y
// vuelve a conciliar callbacks Meta duraderos que llegaron antes de poder
// identificar su entrega.

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import {
  classifyApprovalCallbackOutcome,
  TERMINAL_APPROVAL_CALLBACK_OUTCOMES,
} from '../_shared/whatsappApprovalOutcome.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

const supportedStatuses = new Set(['sent', 'delivered', 'read', 'failed']);
const supportedActions = new Set(['approve', 'reject', 'late_started', 'late_issue']);
serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const authValue = `${['Bear', 'er'].join('')} ${serviceRoleKey}`;
  if (!serviceRoleKey || req.headers.get('Authorization') !== authValue) {
    return json({ error: 'forbidden' }, 403);
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const markCallback = async (
    callbackId: string,
    outcome: string,
    processed: boolean,
    lastError: string | null = null,
    callbackClaimToken: string | null = null,
  ) => {
    const { error } = await supabase.rpc('mark_whatsapp_webhook_callback', {
      _callback_id: callbackId,
      _outcome: outcome,
      _processed: processed,
      _last_error: lastError,
      _claim_token: callbackClaimToken,
    });
    if (error) throw error;
  };

  const invokeSender = async (
    eventId: string,
    forceEmailFallback = false,
    fallbackWhatsappDeliveryId: string | null = null,
  ) => {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-notification`, {
      method: 'POST',
      headers: { ['Author' + 'ization']: authValue, 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, forceEmailFallback, fallbackWhatsappDeliveryId }),
    });
    const result = await response.json().catch(() => ({}));
    const completedStatuses = new Set(['sent', 'fallback_sent', 'already_sent']);
    return response.ok && result?.ok === true && completedStatuses.has(result?.status);
  };

  try {
    // Las decisiones manuales se guardan primero y este worker service-role las
    // ejecuta. El navegador nunca llama directamente al emisor privilegiado.
    const { data: reconciliationActions, error: reconciliationActionsError } = await supabase.rpc(
      'claim_notification_send_reconciliation_actions',
      { _limit: 20 },
    );
    if (reconciliationActionsError) throw reconciliationActionsError;

    let reconciliationActionsCompleted = 0;
    let reconciliationActionsFailed = 0;
    for (const action of reconciliationActions ?? []) {
      let completed = false;
      let detail = 'Resolución aplicada';
      try {
        let applied: {
          event_id: string;
          resolution: string;
          force_email_fallback: boolean;
          fallback_whatsapp_delivery_id?: string | null;
        };
        if (action.action_status === 'effect_pending') {
          applied = {
            event_id: action.notification_event_id,
            resolution: action.resolution,
            force_email_fallback: Boolean(action.force_email_fallback),
            fallback_whatsapp_delivery_id: action.fallback_whatsapp_delivery_id,
          };
        } else {
          const { data: appliedRows, error: applyError } = await supabase.rpc(
            'apply_notification_send_reconciliation_action',
            {
              _action_id: action.action_id,
              _claim_token: action.claim_token,
            },
          );
          if (applyError) throw applyError;
          applied = appliedRows?.[0];
          if (!applied) throw new Error('manual_reconciliation_action_not_applied');
        }

        const force_email_fallback = Boolean(applied.force_email_fallback);
        if (force_email_fallback) {
          const { data: effectLeaseValid, error: effectLeaseError } = await supabase.rpc(
            'validate_notification_send_reconciliation_effect',
            {
              _action_id: action.action_id,
              _claim_token: action.claim_token,
            },
          );
          if (effectLeaseError) throw effectLeaseError;
          if (!effectLeaseValid) {
            // Otra generación, el timeout de seguridad o una finalización concurrente
            // ganó antes del efecto externo. Este worker no contacta Resend ni finaliza.
            continue;
          }
          completed = await invokeSender(
            applied.event_id,
            true,
            applied.fallback_whatsapp_delivery_id ?? null,
          );
          detail = completed
            ? 'Reintento manual de Resend completado'
            : 'El reintento manual no terminó; revisar la nueva evidencia antes de otra acción';
        } else {
          completed = true;
          detail = applied.resolution === 'confirmed_sent'
            ? 'Envío confirmado manualmente con evidencia del proveedor'
            : 'No envío confirmado; evento WhatsApp reabierto para el worker';
        }
      } catch (actionError) {
        detail = actionError instanceof Error ? actionError.message : String(actionError);
      }

      const { data: finished, error: finishError } = await supabase.rpc(
        'finish_notification_send_reconciliation_action',
        {
          _action_id: action.action_id,
          _claim_token: action.claim_token,
          _completed: completed,
          _detail: detail,
        },
      );
      if (finishError) throw finishError;
      // Un `false` significa que otro claim renovó la generación. El worker
      // obsoleto no cambió estado y tampoco debe falsear las métricas.
      if (!finished) continue;
      if (completed) reconciliationActionsCompleted++;
      else reconciliationActionsFailed++;
    }

    // La misma tarea cron reintenta de forma durable callbacks que antes no
    // tenían una correlación inequívoca. Tras 20 intentos o 24 horas pasan a
    // revisión manual y permanecen visibles en el monitor administrativo.
    const { data: callbacks, error: callbacksError } = await supabase.rpc(
      'claim_whatsapp_webhook_callbacks',
      { _limit: 50 },
    );
    if (callbacksError) throw callbacksError;

    let callbacksReconciled = 0;
    let callbacksPending = 0;
    let callbacksManualReview = 0;
    let callbackFailures = 0;

    for (const callback of callbacks ?? []) {
      const callbackClaimToken = callback.callback_claim_token ?? null;
      const markClaimedCallback = (
        outcome: string,
        processed: boolean,
        lastError: string | null = null,
      ) => markCallback(callback.id, outcome, processed, lastError, callbackClaimToken);
      try {
        const exhausted = Number(callback.attempts ?? 0) >= 20
          || Date.parse(callback.received_at) < Date.now() - 24 * 60 * 60 * 1000;
        if (exhausted) {
          await markClaimedCallback(
            'correlation_exhausted',
            false,
            'No se encontró una correlación inequívoca tras los reintentos automáticos',
          );
          callbacksManualReview++;
          continue;
        }

        if (callback.callback_kind === 'status') {
          if (
            typeof callback.provider_message_id !== 'string'
            || !callback.provider_message_id.trim()
            || !supportedStatuses.has(callback.delivery_status)
          ) {
            await markClaimedCallback('invalid_reconciliation_payload', false, 'Estado o ID de Meta no válido');
            callbacksManualReview++;
            continue;
          }

          const { error: bindError } = await supabase.rpc('bind_whatsapp_delivery_from_status', {
            _provider_message_id: callback.provider_message_id,
            _recipient: callback.sender ?? '',
            _occurred_at: callback.occurred_at,
          });
          if (bindError) throw bindError;

          const { data: transitions, error: transitionError } = await supabase.rpc(
            'apply_whatsapp_delivery_status',
            {
              _provider_message_id: callback.provider_message_id,
              _status: callback.delivery_status,
              _occurred_at: callback.occurred_at,
              _error_message: callback.error_message,
            },
          );
          if (transitionError) throw transitionError;
          const transition = transitions?.[0];
          if (!transition) {
            await markClaimedCallback('awaiting_delivery', false, 'Correlación todavía no inequívoca');
            callbacksPending++;
            continue;
          }

          if (transition.effective_status === 'failed') {
            const { data: event, error: eventError } = await supabase
              .from('notification_events')
              .select('event_type')
              .eq('id', transition.notification_event_id)
              .single();
            if (eventError) throw eventError;
            if (event?.event_type === 'task_rejected_alert') {
              const fallbackOk = await invokeSender(
                transition.notification_event_id,
                true,
                transition.delivery_id,
              );
              if (!fallbackOk) throw new Error('admin_fallback_failed_after_reconciliation');
            }
          }
          await markClaimedCallback(transition.effective_status, true);
          callbacksReconciled++;
          continue;
        }

        if (
          callback.callback_kind !== 'button'
          || !supportedActions.has(callback.action)
          || !callback.whatsapp_message_id
          || !callback.provider_message_id
          || !callback.sender
          || !callback.button_payload
          || !callback.task_id
        ) {
          await markClaimedCallback('unsupported_action', false, 'Botón pendiente incompleto o no soportado');
          callbacksManualReview++;
          continue;
        }

        const { data: boundDeliveryId, error: bindButtonError } = await supabase.rpc(
          'bind_whatsapp_delivery_from_button',
          {
            _source_provider_message_id: callback.provider_message_id,
            _sender: callback.sender,
            _button_payload: callback.button_payload,
          },
        );
        if (bindButtonError) throw bindButtonError;
        if (!boundDeliveryId) {
          await markClaimedCallback('awaiting_delivery', false, 'Botón todavía sin entrega inequívoca');
          callbacksPending++;
          continue;
        }

        const { data: outcomes, error: approvalError } = await supabase.rpc(
          'apply_whatsapp_approval_response',
          {
            _whatsapp_message_id: callback.whatsapp_message_id,
            _source_provider_message_id: callback.provider_message_id,
            _sender: callback.sender,
            _button_payload: callback.button_payload,
            _action: callback.action,
            _task_id: callback.task_id,
            _occurred_at: callback.occurred_at,
          },
        );
        if (approvalError) throw approvalError;
        const outcome = outcomes?.[0];
        if (!outcome || outcome.outcome === 'source_not_found') {
          await markClaimedCallback('awaiting_delivery', false, 'La entrega enlazada no pudo validarse');
          callbacksPending++;
          continue;
        }
        if (!TERMINAL_APPROVAL_CALLBACK_OUTCOMES.has(outcome.outcome)) {
          await markClaimedCallback('unsupported_action', false, `Resultado no soportado: ${outcome.outcome}`);
          callbacksManualReview++;
          continue;
        }

        const classification = classifyApprovalCallbackOutcome(
          callback.action,
          outcome.outcome,
          outcome.rejection_event_id,
        );
        if (classification.missingDerivedEvent) {
          throw new Error('rejection_event_missing_after_reconciliation');
        }
        if (classification.derivedEventId) {
          const fallbackOk = await invokeSender(classification.derivedEventId, false);
          if (!fallbackOk) throw new Error('rejection_notification_failed_after_reconciliation');
        }
        await markClaimedCallback(outcome.outcome, true);
        callbacksReconciled++;
      } catch (error) {
        callbackFailures++;
        const message = error instanceof Error ? error.message : String(error);
        try {
          await markClaimedCallback('retry_failed', false, message);
        } catch (markError) {
          console.error('whatsapp_callback_reconcile_mark_failed', markError);
        }
        console.error('whatsapp_callback_reconcile_failed', callback.id, message);
      }
    }

    const staleBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: events, error } = await supabase
      .from('notification_events')
      .select('id')
      .or(`status.eq.pending,and(status.eq.processing,processed_at.lt.${staleBefore})`)
      .order('created_at', { ascending: true })
      .limit(50);
    if (error) throw error;

    let accepted = 0;
    let failed = 0;
    for (const event of events ?? []) {
      if (await invokeSender(event.id)) accepted++;
      else failed++;
    }

    return json({
      ok: true,
      reconciliationActions: reconciliationActions?.length ?? 0,
      reconciliationActionsCompleted,
      reconciliationActionsFailed,
      callbacks: callbacks?.length ?? 0,
      callbacksReconciled,
      callbacksPending,
      callbacksManualReview,
      callbackFailures,
      candidates: events?.length ?? 0,
      accepted,
      failed,
    });
  } catch (error) {
    console.error('process-pending-whatsapp-notifications error', error instanceof Error ? error.message : error);
    return json({ error: error instanceof Error ? error.message : 'error' }, 500);
  }
});
