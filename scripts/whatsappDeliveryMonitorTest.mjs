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
assert.match(page, /provider_message_ref/);
assert.match(page, /recipient_masked/);
assert.match(page, /get_whatsapp_delivery_monitor/);
assert.match(page, /refetchInterval:\s*30_000/);
assert.doesNotMatch(page, /channel[^\n]+email/);
assert.doesNotMatch(page, /\.from\('notification_deliveries'\)/);
assert.doesNotMatch(page, /recipient:\s*string/);

const health = await read('src/hooks/useWhatsAppDeliveryHealth.ts');
assert.match(health, /failed/);
assert.match(health, /undeliverable/);
assert.match(health, /skipped/);
assert.match(health, /unconfirmed/);
assert.match(health, /refetchInterval:\s*30_000/);
assert.match(health, /get_whatsapp_delivery_monitor_stats/);
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

const webhook = await read('supabase/functions/whatsapp-webhook/index.ts');
assert.match(webhook, /newStatus === 'sent'[^\n]+sent_at/);

console.log('whatsapp-delivery-monitor-tests: OK');
