import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sender = readFileSync(new URL('../supabase/functions/send-whatsapp-notification/index.ts', import.meta.url), 'utf8');
const worker = readFileSync(new URL('../supabase/functions/process-pending-whatsapp-notifications/index.ts', import.meta.url), 'utf8');

const guard = sender.indexOf("event.notification_mode !== 'live'");
const claim = sender.indexOf("status: 'processing'");
const provider = sender.indexOf('sendWhatsAppTemplateMessage({');
assert.ok(guard >= 0 && guard < claim && guard < provider, 'shadow/test debe bloquearse antes del claim y proveedor');
assert.match(sender, /event\.batch_id != null/);
assert.match(worker, /\.eq\('notification_mode', 'live'\)/);
assert.match(worker, /\.is\('batch_id', null\)/);
assert.match(sender, /const batchTaskSnapshot[\s\S]*event\.batch_id[\s\S]*event\.snapshot/);
assert.match(sender, /const cancellationTaskSnapshot[\s\S]*event\.snapshot\?\.task/);
assert.match(sender, /cancellationTaskSnapshot \?\? batchTaskSnapshot/);
assert.match(sender, /normalizeSpanishPhoneE164\(event\.recipient_phone_snapshot\)/);
assert.match(sender, /recipient_name_snapshot/);

console.log('planning-batch-sender-safety-tests: OK');
