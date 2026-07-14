import {
  buildRejectedAlertBodyParameters,
  buildRejectedAlertEmail,
  resolveNotificationRecipient,
  shouldSendAdminEmailFallback,
} from '../supabase/functions/_shared/whatsappNotificationRouting';
import { readFile } from 'node:fs/promises';

export async function run(assert: typeof import('node:assert/strict')) {
  const cleaner = {
    name: 'Trabajadora <Prueba>',
    whatsapp_phone_e164: '+34111111111',
    whatsapp_notifications_enabled: true,
  };
  const task = {
    property: 'Apartamento & Centro',
    date: '2026-07-15',
    start_time: '10:00',
  };

  assert.deepEqual(
    resolveNotificationRecipient('task_assigned', cleaner, '+34999999999'),
    { recipient: '+34111111111', enabled: true, kind: 'cleaner' },
  );
  assert.deepEqual(
    resolveNotificationRecipient('task_rejected_alert', cleaner, '+34999999999'),
    { recipient: '+34999999999', enabled: true, kind: 'admin' },
  );
  assert.deepEqual(
    resolveNotificationRecipient('task_rejected_alert', cleaner, ''),
    { recipient: null, enabled: false, kind: 'admin' },
  );

  assert.deepEqual(
    buildRejectedAlertBodyParameters(cleaner, task, { reason: 'No disponible' }, 'miércoles, 15 de julio de 2026'),
    ['Trabajadora <Prueba>', 'Apartamento & Centro', 'miércoles, 15 de julio de 2026', '10:00', 'No disponible'],
  );

  assert.equal(shouldSendAdminEmailFallback('task_rejected_alert', false, 'admin@example.com'), true);
  assert.equal(shouldSendAdminEmailFallback('task_rejected_alert', true, 'admin@example.com'), false);
  assert.equal(shouldSendAdminEmailFallback('task_assigned', false, 'admin@example.com'), false);
  assert.equal(shouldSendAdminEmailFallback('task_rejected_alert', false, ''), false);

  const email = buildRejectedAlertEmail(cleaner, task, { reason: '<sin disponibilidad>' }, 'miércoles, 15 de julio de 2026');
  assert.match(email.subject, /Trabajadora <Prueba>/);
  assert.match(email.html, /Trabajadora &lt;Prueba&gt;/);
  assert.match(email.html, /Apartamento &amp; Centro/);
  assert.match(email.html, /&lt;sin disponibilidad&gt;/);
  assert.doesNotMatch(email.html, /<sin disponibilidad>/);

  const sendFunction = await readFile(
    `${process.cwd()}/supabase/functions/send-whatsapp-notification/index.ts`,
    'utf8',
  );
  assert.match(sendFunction, /resolveNotificationRecipient\(event\.event_type, cleaner, adminPhone\)/);
  assert.match(sendFunction, /buildRejectedAlertBodyParameters\(cleaner, task, event\.payload/);
  assert.match(sendFunction, /sendAdminFallbackEmail\(/);
  assert.match(sendFunction, /shouldSendAdminEmailFallback\(event\.event_type, whatsappSucceeded, fallbackEmail\)/);
  assert.match(sendFunction, /forceEmailFallback/);
  assert.match(sendFunction, /Fallback forzado requiere service role/);

  const webhookFunction = await readFile(
    `${process.cwd()}/supabase/functions/whatsapp-webhook/index.ts`,
    'utf8',
  );
  assert.match(webhookFunction, /invokeNotificationSender\([\s\S]*?true,[\s\S]*?\)/);
  assert.match(webhookFunction, /task_rejected_alert/);
  assert.match(webhookFunction, /invokeNotificationSender\(rejectionAlertEventId, false\)/);
}
