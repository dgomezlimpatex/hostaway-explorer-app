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
  // El intento solo se muestra si el servidor lo indica; sin texto no se supone 1/2.
  assert.equal(uncertain.label, 'Resultado incierto');
  assert.equal(m.statusInfo(row({ error_code: 'reconciliation_required', error_detail: 'Intento 1/2 sin respuesta de Meta' })).label, 'Resultado incierto · 1/2');
  const exhausted = m.statusInfo(row({ error_code: 'reconciliation_required', error_detail: 'Intento WhatsApp 2/2 incierto; reintentos automáticos agotados. Requiere conciliación manual' }));
  assert.equal(exhausted.label, 'Resultado incierto · 2/2');
  assert.match(exhausted.meaning, /No habrá más intentos automáticos/);
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
  assert.deepEqual(b, { failed: 2, uncertain: 1, unconfirmed: 1, skipped: 2, total: 6, preparation: null, excludesPreparation: false });
  // Resumen v2 (propuesta de backend): el modo preparación no cuenta y el desglose sigue cuadrando.
  const v2 = m.attentionBreakdown(m.parseStats({ failed: 2, skipped: 3, skipped_preparation: 2, uncertain: 1, unconfirmed: 1, unresolved: 5, attention_version: 2 }));
  assert.deepEqual(v2, { failed: 2, uncertain: 1, unconfirmed: 1, skipped: 1, total: 5, preparation: 2, excludesPreparation: true });
  assert.equal(v2.failed + v2.uncertain + v2.unconfirmed + v2.skipped, v2.total);
  assert.equal(m.parseStats({ uncertain: 4 }).uncertain, undefined, 'sin versión 2 no se leen claves nuevas');
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

// ---------------------------------------------------------------------------
// Rediseño de «Envíos por comprobar»
// ---------------------------------------------------------------------------
const EXHAUSTED = 'Intento WhatsApp 2/2 incierto; reintentos automáticos agotados. Requiere conciliación manual';
const RETRY = 'Resultado de Meta incierto (network_error): tras 15 minutos se permitirá un único reintento 2/2 para priorizar entrega; existe riesgo excepcional de duplicado';
const q = o => ({ delivery_id: 'q', notification_event_id: 'e', channel: 'whatsapp', provider: 'meta_cloud_api', recipient_masked: '•••• 7093', template_name: 'task_assigned_approval_es', uncertainty_state: 'meta_uncertain', detail: EXHAUSTED, created_at: ago(5), open_action_status: null, ...o });

test('Enmascarado: corrige la mala codificación y nunca muestra más de 4 dígitos', () => {
  const moji = 'â€¢â€¢â€¢â€¢ 7093';
  assert.equal(m.phoneTail(moji), '7093');
  assert.equal(m.maskedPhone(moji), '•••• 7093');
  assert.equal(m.recipientLabel(moji), 'Teléfono acabado en 7093');
  assert.ok(!/â|€|¢/.test(m.maskedPhone(moji) + m.recipientLabel(moji)));
  // Aunque el servidor devolviera el número completo, solo salen 4 dígitos.
  assert.equal(m.maskedPhone('+34 600 112 233'), '•••• 2233');
  assert.equal(m.recipientLabel('Oculto'), 'Teléfono oculto');
  assert.equal(m.recipientLabel('••••'), 'Teléfono no disponible');
  assert.equal(m.recipientLabel(null), 'Teléfono no disponible');
  assert.equal(m.maskedPhone('••••'), '••••');
  assert.equal(m.recipientLabel('•••• 4321', 'email'), 'Destinatario acabado en 4321');
});

test('Asunto desde la plantilla, sin inventarlo si no se reconoce', () => {
  assert.equal(m.templateSubject('task_assigned_approval_es'), 'Tarea asignada');
  assert.equal(m.templateSubject('task_modified_es'), 'Tarea modificada');
  assert.equal(m.templateSubject('task_cancelled_es'), 'Asignación cancelada');
  assert.equal(m.templateSubject('task_approval_reminder_es'), 'Recordatorio de aprobación');
  assert.equal(m.templateSubject('task_late_start_reminder_es'), 'Recordatorio de inicio');
  assert.equal(m.templateSubject('task_rejected_admin_alert_es'), 'Alerta de rechazo');
  assert.equal(m.templateSubject('task_rejected_admin_fallback_email'), 'Alerta de rechazo');
  assert.equal(m.templateSubject('plantilla_desconocida_x'), null);
  assert.equal(m.templateSubject(null), null);
});

test('Intento 1/2 y 2/2 según el texto real del servidor', () => {
  assert.deepEqual(m.queueAttempt(q({})), { attempt: '2/2', retryPending: false, exhausted: true });
  assert.deepEqual(m.queueAttempt(q({ detail: RETRY })), { attempt: '1/2', retryPending: true, exhausted: false });
  assert.deepEqual(m.queueAttempt(q({ detail: 'Ejecutando reintento WhatsApp 2/2; riesgo excepcional de duplicado aceptado' })), { attempt: '2/2', retryPending: false, exhausted: false });
  assert.deepEqual(m.queueAttempt(q({ detail: 'Intento 1/2 sin respuesta de Meta' })), { attempt: '1/2', retryPending: false, exhausted: false });
  assert.deepEqual(m.queueAttempt(q({ detail: 'texto nuevo' })), { attempt: null, retryPending: false, exhausted: false });
  assert.deepEqual(m.queueAttempt(q({ channel: 'email', detail: EXHAUSTED })), { attempt: null, retryPending: false, exhausted: false });
});

test('Estado sencillo y explicación contextual', () => {
  const exhausted = m.queueState(q({}));
  assert.equal(exhausted.key, 'unconfirmed');
  assert.equal(exhausted.label, 'Entrega sin confirmar');
  assert.match(exhausted.explanation, /dos veces[\s\S]*No habrá más intentos automáticos/);
  const retry = m.queueState(q({ detail: RETRY }));
  assert.match(retry.explanation, /único reintento automático/);
  assert.doesNotMatch(retry.explanation, /No habrá más/);
  assert.equal(m.queueState(q({ uncertainty_state: 'meta_contacting' })).key, 'contacting');
  assert.equal(m.queueState(q({ open_action_status: 'pending' })).label, 'Registro en curso');
  assert.equal(m.queueState(q({ channel: 'email', uncertainty_state: 'resend_uncertain' })).label, 'Email sin confirmar');
  const unknown = m.queueState(q({ uncertainty_state: 'raro' }));
  assert.equal(unknown.key, 'unknown');
  assert.match(unknown.explanation, /raro/);
});

test('Recientes y anteriores: ninguna fila se pierde y las fechas son de Madrid', () => {
  const rows = [q({ delivery_id: 'a', created_at: '2026-09-04T18:12:00Z' }), q({ delivery_id: 'b', created_at: ago(18) }), q({ delivery_id: 'c', created_at: ago(7 * 1440 - 1) }), q({ delivery_id: 'd', created_at: ago(7 * 1440 + 1) }), q({ delivery_id: 'e', created_at: '2026-10-08T16:40:00Z' })];
  const { recent, older } = m.splitQueueByAge(rows, NOW);
  assert.deepEqual(recent.map(r => r.delivery_id), ['b', 'c']);
  assert.deepEqual(older.map(r => r.delivery_id), ['d', 'e', 'a']);
  assert.equal(recent.length + older.length, rows.length);
  assert.equal(m.dateRangeLabel(older), 'del vie 4 sept al mar 13 oct');
  assert.equal(m.dateRangeLabel([rows[0]]), 'el vie 4 sept');
  assert.equal(m.dateRangeLabel([]), '');
  // 23:30 UTC del 4/9 ya es 5/9 en Madrid.
  assert.equal(m.dateRangeLabel([q({ created_at: '2026-09-04T23:30:00Z' })]), 'el sáb 5 sept');
  assert.equal(m.momentWithAge('2026-09-04T18:12:00Z', NOW), 'vie 4 sept 20:12 · hace 45 días');
  assert.deepEqual(m.splitQueueByAge([], NOW), { recent: [], older: [] });
});

const ev = o => ({ id: 'e', cleaner_id: null, recipient_worker_id: null, recipient_name_snapshot: null, ...o });
const ready = (events, cleaners) => ({ status: 'ready', byEvent: m.resolveRecipientNames(events, cleaners) });

test('Nombres: solo por vínculo exacto del evento (snapshot primero, después la ficha por ID)', () => {
  const events = [
    ev({ id: 'e-snap', cleaner_id: 'c-ana', recipient_name_snapshot: ' Ana Pérez ' }),
    // La ficha de Ana cambió de nombre: el aviso histórico conserva el guardado.
    ev({ id: 'e-renamed', cleaner_id: 'c-ana', recipient_name_snapshot: 'Ana Pérez López' }),
    ev({ id: 'e-record', cleaner_id: 'c-luis' }),
    ev({ id: 'e-worker', recipient_worker_id: 'c-luis' }),
    ev({ id: 'e-same', cleaner_id: 'c-luis', recipient_worker_id: 'c-luis' }),
    ev({ id: 'e-deleted', cleaner_id: 'c-borrada' }),
    ev({ id: 'e-ambiguous', cleaner_id: 'c-ana', recipient_worker_id: 'c-luis' }),
    ev({ id: 'e-ambiguous-snap', cleaner_id: 'c-ana', recipient_worker_id: 'c-luis', recipient_name_snapshot: 'Luis Gómez' }),
    ev({ id: 'e-none' }),
    ev({ id: 'e-blank', cleaner_id: 'c-blank', recipient_name_snapshot: '   ' }),
  ];
  const cleaners = [{ id: 'c-ana', name: 'Ana Ruiz' }, { id: 'c-luis', name: 'Luis Gómez' }, { id: 'c-blank', name: '  ' }];
  // Solo se piden fichas de eventos sin nombre guardado y con un único ID.
  assert.deepEqual(m.workerIdsToLookup(events).sort(), ['c-blank', 'c-borrada', 'c-luis']);
  const r = m.resolveRecipientNames(events, cleaners);
  assert.deepEqual(r.get('e-snap'), { state: 'known', name: 'Ana Pérez', source: 'snapshot' });
  assert.deepEqual(r.get('e-renamed'), { state: 'known', name: 'Ana Pérez López', source: 'snapshot' });
  assert.deepEqual(r.get('e-record'), { state: 'known', name: 'Luis Gómez', source: 'record' });
  assert.deepEqual(r.get('e-worker'), { state: 'known', name: 'Luis Gómez', source: 'record' });
  assert.deepEqual(r.get('e-same'), { state: 'known', name: 'Luis Gómez', source: 'record' });
  assert.equal(r.get('e-deleted').state, 'missing');
  assert.equal(r.get('e-ambiguous').state, 'ambiguous');
  assert.deepEqual(r.get('e-ambiguous-snap'), { state: 'known', name: 'Luis Gómez', source: 'snapshot' });
  assert.equal(r.get('e-none').state, 'missing');
  assert.equal(r.get('e-blank').state, 'missing');
  assert.deepEqual(m.workerIdsToLookup([]), []);
});

test('Identificación: nombre como título, últimos 4 como referencia y ausencias honestas', () => {
  const moji = 'â€¢â€¢â€¢â€¢ 7093';
  // Dos trabajadoras con la misma terminación: cada envío lleva el nombre de su evento.
  const lookup = ready([ev({ id: 'e1', recipient_name_snapshot: 'Ana Pérez' }), ev({ id: 'e2', cleaner_id: 'c-rosa' })], [{ id: 'c-rosa', name: 'Rosa Díaz' }]);
  const a = m.queueIdentity(q({ notification_event_id: 'e1', recipient_masked: moji }), undefined, lookup);
  const b = m.queueIdentity(q({ notification_event_id: 'e2', recipient_masked: moji }), undefined, lookup);
  assert.equal(a.title, 'Ana Pérez');
  assert.equal(b.title, 'Rosa Díaz');
  assert.equal(a.phone, '•••• 7093');
  assert.equal(a.nameSource, 'snapshot');
  assert.equal(b.nameSource, 'record');
  // El nombre del historial (ficha actual por la tarea) nunca sustituye al vínculo exacto.
  const otherName = m.queueIdentity(q({ notification_event_id: 'e1' }), row({ cleaner_name: 'Otra Persona', event_type: 'task_approval_reminder' }), lookup);
  assert.equal(otherName.title, 'Ana Pérez');
  assert.equal(otherName.subject, 'Recordatorio de aprobación');
  assert.equal(otherName.task, 'Orzán 1º A · mié 21 oct');
  const notReturned = m.queueIdentity(q({ notification_event_id: 'e-otra-sede', template_name: null }), row({ cleaner_name: 'Ana Pérez' }), lookup);
  assert.equal(notReturned.title, 'Nombre no disponible');
  assert.equal(notReturned.nameKnown, false);
  assert.equal(notReturned.phone, '•••• 7093');
  assert.match(notReturned.nameNote, /no guardó el nombre/);
  const ambiguous = m.queueIdentity(q({ notification_event_id: 'x' }), undefined, ready([ev({ id: 'x', cleaner_id: 'a', recipient_worker_id: 'b' })], [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]));
  assert.equal(ambiguous.title, 'Nombre no disponible');
  assert.match(ambiguous.nameNote, /dos fichas/);
  const loading = m.queueIdentity(q({}), row({ cleaner_name: 'Ana Pérez' }), { status: 'loading' });
  assert.equal(loading.title, 'Buscando nombre…');
  assert.equal(loading.nameNote, null);
  const failed = m.queueIdentity(q({}), row({ cleaner_name: 'Ana Pérez' }), { status: 'error' });
  assert.equal(failed.title, 'Nombre no disponible');
  assert.equal(failed.nameNote, 'No se pudo consultar el nombre.');
  const hidden = m.queueIdentity(q({ recipient_masked: 'Oculto', template_name: null }), undefined, { status: 'error' });
  assert.equal(hidden.phone, null);
  assert.equal(hidden.subject, null);
  // Nunca se muestran más de 4 dígitos.
  const long = m.queueIdentity(q({ notification_event_id: 'e1', recipient_masked: '+34 600 111 222' }), undefined, lookup);
  assert.equal(long.phone, '•••• 1222');
  for (const value of [a, b, notReturned, failed, long]) assert.ok(!/\d{5,}/.test(JSON.stringify(value)));
});

console.log(`whatsappMonitorModelTest: ${passed} grupos correctos`);
