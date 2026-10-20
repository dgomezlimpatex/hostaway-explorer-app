// Monitor de WhatsApp: estados, causas, línea de tiempo, filtros en URL, contador
// del menú y validaciones, sobre el código real del modelo (sin red ni Supabase).
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const load = async entry => {
  const result = await build({ entryPoints: [entry], bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent', metafile: true });
  const inputs = Object.keys(result.metafile.inputs);
  assert.ok(!inputs.some(path => /integrations[\\/]supabase/.test(path)), `${entry} no debe incluir el cliente real de Supabase`);
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
};
const m = await load('src/features/whatsapp-monitor/whatsappMonitorModel.ts');

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed += 1; } catch (error) { console.error(`✗ ${name}`); throw error; }
};

// "Ahora" = martes 20/10/2026 12:00 en Madrid (10:00 UTC).
const NOW = Date.parse('2026-10-20T10:00:00Z');
const ago = min => new Date(NOW - min * 60000).toISOString();
const row = o => ({ id: 'd', notification_event_id: 'e', provider_message_ref: null, recipient_masked: '•••• 1234', template_name: 'task_assigned_v1', status: 'queued', error_code: null, error_detail: null, sent_at: null, delivered_at: null, read_at: null, failed_at: null, created_at: ago(5), event_type: 'task_assigned', cleaner_name: 'Ana', property: 'Orzán 1º A', task_date: '2026-10-21', total_count: 1, ...o });

test('WA-03: en cola, incierto y desconocido tienen textos distintos', () => {
  const queued = m.statusInfo(row({}));
  const uncertain = m.statusInfo(row({ error_code: 'reconciliation_required' }));
  const unknown = m.statusInfo(row({ status: 'processing_unknown' }));
  assert.equal(queued.key, 'queued');
  assert.equal(uncertain.key, 'uncertain');
  assert.equal(uncertain.label, 'Incierto · intento 1/2');
  assert.equal(unknown.key, 'unknown');
  assert.equal(unknown.label, 'Desconocido: processing_unknown');
  assert.equal(new Set([queued.label, uncertain.label, unknown.label]).size, 3);
  // Un estado del servidor llamado "uncertain" no se confunde con la deducción local.
  assert.equal(m.statusInfo(row({ status: 'uncertain' })).key, 'unknown');
  assert.equal(m.statusInfo(row({ status: 'sent' })).label, 'Aceptado por Meta');
});

test('WA-06: «No enviado» por causa; falta de consentimiento no es fallo técnico', () => {
  const prep = m.skipCause(row({ status: 'skipped', error_detail: 'WhatsApp no está activo (modo preparación / dry-run).' }));
  assert.equal(prep.kind, 'preparation');
  assert.equal(prep.actionable, false);
  const noChannel = m.skipCause(row({ status: 'skipped', error_code: 'channel_unavailable', error_detail: 'Limpiadora sin teléfono/opt-in de WhatsApp' }));
  assert.equal(noChannel.kind, 'no_channel');
  assert.equal(noChannel.actionable, true);
  assert.match(noChannel.hint, /No es un fallo técnico/);
  assert.match(noChannel.hint, /no cambia el consentimiento/);
  const admin = m.skipCause(row({ status: 'skipped', error_code: 'channel_unavailable', error_detail: 'Teléfono administrativo de WhatsApp no configurado' }));
  assert.equal(admin.kind, 'admin_phone');
  const other = m.skipCause(row({ status: 'skipped', error_detail: 'motivo nuevo' }));
  assert.equal(other.kind, 'other');
  assert.equal(other.hint, 'motivo nuevo');
  assert.equal(m.skipCause(row({ status: 'failed' })), null);
  assert.equal(m.failureLabel(row({ error_code: 'invalid_phone' })), 'Teléfono con formato no válido');
  assert.equal(m.failureLabel(row({ error_code: '999' })), 'Código 999');
});

test('WA-04/15: línea de tiempo etiquetada sin inventar entrega ni lectura', () => {
  const sent = row({ status: 'sent', sent_at: ago(45), provider_message_ref: '…c9d0e1f2' });
  const labels = m.basicTimeline(sent, NOW).map(e => e.label);
  assert.ok(labels.includes('Aceptado por Meta'));
  assert.ok(!labels.some(l => /^Entregado/.test(l)), 'sin delivered_at no hay «Entregado»');
  assert.ok(labels.some(l => /Entrega no comunicada por Meta tras más de 30 min/.test(l)));
  const read = row({ status: 'read', sent_at: ago(120), delivered_at: ago(119), read_at: ago(100) });
  const readLabels = m.basicTimeline(read, NOW).map(e => e.label);
  assert.deepEqual(readLabels.slice(1), ['Aceptado por Meta', 'Entregado (comunicado por Meta)', 'Leído (comunicado por Meta)']);
  const delivered = m.basicTimeline(row({ status: 'delivered', sent_at: ago(90), delivered_at: ago(89) }), NOW).map(e => e.label);
  assert.ok(delivered.some(l => /Lectura no comunicada/.test(l)));
  assert.deepEqual(m.lastMoment(read), { verb: 'Leído', at: read.read_at });
  assert.deepEqual(m.lastMoment(row({ status: 'failed', failed_at: ago(30), sent_at: ago(31) })).verb, 'Falló');
  assert.equal(m.lastMoment(row({ status: 'skipped' })).verb, 'No enviado');
  assert.equal(m.lastMoment(row({ error_code: 'reconciliation_required' })).verb, 'Iniciado');
});

test('WA-15: fechas en Europe/Madrid', () => {
  assert.equal(m.formatTaskDate('2026-10-21'), 'mié 21 oct');
  assert.equal(m.formatTaskDate('2026-10-25'), 'dom 25 oct');
  assert.equal(m.formatTaskDate(null), null);
  // 23:30 UTC del 20/10 es ya 21/10 en Madrid: no es «hoy».
  assert.equal(m.formatMoment('2026-10-20T08:20:00Z', NOW), '10:20');
  assert.equal(m.formatMoment('2026-10-20T22:30:00Z', NOW), 'mié 21 oct 00:30');
  // Tras el cambio de hora (domingo 25/10) Madrid es UTC+1.
  assert.equal(m.formatMoment('2026-10-26T09:00:00Z', NOW), 'lun 26 oct 10:00');
  assert.equal(m.formatMoment(null, NOW), '—');
});

test('WA-11: filtros en la URL, por defecto omitidos y valores inválidos ignorados', () => {
  const parsed = m.parseFilters('?periodo=31d&estado=failed&q=orzan&pagina=2&envio=abc&otro=1');
  assert.deepEqual(parsed, { period: '31d', status: 'failed', q: 'orzan', page: 1, delivery: 'abc' });
  assert.equal(m.PERIODS[parsed.period], 31);
  assert.deepEqual(m.parseFilters('?periodo=90d&estado=hack&pagina=-3'), m.DEFAULT_FILTERS);
  const written = m.writeFilters(parsed, new URLSearchParams('otro=1'));
  assert.equal(written.toString(), 'otro=1&periodo=31d&estado=failed&q=orzan&pagina=2&envio=abc');
  assert.equal(m.writeFilters(m.DEFAULT_FILTERS).toString(), '');
  assert.deepEqual(m.activeChips(parsed).map(c => c.key), ['period', 'status', 'q']);
  assert.deepEqual(m.activeChips(m.DEFAULT_FILTERS), []);
  // Solo valores que la RPC actual admite.
  assert.deepEqual(Object.keys(m.STATUS_FILTERS), ['all', 'attention', 'queued', 'sent', 'delivered', 'read', 'failed', 'skipped']);
});

test('WA-12: comodines escapados para ILIKE', () => {
  assert.equal(m.escapeLikePattern(' a_b '), 'a\\_b');
  assert.equal(m.escapeLikePattern('100%'), '100\\%');
  assert.equal(m.escapeLikePattern('c:\\x'), 'c:\\\\x');
  assert.equal(m.escapeLikePattern('Begoña'), 'Begoña');
});

test('WA-05/18: desglose disjunto y contador del menú sin doble conteo', () => {
  const stats = m.parseStats({ sent: 1, delivered: 2, read: 1, failed: 2, skipped: 2, unconfirmed: 1, unresolved: 6, extra: 'x' });
  const b = m.attentionBreakdown(stats);
  assert.deepEqual(b, { failed: 2, uncertain: 1, unconfirmed: 1, skipped: 2, total: 6 });
  assert.equal(b.failed + b.uncertain + b.unconfirmed + b.skipped, b.total);
  // Un incierto (ya en unresolved) y su callback sin correlacionar: el menú cuenta 1, no 2.
  assert.equal(m.menuAttentionCount(1, 1), 1);
  assert.equal(m.menuAttentionCount(0, 2), 2, 'callbacks pendientes sin otro problema siguen avisando');
  assert.equal(m.menuAttentionCount(0, 0), 0);
  assert.deepEqual(m.parseStats(null), { sent: 0, delivered: 0, read: 0, failed: 0, skipped: 0, unconfirmed: 0, unresolved: 0 });
  assert.equal(m.parseStats({ failed: -3, sent: 'NaN' }).failed, 0);
});

test('WA-08: validación del ID y traducción de errores del servidor', () => {
  assert.match(m.validateProviderMessageId('whatsapp', ''), /Introduce/);
  assert.match(m.validateProviderMessageId('whatsapp', 'abc123456789012345678'), /wamid/);
  assert.match(m.validateProviderMessageId('whatsapp', 'wamid.123'), /incompleto/);
  assert.match(m.validateProviderMessageId('whatsapp', 'wamid.HBgL NDQ5MTIzNDU2Nzg5'), /espacios/);
  assert.equal(m.validateProviderMessageId('whatsapp', 'wamid.HBgLMzQ2MTIzNDU2NzgVAgARGBI'), null);
  assert.equal(m.validateProviderMessageId('email', '4ef9a417-02e9-4d39-ad75-9611e0fcc33c'), null);
  assert.match(m.validateProviderMessageId('email', 'abc'), /incompleto/);
  for (const code of ['forbidden', 'delivery_not_reconcilable', 'whatsapp_uncertain_cannot_be_reopened', 'resend_idempotency_window_expired', 'provider_message_id_required']) {
    const text = m.resolutionErrorMessage({ message: code });
    assert.ok(!text.includes(code) && text.length > 10, `${code} traducido`);
  }
  assert.match(m.resolutionErrorMessage({ code: '23505', message: 'duplicate key value violates unique constraint' }), /en curso/);
  assert.match(m.resolutionErrorMessage(new Error('x')), /No se pudo encolar/);
  assert.equal(m.uncertaintyLabel('meta_contacting').canConfirm, false);
  assert.equal(m.uncertaintyLabel('meta_uncertain').canConfirm, true);
  assert.equal(m.uncertaintyLabel('otro').canConfirm, false);
});

test('WA-09: ventana de reintento por email estimada de forma prudente', () => {
  assert.deepEqual(m.resendWindow(ago(60), NOW).expired, false);
  assert.equal(m.resendWindow(ago(60), NOW).remainingHours, 22);
  assert.equal(m.resendWindow(ago(24 * 60), NOW).expired, true);
  assert.equal(m.resendWindow(ago(23 * 60), NOW).expired, true);
});

test('Degradación: RPC inexistente y permisos', () => {
  assert.equal(m.isMissingRpc({ code: 'PGRST202', message: 'Could not find the function' }), true);
  assert.equal(m.isMissingRpc({ code: '42501' }), false);
  assert.equal(m.isForbidden({ code: '42501', message: 'forbidden' }), true);
  assert.equal(m.isForbidden({ message: 'not_authorized' }), true);
  assert.equal(m.ageLabel(ago(18), NOW), 'hace 18 min');
  assert.equal(m.ageLabel(ago(26 * 60), NOW), 'hace 26 h');
});

console.log(`whatsappMonitorModelTest: ${passed} grupos correctos`);
