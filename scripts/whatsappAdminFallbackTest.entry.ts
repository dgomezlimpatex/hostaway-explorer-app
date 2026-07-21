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
    resolveNotificationRecipient('task_assigned', {
      name: 'Dan García',
      telefono: '600 000 222',
      whatsapp_phone_e164: null,
      whatsapp_notifications_enabled: false,
    }, '+349****9999'),
    { recipient: '+34600000222', enabled: true, kind: 'cleaner' },
    'todo trabajador con móvil válido en telefono debe recibir WhatsApp sin configuración duplicada',
  );
  assert.deepEqual(
    resolveNotificationRecipient('task_assigned', {
      name: 'Trabajador con canal antiguo apagado',
      whatsapp_phone_e164: '+34600000333',
      whatsapp_notifications_enabled: false,
    }, '+349****9999'),
    { recipient: '+34600000333', enabled: true, kind: 'cleaner' },
    'el teléfono canónico válido basta para las notificaciones operativas',
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
    buildRejectedAlertBodyParameters(cleaner, task, 'miércoles, 15 de julio de 2026'),
    ['Trabajadora <Prueba>', 'Apartamento & Centro', 'miércoles, 15 de julio de 2026', '10:00'],
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
  assert.match(sendFunction, /buildRejectedAlertBodyParameters\(cleaner, task, date\)/);
  assert.match(sendFunction, /sendAdminFallbackEmail\(/);
  assert.match(sendFunction, /shouldSendAdminEmailFallback\(event\.event_type, whatsappSucceeded, fallbackEmail\)/);
  assert.match(sendFunction, /forceEmailFallback/);
  assert.match(sendFunction, /begin_whatsapp_admin_fallback_send/);
  assert.match(sendFunction, /finalize_whatsapp_admin_fallback_send/);
  assert.match(sendFunction, /claim\.claim_token/);
  assert.doesNotMatch(
    sendFunction.slice(
      sendFunction.indexOf("const resendApiKey = Deno.env.get('RESEND_API_KEY')"),
      sendFunction.indexOf('if (shouldForceFallback)'),
    ),
    /\.from\('notification_deliveries'\)\.update/,
    'la intención y el resultado de Resend deben persistirse mediante RPC con fencing',
  );
  const forcedFallbackBlock = sendFunction.slice(
    sendFunction.indexOf('if (shouldForceFallback)'),
    sendFunction.indexOf('// 5. Botones'),
  );
  assert.match(
    forcedFallbackBlock,
    /_delivery_id:\s*fallbackWhatsappDelivery\.id[\s\S]{0,240}_fallback_ok:\s*fallbackEmailSent/,
  );
  assert.doesNotMatch(
    forcedFallbackBlock,
    /const \{ data: successfulWhatsapp/,
    'la decisión de omitir Resend no puede ser una consulta TOCTOU fuera del claim transaccional',
  );
  assert.match(
    sendFunction,
    /claim\?\.delivery_status === 'whatsapp_succeeded'/,
    'el emisor debe reconocer que el claim se omitió por una delivery WhatsApp hermana exitosa',
  );
  const normalFallbackStart = sendFunction.indexOf(
    'const fallback = await sendAdminFallbackEmail(',
    sendFunction.indexOf('// Un callback firmado'),
  );
  const normalFallbackBlock = sendFunction.slice(
    normalFallbackStart,
    sendFunction.indexOf('} catch (error)', normalFallbackStart),
  );
  assert.match(
    normalFallbackBlock,
    /const fallbackEmailSent = fallback\.ok && !fallback\.skippedBecauseWhatsappSucceeded/,
    'el flujo normal debe diferenciar un correo enviado de un fallback omitido por éxito WhatsApp',
  );
  assert.match(normalFallbackBlock, /_fallback_ok:\s*fallbackEmailSent/);
  assert.match(normalFallbackBlock, /status:\s*fallback\.skippedBecauseWhatsappSucceeded\s*\?\s*'already_sent'/);
  assert.match(normalFallbackBlock, /fallbackChannel:\s*fallbackEmailSent\s*\?\s*'email'\s*:\s*null/);

  const unavailableFallbackBlock = sendFunction.slice(
    sendFunction.indexOf('if (!enabled)'),
    sendFunction.indexOf('// 7. Persistir intención'),
  );
  assert.match(
    unavailableFallbackBlock,
    /const fallbackEmailSent = fallback\.ok && !fallback\.skippedBecauseWhatsappSucceeded/,
    'el fallback por canal no disponible también debe distinguir correo enviado de éxito WhatsApp concurrente',
  );
  assert.match(unavailableFallbackBlock, /status:\s*fallback\.skippedBecauseWhatsappSucceeded\s*\?\s*'already_sent'/);
  assert.match(unavailableFallbackBlock, /fallbackChannel:\s*fallbackEmailSent\s*\?\s*'email'\s*:\s*null/);

  assert.doesNotMatch(
    forcedFallbackBlock,
    /status:\s*fallback\.ok \? 'sent' : 'failed'/,
  );
  assert.match(sendFunction, /authorization !== `Bearer \$\{serviceRoleKey\}`/);
  assert.match(sendFunction, /Invocación backend no autorizada/);

  const webhookFunction = await readFile(
    `${process.cwd()}/supabase/functions/whatsapp-webhook/index.ts`,
    'utf8',
  );
  assert.match(webhookFunction, /invokeNotificationSender\([\s\S]*?true,[\s\S]*?\)/);
  assert.match(webhookFunction, /task_rejected_alert/);
  assert.match(webhookFunction, /invokeNotificationSender\(outcome\.rejection_event_id, false\)/);
}
