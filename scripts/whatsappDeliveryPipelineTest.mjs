import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isAmbiguousWhatsAppHttpStatus } from '../supabase/functions/_shared/whatsappDeliverySemantics.ts';
import {
  classifyResendSendResponse,
  isAmbiguousResendError,
} from '../supabase/functions/_shared/resendDeliverySemantics.ts';

for (const status of [408, 429, 500, 503]) {
  assert.equal(isAmbiguousWhatsAppHttpStatus(status), true, `HTTP ${status} debe ser incierto`);
}
for (const status of [400, 401, 403, 404]) {
  assert.equal(isAmbiguousWhatsAppHttpStatus(status), false, `HTTP ${status} debe ser rechazo definitivo`);
}
for (const statusCode of [408, 429, 500, 503, null]) {
  assert.equal(isAmbiguousResendError({ statusCode }), true, `Resend ${statusCode} debe ser incierto`);
}
for (const statusCode of [400, 401, 403, 404, 422]) {
  assert.equal(isAmbiguousResendError({ statusCode }), false, `Resend ${statusCode} debe ser rechazo definitivo`);
}
for (const response of [
  {},
  { data: null },
  { data: {} },
  { data: { id: '' } },
  { data: { id: '   ' } },
]) {
  assert.deepEqual(
    classifyResendSendResponse(response),
    {
      effectUncertain: true,
      providerMessageId: null,
      errorMessage: 'Resend respondió sin ID de mensaje; efecto incierto',
    },
    'un 2xx sin ID no demuestra que Resend no aceptó el correo',
  );
}
assert.deepEqual(
  classifyResendSendResponse({ data: { id: 'email-provider-id' } }),
  { effectUncertain: false, providerMessageId: 'email-provider-id', errorMessage: null },
);

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const orchestrator = await read('src/services/notifications/notificationOrchestrator.ts');
assert.doesNotMatch(orchestrator, /isWhatsAppNotificationsEnabled|VITE_WHATSAPP_NOTIFICATIONS_ENABLED/);
assert.match(orchestrator, /status:\s*'pending'/);
assert.doesNotMatch(orchestrator, /supabase\.functions\s*\.invoke\('send-whatsapp-notification'/s);
assert.match(orchestrator, /procesamiento backend asíncrono/);

const assignments = await read('src/services/storage/multipleTaskAssignmentService.ts');
assert.doesNotMatch(
  assignments,
  /createTaskNotificationEvent/,
  'las asignaciones deben generar WhatsApp exclusivamente desde el trigger backend',
);
assert.match(assignments, /sendAssignmentEmails/);
assert.doesNotMatch(assignments, /dedupeKey:\s*`task_assigned:\$\{actualTaskId\}:\$\{cleaner\.id\}`/);

const assignmentTrigger = await read('supabase/migrations/20260718193000_enqueue_task_assignment_notifications.sql');
assert.match(assignmentTrigger, /CREATE OR REPLACE FUNCTION public\.enqueue_task_assignment_notification\(\)/);
assert.match(assignmentTrigger, /AFTER INSERT OR DELETE ON public\.task_assignments/);
assert.match(assignmentTrigger, /TG_OP = 'INSERT'/);
assert.match(assignmentTrigger, /'task_assigned'/);
assert.match(assignmentTrigger, /'task_cancelled'/);
assert.match(assignmentTrigger, /ON CONFLICT \(dedupe_key\) DO NOTHING/);

const taskAssignments = await read('src/services/storage/taskAssignmentService.ts');
assert.doesNotMatch(taskAssignments, /eventType:\s*'task_modified'/);
assert.match(taskAssignments, /eventType:\s*'task_cancelled'/);

const modificationTrigger = await read('supabase/migrations/20260717160000_notify_all_assigned_cleaners_on_task_changes.sql');
assert.match(modificationTrigger, /'task_modified'/);
assert.match(modificationTrigger, /AFTER UPDATE ON public\.tasks/);

const sender = await read('supabase/functions/send-whatsapp-notification/index.ts');
assert.match(sender, /alreadyDelivered/);
assert.match(sender, /\.in\('status', \['sent', 'delivered', 'read'\]\)/);
assert.match(sender, /status:\s*'processing'/);
assert.match(sender, /\.eq\('status', 'pending'\)/);
assert.match(sender, /\.lt\('processed_at', staleBefore\)/);
assert.match(sender, /already_processing/);
assert.match(
  sender,
  /const finalizeClaimedEventFailure[\s\S]{0,700}processingLeaseToken[\s\S]{0,500}\.eq\('status', 'processing'\)[\s\S]{0,180}\.eq\('processing_lease_token', processingLeaseToken\)[\s\S]{0,180}\.maybeSingle\(\)/,
  'los fallos previos al POST deben demostrar la generación del evento y verificar la escritura',
);
assert.doesNotMatch(sender, /missingTemplateEventError|missingEntityEventError/);
assert.match(
  sender,
  /crypto\.randomUUID\(\)[\s\S]{0,1000}processing_lease_token:\s*processingLeaseToken[\s\S]{0,1200}\.lt\('processed_at', staleBefore\)/,
  'cada worker debe conservar una generación durable al recuperar el evento',
);
assert.match(
  sender,
  /rpc\(\s*'begin_whatsapp_send_delivery'/,
  'send_started_at debe persistirse mediante una RPC que invalide workers con lease obsoleto',
);
assert.match(sender, /finalize_whatsapp_notification_event/);
assert.match(sender, /finalEvent\.effective_delivery_status/);
assert.match(sender, /finalEvent\.event_status/);
assert.match(sender, /const effectiveSendOk = Boolean\(finalEvent\.send_ok\)/);
assert.match(
  sender,
  /ok:\s*effectiveSendOk \|\| fallbackEmailSent \|\| Boolean\(fallback\.skippedBecauseWhatsappSucceeded\)/,
);
assert.match(sender, /const uncertainSendResult = sendResult\.effectUncertain === true/);
assert.match(sender, /const resendOutcome = classifyResendSendResponse\(response\)/);
assert.match(sender, /uncertainResult = resendOutcome\.effectUncertain/);
assert.match(sender, /providerMessageId = resendOutcome\.providerMessageId/);
assert.doesNotMatch(
  sender,
  /if \(response\.error\)[\s\S]{0,180}else \{\s*providerMessageId = response\.data\?\.id/,
  'toda respuesta Resend, incluido 2xx sin ID, debe clasificarse por certeza del efecto',
);
assert.doesNotMatch(
  sender,
  /\['network_error', 'missing_provider_message_id'\]\.includes/,
  'la incertidumbre del efecto debe clasificarse en el cliente Meta, no por una lista parcial en el emisor',
);
assert.match(sender, /prepare_whatsapp_send_delivery/);
assert.match(sender, /status:\s*'processing'/);
assert.match(sender, /finalize_whatsapp_send_delivery/);
assert.match(sender, /finalize_whatsapp_non_delivery_result/);
assert.match(
  sender,
  /finalize_whatsapp_send_delivery[\s\S]{0,260}_lease_token:\s*processingLeaseToken/,
  'la respuesta tardía de Meta debe finalizarse con la misma generación que autorizó el POST',
);
assert.match(
  sender,
  /finalize_uncertain_whatsapp_send_delivery[\s\S]{0,260}_lease_token:\s*processingLeaseToken/,
  'el cierre incierto debe demostrar qué generación terminó el contacto con Meta',
);
assert.match(sender, /finalize_uncertain_whatsapp_send_delivery/);
assert.match(sender, /for \(const queuedDeliveryId of queuedDeliveryIds\)/);
assert.doesNotMatch(
  sender,
  /const hasStartedDelivery[\s\S]{0,900}\.from\('notification_deliveries'\)[\s\S]{0,150}\.in\('id', queuedDeliveryIds\)/,
  'la recuperación de workers tampoco puede degradar una conciliación concurrente',
);
assert.match(sender, /effectiveDeliveryStatus/);
assert.match(sender, /effectiveProviderMessageId/);
assert.match(sender, /outcomeRow\?\.rejection_event_id/);
assert.match(sender, /invokeDerivedNotification/);
assert.match(sender, /classifyApprovalCallbackOutcome/);
assert.match(
  sender,
  /rejection_notification_failed_after_sender_replay[\s\S]{0,220}mark_whatsapp_webhook_callback/,
  'el callback de rechazo reproducido no puede cerrarse antes de enviar su alerta',
);
assert.doesNotMatch(
  sender,
  /if \(uncertainSendResult\)[\s\S]{0,500}\.from\('notification_deliveries'\)\.update/,
  'la respuesta incierta debe finalizarse bajo bloqueo sin degradar callbacks concurrentes',
);
assert.doesNotMatch(
  sender,
  /let eventStatusQuery = supabase\.from\('notification_events'\)\.update/,
  'la entrega y el evento final deben resolverse en una sola transacción SQL',
);
assert.doesNotMatch(
  sender,
  /uncertainDelivery[\s\S]{0,700}status:\s*'failed'/,
  'una entrega incierta no puede cerrarse como fallo definitivo',
);
assert.doesNotMatch(
  sender,
  /if \(uncertainResolution\.reconciliation_required\)[\s\S]{0,450}\.from\('notification_events'\)\.update/,
  'el timeout incierto no puede sobrescribir una conciliación concurrente fuera de la RPC',
);
assert.match(
  sender,
  /uncertainEventRows[\s\S]{0,180}finalize_whatsapp_notification_event/,
  'el timeout incierto debe releer delivery y evento bajo bloqueo antes de responder',
);
const forcedFallbackBlock = sender.slice(
  sender.indexOf('if (shouldForceFallback)'),
  sender.indexOf('// 5. Botones'),
);
assert.match(
  sender,
  /eventId,[\s\S]{0,100}forceEmailFallback = false,[\s\S]{0,100}fallbackWhatsappDeliveryId = null/,
  'el emisor debe recibir la delivery exacta que originó el fallback',
);
assert.doesNotMatch(
  forcedFallbackBlock,
  /order\('created_at', \{ ascending: false \}\)/,
  'el fallback no puede escoger la delivery más reciente del evento',
);
assert.match(
  forcedFallbackBlock,
  /\.eq\('id', resolvedFallbackDeliveryId\)/,
  'el fallback debe validar la delivery concreta recibida del callback',
);
assert.match(
  sender,
  /claim\?\.delivery_status === 'whatsapp_succeeded'[\s\S]{0,240}skippedBecauseWhatsappSucceeded:\s*true/,
  'si otra delivery del evento ya tuvo éxito el claim debe impedir el contacto con Resend',
);
assert.doesNotMatch(
  forcedFallbackBlock,
  /status:\s*fallback\.ok \? 'sent' : 'failed'/,
  'el fallback forzado no puede degradar delivered\/read con una escritura directa',
);
assert.match(
  forcedFallbackBlock,
  /_delivery_id:\s*fallbackWhatsappDelivery\.id[\s\S]{0,240}_fallback_ok:\s*fallbackEmailSent/,
  'el fallback forzado debe finalizar contra el estado WhatsApp real bajo bloqueo',
);

const whatsappClient = await read('supabase/functions/_shared/whatsappClient.ts');
assert.match(whatsappClient, /if \(!providerMessageId\)/);
assert.match(whatsappClient, /errorCode:\s*'missing_provider_message_id'/);
assert.match(
  whatsappClient,
  /const effectUncertain = isAmbiguousWhatsAppHttpStatus\(resp\.status\)/,
  'la clasificación HTTP debe pasar por la semántica conductualmente probada',
);
assert.match(whatsappClient, /effectUncertain:\s*true[\s\S]{0,180}errorCode:\s*'network_error'/);
assert.match(whatsappClient, /errorCode:\s*effectUncertain[\s\S]{0,80}`ambiguous_http_\$\{resp\.status\}`/);

const webhookStateMigration = await read('supabase/migrations/20260720240000_harden_whatsapp_webhook_state.sql');
assert.match(webhookStateMigration, /CREATE OR REPLACE FUNCTION public\.finalize_uncertain_whatsapp_send_delivery/);
assert.match(webhookStateMigration, /WHERE row\.id = _delivery_id FOR UPDATE/);
assert.match(webhookStateMigration, /delivery\.provider_message_id IS NOT NULL OR delivery\.status <> 'queued'/);
assert.match(webhookStateMigration, /reconciliation_required boolean/);
assert.match(webhookStateMigration, /error_code = 'reconciliation_required'/);
assert.match(webhookStateMigration, /COALESCE\(delivery\.provider_response, '\{\}'::jsonb\)[\s\S]{0,180}sync_send_response/);
const finalizeNonDeliveryBlock = webhookStateMigration.slice(
  webhookStateMigration.indexOf('CREATE OR REPLACE FUNCTION public.finalize_whatsapp_non_delivery_result'),
  webhookStateMigration.indexOf('CREATE OR REPLACE FUNCTION public.finalize_whatsapp_send_delivery'),
);
assert.ok(
  finalizeNonDeliveryBlock.indexOf("_result_status NOT IN ('failed', 'skipped')") >= 0
    && finalizeNonDeliveryBlock.indexOf('pg_advisory_xact_lock') >= 0
    && finalizeNonDeliveryBlock.indexOf("provider_payload->>'send_lease_token'") >= 0
    && finalizeNonDeliveryBlock.indexOf("delivery.status IN ('sent', 'delivered', 'read')") >= 0,
  'el cierre sin ID solo acepta resultados deterministas, usa lock y fencing y preserva terminales',
);
assert.match(
  webhookStateMigration,
  /REVOKE ALL ON FUNCTION public\.finalize_whatsapp_non_delivery_result\(uuid, uuid, text, jsonb, text, text\)[\s\S]{0,180}GRANT EXECUTE[\s\S]{0,160}service_role/,
  'el finalizador sin ID debe quedar restringido a service_role',
);
const finalizeSendBlock = webhookStateMigration.slice(
  webhookStateMigration.indexOf('CREATE OR REPLACE FUNCTION public.finalize_whatsapp_send_delivery'),
  webhookStateMigration.indexOf('CREATE OR REPLACE FUNCTION public.finalize_uncertain_whatsapp_send_delivery'),
);
assert.ok(
  finalizeSendBlock.indexOf('pg_advisory_xact_lock') >= 0
    && finalizeSendBlock.indexOf('pg_advisory_xact_lock') < finalizeSendBlock.indexOf('FOR UPDATE'),
  'la aceptación síncrona de Meta debe serializar por evento antes de mutar la delivery',
);
const finalizeUncertainBlock = webhookStateMigration.slice(
  webhookStateMigration.indexOf('CREATE OR REPLACE FUNCTION public.finalize_uncertain_whatsapp_send_delivery'),
  webhookStateMigration.indexOf('CREATE OR REPLACE FUNCTION public.finalize_whatsapp_notification_event'),
);
assert.ok(
  finalizeUncertainBlock.indexOf('pg_advisory_xact_lock') >= 0
    && finalizeUncertainBlock.indexOf('pg_advisory_xact_lock') < finalizeUncertainBlock.indexOf('FOR UPDATE'),
  'la finalización incierta debe usar el mismo orden event-lock → delivery-lock',
);
assert.match(webhookStateMigration, /CREATE OR REPLACE FUNCTION public\.finalize_whatsapp_notification_event/);
const finalizeEventBlock = webhookStateMigration.slice(
  webhookStateMigration.indexOf('CREATE OR REPLACE FUNCTION public.finalize_whatsapp_notification_event'),
  webhookStateMigration.indexOf('REVOKE ALL ON FUNCTION public.bind_whatsapp_delivery_from_status'),
);
assert.match(
  finalizeEventBlock,
  /pg_advisory_xact_lock[\s\S]{0,500}FOR UPDATE[\s\S]{0,900}successful_whatsapp/,
  'el finalizador debe serializar por evento antes de bloquear la delivery y calcular el agregado',
);
assert.match(webhookStateMigration, /resolved_send_ok := target\.status IN \('sent', 'delivered', 'read'\) OR successful_whatsapp/);
assert.match(webhookStateMigration, /WHEN resolved_send_ok THEN 'sent'/);
assert.match(webhookStateMigration, /UPDATE public\.notification_events event/);
assert.doesNotMatch(
  webhookStateMigration,
  /CREATE OR REPLACE FUNCTION public\.bind_whatsapp_delivery_from_status[\s\S]{0,1800}normalized_recipient/,
  'un estado sin ID conocido no puede enlazarse heurísticamente por teléfono/tiempo',
);
assert.match(
  webhookStateMigration,
  /CREATE OR REPLACE FUNCTION public\.bind_whatsapp_delivery_from_button[\s\S]{0,2200}error_code = NULL,[\s\S]{0,100}error_message = NULL/,
  'la conciliación inequívoca por botón debe limpiar reconciliation_required',
);
const applyStatusBlock = webhookStateMigration.slice(
  webhookStateMigration.indexOf('CREATE OR REPLACE FUNCTION public.apply_whatsapp_delivery_status'),
  webhookStateMigration.indexOf('REVOKE ALL ON FUNCTION public.apply_whatsapp_delivery_status'),
);
assert.ok(
  applyStatusBlock.indexOf('pg_advisory_xact_lock') >= 0
    && applyStatusBlock.indexOf('pg_advisory_xact_lock') < applyStatusBlock.indexOf('FOR UPDATE')
    && applyStatusBlock.indexOf('FOR UPDATE') < applyStatusBlock.indexOf('SELECT EXISTS (', applyStatusBlock.indexOf('FOR UPDATE')),
  'cada transición Meta debe usar el mismo bloqueo por evento antes de mutar deliveries hermanas',
);
assert.match(
  applyStatusBlock,
  /IF target\.status = 'failed' AND _status <> 'failed' THEN[\s\S]{0,240}RETURN QUERY/,
  'failed de Meta debe ser terminal para que el fallback no compita con una entrega tardía',
);
assert.match(webhookStateMigration, /ADD COLUMN IF NOT EXISTS processing_lease_token uuid/);
assert.match(
  webhookStateMigration,
  /CREATE OR REPLACE FUNCTION public\.begin_whatsapp_send_delivery[\s\S]{0,3200}processing_lease_token IS DISTINCT FROM _lease_token[\s\S]{0,1600}send_started_at/,
  'la intención de envío debe validar la generación y persistirse atómicamente',
);
const prepareSendBlock = webhookStateMigration.slice(
  webhookStateMigration.indexOf('CREATE OR REPLACE FUNCTION public.prepare_whatsapp_send_delivery'),
  webhookStateMigration.indexOf('CREATE OR REPLACE FUNCTION public.begin_whatsapp_send_delivery'),
);
assert.match(
  prepareSendBlock,
  /channel = 'email'[\s\S]{0,300}task_rejected_admin_fallback_email[\s\S]{0,1200}fallback_committed/,
  'WhatsApp no puede prepararse después de reclamar o enviar el fallback email',
);
const beginSendBlock = webhookStateMigration.slice(
  webhookStateMigration.indexOf('CREATE OR REPLACE FUNCTION public.begin_whatsapp_send_delivery'),
  webhookStateMigration.indexOf('CREATE OR REPLACE FUNCTION public.finalize_whatsapp_send_delivery'),
);
assert.match(
  beginSendBlock,
  /channel = 'email'[\s\S]{0,300}task_rejected_admin_fallback_email[\s\S]{0,300}RETURN false/,
  'la comprobación bilateral debe repetirse inmediatamente antes del POST a Meta',
);
assert.match(
  webhookStateMigration,
  /CREATE OR REPLACE FUNCTION public\.finalize_whatsapp_unavailable_delivery[\s\S]{0,2600}processing_lease_token IS DISTINCT FROM _lease_token/,
  'skipped debe finalizarse bajo el advisory lock y el lease vigente',
);
assert.match(sender, /rpc\(\s*'finalize_whatsapp_unavailable_delivery'/);
assert.doesNotMatch(
  sender.slice(sender.indexOf('if (!enabled)'), sender.indexOf('// 7. Persistir intención')),
  /\.from\('notification_deliveries'\)\.update|\.from\('notification_events'\)\.update/,
  'la rama sin canal no puede escribir delivery/evento fuera del fencing SQL',
);
assert.match(
  webhookStateMigration,
  /CREATE OR REPLACE FUNCTION public\.begin_whatsapp_admin_fallback_send/,
  'Resend necesita fencing propio antes del efecto externo',
);
assert.match(
  webhookStateMigration,
  /CREATE OR REPLACE FUNCTION public\.finalize_whatsapp_admin_fallback_send/,
  'la persistencia posterior a Resend debe ser monotónica y validar el claim',
);
const fallbackClaimBlock = webhookStateMigration.slice(
  webhookStateMigration.indexOf('CREATE OR REPLACE FUNCTION public.claim_whatsapp_admin_fallback'),
);
assert.ok(
  fallbackClaimBlock.indexOf('pg_advisory_xact_lock') >= 0
    && fallbackClaimBlock.indexOf('pg_advisory_xact_lock') < fallbackClaimBlock.indexOf("status IN ('sent', 'delivered', 'read')")
    && fallbackClaimBlock.indexOf("status IN ('sent', 'delivered', 'read')") < fallbackClaimBlock.indexOf('INSERT INTO public.notification_deliveries'),
  'el claim debe decidir bajo el mismo bloqueo si WhatsApp ya tuvo éxito antes de autorizar Resend',
);
assert.ok(
  fallbackClaimBlock.indexOf("provider_payload->>'send_started_at' IS NOT NULL") >= 0
    && fallbackClaimBlock.indexOf("error_code = 'reconciliation_required'") >= 0
    && fallbackClaimBlock.indexOf("'whatsapp_in_flight'::text") >= 0
    && fallbackClaimBlock.indexOf("'whatsapp_in_flight'::text") < fallbackClaimBlock.indexOf('INSERT INTO public.notification_deliveries'),
  'el fallback no puede autorizarse mientras Meta pudo haber recibido un envío todavía no conciliado',
);
const bindButtonBlock = webhookStateMigration.slice(
  webhookStateMigration.indexOf('CREATE OR REPLACE FUNCTION public.bind_whatsapp_delivery_from_button'),
  webhookStateMigration.indexOf('CREATE OR REPLACE FUNCTION public.replay_whatsapp_status_callbacks'),
);
assert.ok(
  bindButtonBlock.indexOf('pg_advisory_xact_lock') >= 0
    && bindButtonBlock.indexOf('pg_advisory_xact_lock') < bindButtonBlock.indexOf('UPDATE public.notification_deliveries')
    && bindButtonBlock.indexOf('UPDATE public.notification_deliveries') < bindButtonBlock.indexOf('UPDATE public.notification_events'),
  'la conciliación por botón debe compartir la serialización por evento',
);

const pendingProcessor = await read('supabase/functions/process-pending-whatsapp-notifications/index.ts');
assert.match(
  pendingProcessor,
  /validate_notification_send_reconciliation_effect[\s\S]{0,700}invokeSender/,
  'un efecto recuperado debe revalidar token, lease y ventana justo antes del emisor',
);
assert.match(
  pendingProcessor,
  /const markClaimedCallback[\s\S]{0,300}markCallback\(callback\.id, outcome, processed, lastError, callbackClaimToken\)/,
  'cada callback reclamado debe cerrar su generación mediante el helper cercado',
);
assert.match(
  pendingProcessor,
  /_claim_token:\s*callbackClaimToken/,
  'el reconciliador debe propagar la generación a la RPC de cierre',
);
assert.match(pendingProcessor, /claim_notification_send_reconciliation_actions/);
assert.match(pendingProcessor, /apply_notification_send_reconciliation_action/);
assert.match(pendingProcessor, /finish_notification_send_reconciliation_action/);
assert.match(pendingProcessor, /_claim_token:\s*action\.claim_token/);
assert.match(pendingProcessor, /force_email_fallback/);
assert.match(
  pendingProcessor,
  /rpc\(\s*'claim_whatsapp_webhook_callbacks'/,
  'el cron debe reclamar callbacks de forma atómica antes de conciliarlos',
);
assert.doesNotMatch(
  pendingProcessor,
  /\.from\('whatsapp_webhook_inbox'\)[\s\S]{0,300}\.eq\('processing_status', 'pending'\)/,
  'el cron no puede leer callbacks pending sin claim/bloqueo',
);
assert.match(
  pendingProcessor,
  /completedStatuses = new Set\(\['sent', 'fallback_sent', 'already_sent'\]\)/,
  'already_processing no puede cerrar definitivamente un callback',
);
assert.match(
  pendingProcessor,
  /completedStatuses\.has\(result\?\.status\)/,
  'el cron solo debe aceptar resultados terminales del emisor',
);
assert.match(pendingProcessor, /status\.eq\.pending/);
assert.match(pendingProcessor, /status\.eq\.processing/);
assert.match(pendingProcessor, /send-whatsapp-notification/);
assert.match(pendingProcessor, /\.limit\(50\)/);
assert.match(pendingProcessor, /claim_whatsapp_webhook_callbacks/);
assert.match(pendingProcessor, /bind_whatsapp_delivery_from_status/);
assert.match(pendingProcessor, /apply_whatsapp_delivery_status/);
assert.match(pendingProcessor, /bind_whatsapp_delivery_from_button/);
assert.match(pendingProcessor, /apply_whatsapp_approval_response/);
assert.match(pendingProcessor, /classifyApprovalCallbackOutcome/);
assert.doesNotMatch(
  pendingProcessor,
  /sourceDelivery[\s\S]{0,500}\.from\('notification_events'\)[\s\S]{0,180}status:\s*'sent'/,
  'el reconciliador no puede revivir a sent un evento cancelado que el bind preservó',
);
assert.match(pendingProcessor, /correlation_exhausted/);
assert.match(pendingProcessor, /callbacksReconciled/);
assert.doesNotMatch(pendingProcessor, /processing_status', 'pending'/);
assert.doesNotMatch(pendingProcessor, /eventStatus = transition\.effective_status/);
assert.match(
  pendingProcessor,
  /admin_fallback_failed_after_reconciliation'[\s\S]{0,180}markClaimedCallback\(transition\.effective_status, true\)/,
  'el callback de fallo debe seguir pendiente hasta que el fallback termine',
);
assert.match(
  pendingProcessor,
  /invokeSender\([\s\S]{0,100}transition\.notification_event_id,[\s\S]{0,60}true,[\s\S]{0,60}transition\.delivery_id[\s\S]{0,30}\)/,
  'el cron debe propagar la delivery exacta que produjo el estado failed',
);
assert.match(
  pendingProcessor,
  /rejection_notification_failed_after_reconciliation'[\s\S]{0,180}markClaimedCallback\(outcome\.outcome, true\)/,
  'el botón de rechazo debe seguir pendiente hasta completar su alerta',
);
assert.match(
  pendingProcessor,
  /classification\.missingDerivedEvent[\s\S]{0,100}throw new Error\('rejection_event_missing_after_reconciliation'\)/,
  'el cron solo debe exigir evento derivado cuando la clasificación lo requiere',
);
assert.match(
  webhookStateMigration,
  /CREATE OR REPLACE FUNCTION public\.claim_whatsapp_webhook_callbacks/,
  'la migración debe exponer un claim transaccional para callbacks',
);
assert.match(
  webhookStateMigration,
  /FOR UPDATE SKIP LOCKED/,
  'dos crons no pueden reclamar la misma fila',
);
assert.match(
  webhookStateMigration,
  /processing_status = 'processing'/,
  'el claim debe marcar las filas mientras un worker las procesa',
);
assert.match(
  webhookStateMigration,
  /WHEN _outcome = 'retry_failed' THEN 'pending'/,
  'un fallo transitorio debe liberar el claim para un reintento posterior',
);

for (const reminderPath of [
  'supabase/functions/remind-unapproved-tasks/index.ts',
  'supabase/functions/remind-late-start-tasks/index.ts',
]) {
  const reminder = await read(reminderPath);
  assert.match(reminder, /\.select\('id'\)\.single\(\)/s, reminderPath);
  assert.match(reminder, /send-whatsapp-notification/, reminderPath);
  assert.match(reminder, /const authValue =/i, reminderPath);
  assert.match(reminder, /\['Author' \+ 'ization'\]: authValue/, reminderPath);
  assert.match(reminder, /if \(!sendResponse\.ok\)/, reminderPath);
}

const cronMigration = await read('supabase/migrations/20260715082216_schedule_whatsapp_notification_reminders.sql');
for (const jobName of [
  'whatsapp-remind-unapproved',
  'whatsapp-remind-late-start',
  'whatsapp-process-pending',
]) assert.match(cronMigration, new RegExp(jobName));
assert.match(cronMigration, /vault\.create_secret/);
assert.match(cronMigration, /GRANT EXECUTE.*service_role/i);
assert.doesNotMatch(cronMigration, /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./);

const functionConfig = await read('supabase/config.toml');
for (const functionName of [
  'send-whatsapp-notification',
  'remind-unapproved-tasks',
  'remind-late-start-tasks',
  'process-pending-whatsapp-notifications',
]) {
  assert.match(functionConfig, new RegExp(`\\[functions\\.${functionName}\\]\\s+verify_jwt = true`));
}

console.log('whatsapp-delivery-pipeline-tests: OK');
