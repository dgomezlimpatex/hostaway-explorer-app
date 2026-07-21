// Pruebas de preparación WhatsApp (lógica pura, sin dependencias de runtime).
// Se bundlea con esbuild igual que planningV2DomainTest.
// Nota: los valores E.164 esperados se construyen en runtime por concatenación
// para no almacenar literales de teléfono completos en el fichero.

import { normalizeSpanishPhoneE164, isE164 } from '../src/utils/phone/normalizePhone';
import {
  buildPendingApprovalPatch,
  buildNotRequiredPatch,
  approvalReminderDedupeKey,
  lateStartDedupeKey,
} from '../src/services/notifications/approvalPatches';
import { getWhatsAppConfig, isWhatsAppLive } from '../supabase/functions/_shared/featureFlags.ts';
import { sendWhatsAppTemplateMessage } from '../supabase/functions/_shared/whatsappClient.ts';
import {
  classifyApprovalCallbackOutcome,
  TERMINAL_APPROVAL_CALLBACK_OUTCOMES,
} from '../supabase/functions/_shared/whatsappApprovalOutcome.ts';

const CC = '+' + '34';

export async function run(assert: typeof import('node:assert/strict')) {
  // ── Replay durable de botones ────────────────────────────────
  const discardedRejectOutcomes = [
    'invalid',
    'expired',
    'stale',
    'superseded',
    'not_actionable',
    'unauthorized_sender',
  ];
  for (const outcome of discardedRejectOutcomes) {
    assert.equal(TERMINAL_APPROVAL_CALLBACK_OUTCOMES.has(outcome), true);
    assert.deepEqual(
      classifyApprovalCallbackOutcome('reject', outcome, null),
      { processed: true, derivedEventId: null, missingDerivedEvent: false },
      `${outcome} debe cerrarse sin crear ni exigir una alerta derivada`,
    );
  }
  for (const outcome of ['applied', 'duplicate']) {
    assert.deepEqual(
      classifyApprovalCallbackOutcome('reject', outcome, null),
      { processed: false, derivedEventId: null, missingDerivedEvent: true },
    );
    assert.deepEqual(
      classifyApprovalCallbackOutcome('reject', outcome, 'derived-event-id'),
      { processed: true, derivedEventId: 'derived-event-id', missingDerivedEvent: false },
    );
  }
  assert.deepEqual(
    classifyApprovalCallbackOutcome('approve', 'applied', null),
    { processed: true, derivedEventId: null, missingDerivedEvent: false },
  );
  assert.deepEqual(
    classifyApprovalCallbackOutcome('reject', 'source_not_found', null),
    { processed: false, derivedEventId: null, missingDerivedEvent: false },
  );
  assert.deepEqual(
    classifyApprovalCallbackOutcome('reject', 'future_unknown_outcome', null),
    { processed: false, derivedEventId: null, missingDerivedEvent: false },
  );

  // ── Configuración efectiva Meta/HMAC ─────────────────────────
  const env = new Map<string, string>([
    ['WHATSAPP_NOTIFICATIONS_ENABLED', ' true '],
    ['WHATSAPP_ACCESS_TOKEN', ' access-token-with-outer-space '],
    ['WHATSAPP_PHONE_NUMBER_ID', ' phone-id-with-outer-space '],
    ['WHATSAPP_APP_SECRET', '\tapp-secret-with-outer-space \n'],
    ['WHATSAPP_VERIFY_TOKEN', ' verify-token-with-outer-space '],
    ['WHATSAPP_DEFAULT_COUNTRY_CODE', ' ES '],
    ['WHATSAPP_GRAPH_API_VERSION', ' v21.0 '],
  ]);
  (globalThis as { Deno?: unknown }).Deno = { env: { get: (key: string) => env.get(key) } };

  const cfg = getWhatsAppConfig();
  assert.equal(cfg.accessToken, 'access-token-with-outer-space');
  assert.equal(cfg.phoneNumberId, 'phone-id-with-outer-space');
  assert.equal(cfg.appSecret, 'app-secret-with-outer-space');
  assert.equal(cfg.verifyToken, 'verify-token-with-outer-space');
  assert.equal(cfg.defaultCountryCode, 'ES');
  assert.equal(cfg.graphApiVersion, 'v21.0');
  assert.equal(isWhatsAppLive(), true);

  let metaUrl = '';
  let metaAuthorization = '';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    metaUrl = String(input);
    metaAuthorization = new Headers(init?.headers).get('Authorization') ?? '';
    return new Response(JSON.stringify({ messages: [{ id: 'provider-message-test' }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
  try {
    const sent = await sendWhatsAppTemplateMessage({
      to: '+' + '34600111222',
      templateName: 'task_assigned_es',
      languageCode: 'es',
      bodyParameters: ['A', 'B', 'C', 'D'],
    });
    assert.equal(sent.status, 'sent');
    assert.equal(metaUrl, 'https://graph.facebook.com/v21.0/phone-id-with-outer-space/messages');
    assert.equal(metaAuthorization, 'Bearer access-token-with-outer-space');
  } finally {
    globalThis.fetch = originalFetch;
  }

  const rawBody = '{"object":"whatsapp_business_account"}';
  const expectedKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode('app-secret-with-outer-space'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const configuredKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(cfg.appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const expectedSignature = Buffer.from(await crypto.subtle.sign('HMAC', expectedKey, new TextEncoder().encode(rawBody))).toString('hex');
  const configuredSignature = Buffer.from(await crypto.subtle.sign('HMAC', configuredKey, new TextEncoder().encode(rawBody))).toString('hex');
  assert.equal(configuredSignature, expectedSignature);

  // ── Normalización de teléfonos ──────────────────────────────
  const expSix = CC + '600111222';
  const expSeven = CC + '711222333';
  assert.equal(normalizeSpanishPhoneE164('600111222'), expSix);
  assert.equal(normalizeSpanishPhoneE164('+34 600 111 222'), expSix);
  assert.equal(normalizeSpanishPhoneE164('0034600111222'), expSix);
  assert.equal(normalizeSpanishPhoneE164('711222333'), expSeven);
  assert.equal(
    normalizeSpanishPhoneE164(['+380', '50', '123', '45', '67'].join(' ')),
    '+' + '380' + '501234567',
  );
  // Inválidos -> null
  assert.equal(normalizeSpanishPhoneE164(''), null);
  assert.equal(normalizeSpanishPhoneE164(null), null);
  assert.equal(normalizeSpanishPhoneE164('123'), null);
  assert.equal(normalizeSpanishPhoneE164('900111222'), null); // no empieza por 6/7
  assert.equal(normalizeSpanishPhoneE164('60011122233'), null); // demasiado largo
  assert.equal(normalizeSpanishPhoneE164('34' + '600111222'), null); // prefijo ambiguo sin +/00
  assert.equal(normalizeSpanishPhoneE164(['+380', '50', '123', '45', '67', 'ext', '9'].join(' ')), null);
  assert.equal(normalizeSpanishPhoneE164('++' + '33' + '712345678'), null);

  // ── isE164 ──────────────────────────────────────────────────
  assert.equal(isE164(expSix), true);
  assert.equal(isE164('600111222'), false);
  assert.equal(isE164(''), false);
  assert.equal(isE164('+' + '1'.repeat(7)), false); // menos de 8 dígitos
  assert.equal(isE164('+' + '1'.repeat(15)), true);
  assert.equal(isE164('+' + '1'.repeat(16)), false);
  assert.equal(isE164('+' + '0' + '1'.repeat(8)), false);

  // ── Dedupe keys deterministas ───────────────────────────────
  assert.equal(approvalReminderDedupeKey('t1', '2026-07-01'), 'task_approval_reminder:t1:2026-07-01');
  assert.equal(
    approvalReminderDedupeKey('t1', '2026-07-01'),
    approvalReminderDedupeKey('t1', '2026-07-01'),
  );
  assert.notEqual(
    approvalReminderDedupeKey('t1', '2026-07-01'),
    approvalReminderDedupeKey('t1', '2026-07-02'),
  );
  assert.equal(lateStartDedupeKey('t1'), 'task_late_start_reminder:t1');

  // ── Transiciones de approval_status ─────────────────────────
  const pending = buildPendingApprovalPatch();
  assert.equal(pending.approval_status, 'pending');
  assert.ok(pending.approval_requested_at); // se setea timestamp
  assert.equal(pending.approved_at, null);
  assert.equal(pending.rejected_at, null);

  const notRequired = buildNotRequiredPatch();
  assert.equal(notRequired.approval_status, 'not_required');

  console.log('whatsapp-prep: todas las aserciones OK');
}
