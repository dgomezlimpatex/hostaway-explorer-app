import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const read = (filePath) => readFile(path.join(process.cwd(), filePath), 'utf8');

const page = await read('src/pages/WhatsAppNotifications.tsx');
assert.match(page, /Notificaciones WhatsApp/);
assert.match(page, /Enviados/);
assert.match(page, /Entregados/);
assert.match(page, /Leídos/);
assert.match(page, /Fallidos/);
assert.match(page, /No enviados/);
assert.match(page, /Sin confirmar/);
assert.match(page, /const needsAttention = stats\?\.unresolved \?\? 0/);
assert.match(page, /provider_message_ref/);
assert.match(page, /recipient_masked/);
assert.match(page, /get_whatsapp_delivery_monitor/);
assert.match(page, /get_whatsapp_webhook_reconciliation_queue/);
assert.match(page, /Cola de conciliación de Meta/);
assert.match(page, /refetchInterval:\s*30_000/);
assert.doesNotMatch(page, /\.from\('notification_deliveries'\)[\s\S]{0,200}channel[^\n]+email/);
assert.doesNotMatch(page, /\.from\('notification_deliveries'\)/);
assert.doesNotMatch(page, /recipient:\s*string/);

const health = await read('src/hooks/useWhatsAppDeliveryHealth.ts');
assert.match(health, /failed/);
assert.match(health, /undeliverable/);
assert.match(health, /skipped/);
assert.match(health, /unconfirmed/);
assert.match(health, /refetchInterval:\s*30_000/);
assert.match(health, /get_whatsapp_delivery_monitor_stats/);
assert.match(health, /get_whatsapp_webhook_pending_count/);
assert.match(health, /callbackPending/);
assert.match(health, /unresolved:\s*baseUnresolved \+ callbackPending/);
assert.doesNotMatch(health, /\.from\('notification_deliveries'\)/);

const app = await read('src/App.tsx');
assert.match(app, /WhatsAppNotifications/);
assert.match(app, /whatsapp-notifications/);
assert.match(app, /requiredModule="reports"/);

for (const sidebarPath of [
  'src/components/dashboard/DashboardSidebar.tsx',
  'src/components/dashboard/MobileDashboardSidebar.tsx',
]) {
  const sidebar = await read(sidebarPath);
  assert.match(sidebar, /WhatsApp/);
  assert.match(sidebar, /whatsapp-delivery-errors/);
  assert.match(sidebar, /useWhatsAppDeliveryHealth/);
}

const migration = await read('supabase/migrations/20260720191000_secure_whatsapp_delivery_monitor.sql');
const approvalPermissionsMigrationPath = 'supabase/migrations/20260720230000_harden_task_approval_event_permissions.sql';
const approvalPermissionsMigration = await read(approvalPermissionsMigrationPath);
const sendReconciliationMigrationPath = 'supabase/migrations/20260720260000_add_manual_send_reconciliation.sql';
const sendReconciliationMigration = await read(sendReconciliationMigrationPath);
const cronRecoveryMigrationPath = 'supabase/migrations/20260721070000_schedule_whatsapp_notification_recovery.sql';
const cronRecoveryMigration = await read(cronRecoveryMigrationPath);
assert.ok(
  cronRecoveryMigrationPath > sendReconciliationMigrationPath,
  'la programación recuperada debe publicarse después de todas las migraciones del pipeline',
);
assert.match(cronRecoveryMigration, /whatsapp-process-pending/);
assert.match(cronRecoveryMigration, /process-pending-whatsapp-notifications/);
assert.match(cronRecoveryMigration, /whatsapp-remind-unapproved/);
assert.match(cronRecoveryMigration, /whatsapp-remind-late-start/);
assert.match(cronRecoveryMigration, /SET search_path = ''/);
assert.match(cronRecoveryMigration, /REVOKE ALL ON FUNCTION public\.configure_whatsapp_notification_cron\(text\)/);
assert.match(cronRecoveryMigration, /GRANT EXECUTE ON FUNCTION public\.configure_whatsapp_notification_cron\(text\) TO service_role/);
assert.doesNotMatch(cronRecoveryMigration, /GRANT EXECUTE[\s\S]{0,100}(?:anon|authenticated)/);
assert.ok(
  approvalPermissionsMigrationPath > 'supabase/migrations/20260720220000_prevent_hidden_tasks_on_cleaner_deactivation.sql',
  'el hardening de aprobaciones debe ser una migración incremental posterior al historial ya aplicado',
);
assert.match(migration, /SECURITY DEFINER/);
assert.match(migration, /recipient_masked/);
assert.match(migration, /user_has_sede_access/);
assert.match(migration, /REVOKE ALL.*PUBLIC, anon/);
assert.match(migration, /LIMIT GREATEST\(1, LEAST\(_limit, 100\)\)/);
assert.doesNotMatch(migration, /CREATE POLICY [^\n]*supervisor_read/);
assert.match(migration, /enforce_notification_event_scope/);
assert.match(migration, /notification_event_cleaner_sede_mismatch/);
assert.match(migration, /NEW\.sede_id := task_sede/);
assert.match(migration, /CREATE TRIGGER trg_notification_events_enforce_scope\s+BEFORE INSERT/);
assert.doesNotMatch(migration, /BEFORE INSERT OR UPDATE/);
assert.match(migration, /task\.sede_id = event\.sede_id/);
assert.match(migration, /cleaner\.sede_id = event\.sede_id/);
assert.match(migration, /_status = 'failed' AND delivery\.status = 'undeliverable'/);
assert.match(
  approvalPermissionsMigration,
  /DROP POLICY IF EXISTS "task_approval_events_admin_manager_all" ON public\.task_approval_events/,
  'la migración correctiva debe retirar la política histórica global de aprobaciones',
);
assert.match(
  approvalPermissionsMigration,
  /DROP POLICY IF EXISTS "task_approval_events_supervisor_read" ON public\.task_approval_events/,
  'la política histórica global de supervisores debe retirarse',
);
assert.match(
  approvalPermissionsMigration,
  /REVOKE ALL ON public\.task_approval_events FROM PUBLIC, anon, authenticated[\s\S]{0,120}GRANT SELECT ON public\.task_approval_events TO authenticated/,
  'el navegador debe tener solo lectura sobre la auditoría de aprobaciones',
);
assert.match(
  approvalPermissionsMigration,
  /CREATE POLICY "task_approval_events_sede_read"[\s\S]{0,900}user_has_sede_access\(auth\.uid\(\), task\.sede_id\)/,
  'managers y supervisores solo deben leer aprobaciones de tareas en sedes autorizadas',
);
assert.match(
  approvalPermissionsMigration,
  /CREATE POLICY "task_approval_events_admin_read"[\s\S]{0,300}has_role\(auth\.uid\(\), 'admin'\)/,
  'solo admin conserva lectura global de la auditoría de aprobaciones',
);
assert.match(sendReconciliationMigration, /CREATE TABLE public\.notification_send_reconciliation_actions/);
assert.match(sendReconciliationMigration, /CREATE OR REPLACE FUNCTION public\.request_notification_send_reconciliation/);
assert.match(sendReconciliationMigration, /CREATE OR REPLACE FUNCTION public\.claim_notification_send_reconciliation_actions/);
assert.match(sendReconciliationMigration, /CREATE OR REPLACE FUNCTION public\.apply_notification_send_reconciliation_action/);
assert.match(sendReconciliationMigration, /CREATE OR REPLACE FUNCTION public\.finish_notification_send_reconciliation_action/);
assert.match(sendReconciliationMigration, /pg_advisory_xact_lock/);
assert.match(sendReconciliationMigration, /public\.has_role\(auth\.uid\(\), 'admin'\)/);
assert.match(sendReconciliationMigration, /FOR UPDATE SKIP LOCKED/);
assert.match(sendReconciliationMigration, /confirmed_sent/);
assert.match(sendReconciliationMigration, /confirmed_not_sent/);
assert.match(sendReconciliationMigration, /effect_pending/);
assert.match(sendReconciliationMigration, /effect_started_at > now\(\) - interval '23 hours'/);
assert.match(sendReconciliationMigration, /delivery\.status IN \('sent', 'delivered', 'read'\)/);
assert.match(sendReconciliationMigration, /provider_message_id_conflict/);
assert.match(sendReconciliationMigration, /claim_token uuid/);
assert.match(sendReconciliationMigration, /claim_token = gen_random_uuid\(\)/);
assert.match(sendReconciliationMigration, /apply_notification_send_reconciliation_action\(\s*_action_id uuid,\s*_claim_token uuid/);
assert.match(sendReconciliationMigration, /finish_notification_send_reconciliation_action\(\s*_action_id uuid,\s*_claim_token uuid/);
assert.match(
  sendReconciliationMigration,
  /action\.status = 'effect_pending'[\s\S]{0,180}action\.effect_started_at <= now\(\) - interval '23 hours'[\s\S]{0,180}action\.processing_started_at < now\(\) - interval '10 minutes'/,
  'una acción effect_pending activa no puede caducar mientras conserva un lease reciente',
);
assert.match(
  sendReconciliationMigration,
  /CREATE OR REPLACE FUNCTION public\.validate_notification_send_reconciliation_effect\(\s*_action_id uuid,\s*_claim_token uuid/,
  'el worker debe revalidar generación y ventana inmediatamente antes del efecto externo',
);
assert.match(
  sendReconciliationMigration,
  /_resolution = 'confirmed_not_sent'[\s\S]{0,160}delivery\.channel = 'whatsapp'[\s\S]{0,160}whatsapp_uncertain_cannot_be_reopened/,
  'Meta incierto nunca puede aceptar confirmed_not_sent ni reabrir un POST sin idempotencia',
);
assert.match(page, /get_notification_send_reconciliation_queue/);
assert.match(page, /request_notification_send_reconciliation/);
assert.match(page, /Confirmar enviado/);
assert.match(page, /row\.channel === 'whatsapp' && resolution === 'confirmed_not_sent'/);
assert.match(page, /row\.channel === 'email'[\s\S]{0,260}Confirmar no enviado y reintentar/);

const webhook = await read('supabase/functions/whatsapp-webhook/index.ts');
const featureFlags = await read('supabase/functions/_shared/featureFlags.ts');
assert.match(
  featureFlags,
  /accessToken: \(Deno\.env\.get\('WHATSAPP_ACCESS_TOKEN'\) \?\? ''\)\.trim\(\)/,
  'el token efectivo usado por Meta debe estar normalizado',
);
assert.match(
  featureFlags,
  /phoneNumberId: \(Deno\.env\.get\('WHATSAPP_PHONE_NUMBER_ID'\) \?\? ''\)\.trim\(\)/,
  'el phone number ID efectivo debe estar normalizado',
);
assert.match(
  featureFlags,
  /appSecret: \(Deno\.env\.get\('WHATSAPP_APP_SECRET'\) \?\? ''\)\.trim\(\)/,
  'la clave HMAC efectiva debe estar normalizada',
);
assert.match(
  featureFlags,
  /return Boolean\(cfg\.accessToken && cfg\.phoneNumberId && cfg\.appSecret\)/,
  'el envío live debe exigir credenciales no vacías después de normalizar whitespace',
);
assert.match(webhook, /isValidSignature\(rawBody, signature, cfg\.appSecret\)/);
const missingSecretBlock = webhook.slice(
  webhook.indexOf('if (!hasWebhookSecret())'),
  webhook.indexOf('// 3. Validar firma'),
);
assert.match(
  missingSecretBlock,
  /status:\s*503/,
  'sin secreto el webhook debe pedir reintento y nunca confirmar un callback perdido',
);
assert.match(missingSecretBlock, /Retry-After/);
assert.doesNotMatch(missingSecretBlock, /status:\s*200/);
assert.match(webhook, /apply_whatsapp_delivery_status/);
assert.doesNotMatch(webhook, /\.from\('notification_deliveries'\)[\s\S]{0,300}\.update\(patch\)/);
assert.match(webhook, /status:\s*500/);
assert.doesNotMatch(webhook, /Aun con error devolvemos 200/);
assert.match(webhook, /for \(let attempt = 0; attempt < 5; attempt\+\+\)/);
assert.doesNotMatch(webhook, /retryErrors\.push\(`unknown_status:/);
assert.match(webhook, /whatsapp_unknown_status_preserved/);
assert.doesNotMatch(webhook, /if \(newStatus === 'failed' && transition\.applied\)/);
assert.match(webhook, /transition\.effective_status === 'failed'/);
assert.match(webhook, /fallbackResult\.ok/);
assert.match(
  webhook,
  /invokeNotificationSender\([\s\S]{0,180}transition\.delivery_id[\s\S]{0,80}\)/,
  'el webhook debe propagar la delivery exacta que originó el fallback',
);
assert.match(
  webhook,
  /fallback_notification_failed[\s\S]{0,100}continue;[\s\S]{0,140}markCallback\(callbackId, outcome\.outcome, true\)/,
  'el webhook no puede cerrar un rechazo cuando falla su alerta derivada',
);
assert.match(webhook, /fallback_notification_failed/);
assert.match(
  webhook,
  /fallback_notification_failed[^\n]*\n[^\n]*continue;[\s\S]{0,220}markCallback\(callbackId, transition\.effective_status, true\)/,
  'un failed debe permanecer pendiente hasta confirmar el fallback administrativo',
);
assert.match(webhook, /Number\.isSafeInteger/);
assert.match(webhook, /\[0-9a-f\]\{8\}/);
assert.match(webhook, /parts\.length !== 3/);
assert.match(webhook, /message\?\.context\?\.id/);
assert.match(webhook, /apply_whatsapp_approval_response/);
assert.match(webhook, /'unauthorized_sender'/);
assert.match(webhook, /'expired'/);
const terminalOutcomeGuard = webhook.indexOf("if (['invalid', 'expired', 'stale', 'superseded', 'not_actionable', 'unauthorized_sender'].includes(outcome.outcome))");
const rejectionFallbackBranch = webhook.indexOf("if (action === 'reject')", terminalOutcomeGuard);
assert.ok(terminalOutcomeGuard >= 0, 'Debe existir el guard de outcomes terminales');
assert.ok(rejectionFallbackBranch > terminalOutcomeGuard, 'expired debe finalizar antes del fallback de rechazo');
assert.match(webhook.slice(terminalOutcomeGuard, rejectionFallbackBranch), /continue;/);
assert.match(webhook, /completedStatuses\.has\(payload\?\.status\)/);
assert.match(webhook, /record_whatsapp_webhook_callback/);
assert.match(webhook, /quarantineSignedCallback/);
assert.match(webhook, /malformed_json/);
assert.match(webhook, /invalid_status_payload/);
assert.match(webhook, /invalid_button_payload/);
assert.match(webhook, /invalid_button_context/);
assert.match(webhook, /signedPayloadDigest/);
assert.match(webhook, /Array\.isArray\(entry\?\.changes\)/);
assert.match(webhook, /invalid_entry_changes/);
assert.match(webhook, /Array\.isArray\(value\?\.statuses\)/);
assert.match(webhook, /invalid_statuses_collection/);
assert.match(webhook, /Array\.isArray\(value\?\.messages\)/);
assert.match(webhook, /invalid_messages_collection/);
assert.match(webhook, /empty_callback_value/);
assert.doesNotMatch(webhook, /for \(const change of entry\?\.changes \?\? \[\]\)/);
assert.doesNotMatch(webhook, /for \(const status of value\?\.statuses \?\? \[\]\)/);
assert.doesNotMatch(webhook, /for \(const message of value\?\.messages \?\? \[\]\)/);
assert.doesNotMatch(webhook, /if \(!providerMessageId \|\| !newStatus\) continue;/);
assert.doesNotMatch(webhook, /if \(!buttonPayload\) continue;/);
assert.doesNotMatch(webhook, /if \(!parsed\) continue;/);
assert.match(webhook, /mark_whatsapp_webhook_callback/);
assert.match(webhook, /bind_whatsapp_delivery_from_button/);
assert.match(webhook, /bind_whatsapp_delivery_from_status/);
assert.match(webhook, /supportedDeliveryStatuses/);
assert.match(webhook, /unsupported_status/);
assert.match(
  webhook,
  /if \(!supportedDeliveryStatuses\.has\(newStatus\)\)[\s\S]{0,500}continue;[\s\S]{0,180}bind_whatsapp_delivery_from_status/,
  'los estados desconocidos deben quedar en revisión antes de vincular una delivery',
);
const statusRecordCall = webhook.indexOf('_callback_key: `status:');
const statusApplyCall = webhook.indexOf('transition = await applyDeliveryStatusWithRetry', statusRecordCall);
assert.ok(
  statusRecordCall >= 0 && statusApplyCall > statusRecordCall,
  'el estado firmado debe persistirse antes de intentar correlacionarlo',
);

const webhookStateMigrationPath = 'supabase/migrations/20260720240000_harden_whatsapp_webhook_state.sql';
assert.ok(
  webhookStateMigrationPath > approvalPermissionsMigrationPath
    && webhookStateMigrationPath > 'supabase/migrations/20260720220000_prevent_hidden_tasks_on_cleaner_deactivation.sql',
  'el hardening principal debe ser incremental y posterior a todas las migraciones ya publicadas del lote',
);
const webhookStateMigration = await read(webhookStateMigrationPath);
assert.match(webhookStateMigration, /duplicate_provider_message_id_prevents_whatsapp_hardening/);
assert.match(webhookStateMigration, /HAVING count\(\*\) > 1/);
assert.match(webhookStateMigration, /CREATE OR REPLACE FUNCTION public\.apply_whatsapp_delivery_status/);
assert.match(webhookStateMigration, /FOR UPDATE/);
assert.match(webhookStateMigration, /incoming_rank < current_rank/);
assert.match(webhookStateMigration, /effective_status text/);
assert.match(webhookStateMigration, /apply_whatsapp_approval_response/);
assert.match(webhookStateMigration, /WHERE task\.id = _task_id FOR UPDATE/);
assert.match(webhookStateMigration, /provider_payload->'buttonPayloads'/);
assert.match(webhookStateMigration, /latest_decision_at IS NOT NULL AND _occurred_at <= latest_decision_at/);
assert.match(webhookStateMigration, /newer\.created_at > source_event\.created_at/);
assert.match(webhookStateMigration, /newer\.cleaner_id IS NOT DISTINCT FROM source_event\.cleaner_id/);
assert.match(webhookStateMigration, /FROM public\.task_assignments assignment/);
assert.match(webhookStateMigration, /assignment\.cleaner_id = source_event\.cleaner_id/);
assert.match(webhookStateMigration, /source_event\.cleaner_id = task_record\.cleaner_id/);
assert.doesNotMatch(webhookStateMigration, /source_event\.cleaner_id IS DISTINCT FROM task_record\.cleaner_id/);
assert.match(webhookStateMigration, /normalized_sender <> normalized_recipient/);
assert.match(webhookStateMigration, /task_record\.approval_status <> 'pending'/);
assert.match(webhookStateMigration, /task_record\.status IN \('completed', 'cancelled'\)/);
assert.match(webhookStateMigration, /'late_started', 'late_issue'/);
assert.match(webhookStateMigration, /'task_assigned', 'task_modified', 'task_approval_reminder'/);
assert.match(webhookStateMigration, /source_event\.created_at \+ interval '7 days'/);
assert.match(webhookStateMigration, /_task_id, source_event\.cleaner_id,/);
assert.match(
  webhookStateMigration,
  /_occurred_at < current_occurred_at[\s\S]{0,220}_occurred_at = current_occurred_at[\s\S]{0,120}incoming_rank <= current_rank/,
  'un estado de mayor rango con el mismo timestamp de Meta debe poder avanzar',
);
assert.match(webhookStateMigration, /IF NOT FOUND THEN[\s\S]{0,250}RETURN;/);
assert.match(webhookStateMigration, /claim_whatsapp_admin_fallback/);
assert.match(webhookStateMigration, /ON CONFLICT \(notification_event_id\)/);
assert.match(webhookStateMigration, /notification_deliveries\.status = 'failed'/);
assert.match(webhookStateMigration, /GRANT EXECUTE[^;]+service_role/);
assert.match(webhookStateMigration, /REVOKE ALL[^;]+PUBLIC, anon, authenticated/);
assert.match(webhookStateMigration, /CREATE TABLE IF NOT EXISTS public\.whatsapp_webhook_inbox/);
assert.match(webhookStateMigration, /'unsupported_status'[\s\S]{0,260}'manual_review'/);
assert.match(webhookStateMigration, /callback_key text NOT NULL UNIQUE/);
assert.match(webhookStateMigration, /ALTER TABLE public\.whatsapp_webhook_inbox ENABLE ROW LEVEL SECURITY/);
assert.match(webhookStateMigration, /record_whatsapp_webhook_callback/);
assert.match(webhookStateMigration, /record_whatsapp_webhook_quarantine/);
assert.match(webhookStateMigration, /callback_kind IN \('status', 'button', 'quarantine'\)/);
assert.match(webhookStateMigration, /processing_status[^;]+manual_review/);
assert.match(webhookStateMigration, /mark_whatsapp_webhook_callback/);
assert.match(webhookStateMigration, /bind_whatsapp_delivery_from_button/);
assert.match(webhookStateMigration, /bind_whatsapp_delivery_from_status/);
assert.match(webhookStateMigration, /finalize_whatsapp_send_delivery/);
assert.match(webhookStateMigration, /finalize_whatsapp_notification_event/);
assert.match(
  webhookStateMigration,
  /CREATE OR REPLACE FUNCTION public\.apply_whatsapp_delivery_status[\s\S]{0,6000}UPDATE public\.notification_events event[\s\S]{0,400}WHEN _status IN \('sent', 'delivered', 'read'\) THEN 'sent'/,
  'cada callback debe mantener el evento coherente en la misma transacción',
);
assert.match(
  webhookStateMigration,
  /SELECT EXISTS \([\s\S]{0,500}sibling\.status IN \('sent', 'delivered', 'read'\)[\s\S]{0,120}INTO successful_whatsapp[\s\S]{0,700}WHEN successful_whatsapp THEN 'sent'/,
  'un failed tardío no puede degradar el evento si otra delivery WhatsApp ya tuvo éxito',
);
assert.match(webhookStateMigration, /CASE WHEN delivery\.status = 'queued' THEN 'sent' ELSE delivery\.status END/);
assert.match(webhookStateMigration, /replay_whatsapp_status_callbacks/);
assert.match(webhookStateMigration, /REVOKE ALL ON TABLE public\.whatsapp_webhook_inbox/);
assert.match(webhookStateMigration, /get_whatsapp_webhook_pending_count/);
assert.match(webhookStateMigration, /callback_claim_token uuid/);
assert.match(webhookStateMigration, /callback_claim_token = gen_random_uuid\(\)/);
assert.match(
  webhookStateMigration,
  /mark_whatsapp_webhook_callback\([\s\S]{0,220}_claim_token uuid DEFAULT NULL/,
  'el finalizador de callbacks debe aceptar la generación reclamada',
);
assert.match(
  webhookStateMigration,
  /inbox\.processing_status = 'processing'[\s\S]{0,180}inbox\.callback_claim_token = _claim_token/,
  'un worker obsoleto no puede degradar un callback reclamado por otra generación',
);
assert.match(webhookStateMigration, /get_whatsapp_webhook_reconciliation_queue/);
const monitorPage = await read('src/pages/WhatsAppNotifications.tsx');
assert.match(
  monitorPage,
  /row\.channel === 'email'[\s\S]{0,260}confirmed_not_sent/,
  'solo Resend puede ofrecer confirmación de no enviado y reintento',
);
assert.match(
  monitorPage,
  /WhatsApp incierto no se reenvía/,
  'el panel debe explicar que Meta queda fail-closed',
);
assert.match(webhookStateMigration, /'…' \|\| right\(inbox\.provider_message_id, 8\)/);
assert.match(webhookStateMigration, /'•••• ' \|\| right\(regexp_replace\(inbox\.sender/);
assert.match(webhookStateMigration, /purge_whatsapp_webhook_inbox/);
assert.match(webhookStateMigration, /received_at < now\(\) - interval '90 days'/);
assert.match(webhookStateMigration, /whatsapp-webhook-inbox-retention/);
assert.match(webhookStateMigration, /IF NOT public\.has_role\(auth\.uid\(\), 'admin'\)/);
assert.match(webhookStateMigration, /delivery\.error_code = 'reconciliation_required'/);
assert.match(webhookStateMigration, /CREATE OR REPLACE FUNCTION public\.get_whatsapp_delivery_monitor_stats/);
assert.match(webhookStateMigration, /CREATE OR REPLACE FUNCTION public\.get_whatsapp_delivery_monitor\(/);
assert.match(webhookStateMigration, /delivery\.status = 'queued'[\s\S]{0,120}delivery\.error_code = 'reconciliation_required'/);
assert.match(webhookStateMigration, /_status = 'attention'[\s\S]{0,350}delivery\.error_code = 'reconciliation_required'/);

const sender = await read('supabase/functions/send-whatsapp-notification/index.ts');
assert.match(sender, /claim_whatsapp_admin_fallback/);
assert.match(sender, /authorization !== `Bearer \$\{serviceRoleKey\}`/);
assert.match(sender, /if \(!shouldForceFallback\)/);
assert.match(sender, /event\.event_type === 'task_rejected_alert' && event\.status === 'failed'/);
assert.match(sender, /whatsapp-admin-fallback\/\$\{eventId\}/);
assert.match(sender, /finalize_whatsapp_non_delivery_result/);
assert.match(
  sender,
  /finalize_whatsapp_non_delivery_result[\s\S]{0,380}_lease_token:\s*processingLeaseToken/,
  'todo resultado posterior al inicio debe cerrarse con el lease vigente',
);
assert.doesNotMatch(
  sender,
  /from\('notification_deliveries'\)\.update\(\{[\s\S]{0,220}status:\s*sendResult\.status/,
  'un resultado tardío sin ID nunca puede sobrescribir la delivery directamente',
);
assert.match(sender, /send_started_at/);
assert.match(sender, /reconciliation_required/);
assert.match(sender, /Meta no ofrece idempotencia/);
const manualReconciliationMigration = await read('supabase/migrations/20260720260000_add_manual_send_reconciliation.sql');
assert.match(
  manualReconciliationMigration,
  /IF _resolution = 'confirmed_not_sent'[\s\S]{0,160}delivery\.channel = 'whatsapp'[\s\S]{0,160}whatsapp_uncertain_cannot_be_reopened/,
  'una incertidumbre Meta nunca puede reabrirse basándose en una comprobación puntual',
);
assert.doesNotMatch(
  manualReconciliationMigration,
  /ELSIF delivery\.channel = 'whatsapp'[\s\S]{0,900}SET status = 'pending'/,
  'el worker no debe conservar una ruta capaz de reencolar Meta tras incertidumbre',
);
assert.match(
  sender,
  /Resultado de Meta incierto[\s\S]{0,180}no se reenviará automáticamente/,
);
assert.match(sender, /prepare_whatsapp_send_delivery/);
assert.match(sender, /queuedDeliveries/);
assert.match(
  sender,
  /prepare_whatsapp_send_delivery[\s\S]{0,700}_lease_token:\s*processingLeaseToken/,
  'una entrega queued creada antes de un crash debe reutilizarse bajo el lease vigente, no duplicarse',
);
assert.match(sender, /forcedFallbackEventError/);
assert.match(sender, /adminFallbackEventError/);
assert.match(sender, /replay_whatsapp_status_callbacks/);
assert.match(sender, /whatsapp_webhook_inbox/);
assert.match(sender, /outcomeRow\?\.rejection_event_id/);
assert.match(
  sender,
  /rejection_notification_failed_after_sender_replay[\s\S]{0,220}mark_whatsapp_webhook_callback/,
  'el replay del emisor debe completar la alerta de rechazo antes de marcar el botón',
);
assert.match(sender, /finalize_whatsapp_send_delivery/);
assert.doesNotMatch(sender, /^\s*await supabase\.from\('notification_events'\)\.update/m);
assert.match(sender, /\.eq\('id', event\.task_id\)\s*\.maybeSingle\(\)/s);
assert.match(sender, /\.eq\('id', event\.cleaner_id\)\s*\.maybeSingle\(\)/s);
assert.doesNotMatch(sender, /if \(taskError \|\| cleanerError\) throw taskError \?\? cleanerError/);
assert.match(sender, /status:\s*completed \? 200 : 502/);
assert.match(sender, /status:\s*fallbackSucceeded \? 200 : 502/);
assert.doesNotMatch(sender, /status:\s*fallback\.ok \? 200 : 502/);

for (const cronPath of [
  'supabase/functions/remind-unapproved-tasks/index.ts',
  'supabase/functions/remind-late-start-tasks/index.ts',
]) {
  const cronSource = await read(cronPath);
  assert.match(cronSource, /req\.headers\.get\('Authorization'\) !== authValue/);
  assert.match(cronSource, /status:\s*403/);
}

const processor = await read('supabase/functions/process-pending-whatsapp-notifications/index.ts');
assert.match(processor, /req\.headers\.get\('Authorization'\) !== authValue/);
assert.match(processor, /return json\(\{ error: 'forbidden' \}, 403\)/);

const orchestrator = await read('src/services/notifications/notificationOrchestrator.ts');
assert.doesNotMatch(orchestrator, /functions\s*\.invoke\('send-whatsapp-notification'/);
assert.match(orchestrator, /procesamiento backend asíncrono/);

console.log('whatsapp-delivery-monitor-tests: OK');
