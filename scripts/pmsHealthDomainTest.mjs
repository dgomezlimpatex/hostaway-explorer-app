import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Compila el código REAL del panel (dominio, normalizadores y lecturas); no hay copias del algoritmo.
const outdir = mkdtempSync(join(tmpdir(), 'pms-health-'));
const outfile = join(outdir, 'bundle.mjs');
await build({
  stdin: {
    contents: `
      export * from './src/features/pmsHealth/pmsHealthDomain';
      export * from './src/features/pmsHealth/pmsHealthEvidence';
      export * from './src/features/pmsHealth/pmsHealthReads';
    `,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  logLevel: 'silent',
});
const M = await import(pathToFileURL(outfile).href);
rmSync(outdir, { recursive: true, force: true });

const {
  evaluatePmsHealth, buildSmoobuEvidence, buildLhEvidence, readSmoobuRaw, readLhRaw,
  madridWallTimeToDate, latestExpectedPass, safeErrorSummary, dedupeSummaries,
  formatAge, SMOOBU_SCHEDULE,
} = M;

const ok = (data) => ({ state: 'ok', data });
const err = { state: 'error' };
const iso = (s) => new Date(s).toISOString();
// 17/10/2026 es horario de verano de Madrid (UTC+2). 15:20 Madrid = 13:20Z.
const NOW = new Date('2026-10-17T13:20:00Z');
const minutesAgo = (n, now = NOW) => new Date(now.getTime() - n * 60_000).toISOString();

const run = (over = {}) => ({
  id: 'r' + Math.random(), cuando: '2026-10-17T13:02:00Z', disparo: 'programada', modo: 'real',
  reservas: 11, altas: 0, actualizaciones: 0, sin_cambios: 11, canceladas: 0, errores: 0, sin_mapear: 0,
  detalle: [], ...over,
});
const smoobu = ({ runs = [], requests = [], pending, now = NOW } = {}) => evaluatePmsHealth(buildSmoobuEvidence({
  runs: runs === 'error' ? err : ok(runs),
  requests: requests === 'error' ? err : ok(requests),
  pending: pending ?? ok({ reservations: [], mappings: [] }),
}, now));

// ---------- Horas de Madrid y cambio de hora ----------
assert.equal(madridWallTimeToDate('2026-10-24', '08:00').toISOString(), '2026-10-24T06:00:00.000Z', 'verano UTC+2');
assert.equal(madridWallTimeToDate('2026-10-25', '08:00').toISOString(), '2026-10-25T07:00:00.000Z', 'tras el cambio a invierno UTC+1');
assert.equal(madridWallTimeToDate('2026-03-29', '08:00').toISOString(), '2026-03-29T06:00:00.000Z', 'tras el cambio a verano');
assert.equal(madridWallTimeToDate('2026-03-28', '19:00').toISOString(), '2026-03-28T18:00:00.000Z', 'víspera del cambio de verano');

// La pasada esperada respeta la cortesía y cruza la medianoche.
assert.equal(latestExpectedPass(new Date('2026-10-17T13:10:00Z'), SMOOBU_SCHEDULE).label, '08:00', '15:10 Madrid: aún dentro de la cortesía de las 15:00');
assert.equal(latestExpectedPass(new Date('2026-10-17T13:31:00Z'), SMOOBU_SCHEDULE).label, '15:00');
assert.equal(latestExpectedPass(new Date('2026-10-17T05:00:00Z'), SMOOBU_SCHEDULE).label, '19:00', '07:00 Madrid: la última fue ayer a las 19:00');

// ---------- Éxito reciente con cambios ----------
{
  const h = smoobu({ runs: [run({ altas: 2, actualizaciones: 1, sin_cambios: 8 })] });
  assert.equal(h.status, 'up_to_date');
  assert.equal(h.label, 'Al día');
  assert.equal(h.lastSuccess.created, 2);
  assert.equal(h.lastSuccess.noNewReservations, false);
  assert.match(h.headline, /2 nuevas/);
  assert.doesNotMatch(h.headline, /No hay nuevas reservas/);
  assert.equal(h.lastAttempt.kind, 'scheduled');
}

// ---------- Éxito reciente sin nuevas reservas: no es un fallo ni una duda ----------
{
  const h = smoobu({ runs: [run()] });
  assert.equal(h.status, 'up_to_date');
  assert.equal(h.lastSuccess.noNewReservations, true);
  assert.match(h.headline, /No hay nuevas reservas/);
  assert.equal(h.findings.length, 0);
}

// ---------- Terminar sin error no prueba una importación ----------
{
  const h = smoobu({ runs: [run({ reservas: 0, sin_cambios: 0 })] });
  assert.equal(h.status, 'warnings');
  assert.equal(h.lastSuccess, null, 'una pasada que no leyó nada no es una importación correcta');
  assert.ok(h.findings.some((f) => f.code === 'no_data_read'));
}

// ---------- Fallo posterior a un éxito ----------
{
  const runs = [
    run({ cuando: '2026-10-17T13:03:00Z', reservas: 11, errores: 11, detalle: [{ ok: false, respuesta: 'Sesión caducada para ana@example.com en https://secreto.example/x?token=abc' }] }),
    run({ cuando: '2026-10-17T06:02:00Z' }),
  ];
  const h = smoobu({ runs });
  assert.equal(h.status, 'error', 'el fallo posterior debe verse aunque haya un éxito anterior');
  assert.equal(h.tone, 'danger');
  assert.equal(h.lastSuccess.at, '2026-10-17T06:02:00Z');
  assert.equal(h.lastAttempt.outcome, 'failed');
  assert.ok(h.findings.some((f) => f.code === 'last_attempt_failed'));
  assert.equal(h.lastErrorAt, '2026-10-17T13:03:00Z');
  const text = h.lastErrorSummaries.join(' ');
  assert.ok(text.length > 0);
  assert.doesNotMatch(text, /@|https?:|example\.com|abc/);
}

// ---------- Fallo parcial ----------
{
  const h = smoobu({ runs: [run({ errores: 2, detalle: [{ ok: false, respuesta: 'Error 500' }, { ok: false, respuesta: 'Error 500' }] })] });
  assert.equal(h.status, 'warnings');
  assert.equal(h.lastAttempt.outcome, 'partial');
  assert.match(h.lastErrorSummaries[0], /Error 500 \(×2\)/);
}

// ---------- Historial vacío ----------
{
  const h = smoobu({ runs: [] });
  assert.equal(h.status, 'insufficient');
  assert.equal(h.label, 'Sin información suficiente');
  assert.notEqual(h.status, 'up_to_date');
  assert.equal(h.lastAttempt, null);
}

// ---------- Error de lectura: nunca verde ----------
{
  const h = smoobu({ runs: 'error' });
  assert.equal(h.status, 'insufficient');
  assert.equal(h.diagnosticReadFailed, true);
  assert.match(h.headline, /No se pudo consultar el diagnóstico/);

  // Historial bueno pero fallan las incidencias o las peticiones: tampoco verde.
  const noPending = smoobu({ runs: [run()], pending: err });
  assert.equal(noPending.status, 'warnings');
  assert.equal(noPending.pendingLinksUnavailable, true);
  const noRequests = smoobu({ runs: [run()], requests: 'error' });
  assert.equal(noRequests.status, 'warnings');
  assert.ok(noRequests.findings.some((f) => f.code === 'in_flight_unavailable'));
}

// ---------- En ejecución / atascada / sin atender ----------
{
  const running = smoobu({ runs: [run()], requests: [{ id: 'q', pedida_at: minutesAgo(3), estado: 'en_curso', completada_at: null }] });
  assert.equal(running.status, 'running');
  assert.equal(running.label, 'En ejecución');

  const stuck = smoobu({ runs: [run()], requests: [{ id: 'q', pedida_at: minutesAgo(50), estado: 'en_curso', completada_at: null }] });
  assert.equal(stuck.status, 'error');
  assert.ok(stuck.findings.some((f) => f.code === 'stuck'));
  assert.match(stuck.headline, /atascada/i);

  const queued = smoobu({ runs: [run()], requests: [{ id: 'q', pedida_at: minutesAgo(3), estado: 'pendiente', completada_at: null }] });
  assert.equal(queued.status, 'up_to_date', 'una petición recién puesta en cola no es un problema');
  const unattended = smoobu({ runs: [run()], requests: [{ id: 'q', pedida_at: minutesAgo(25), estado: 'pendiente', completada_at: null }] });
  assert.equal(unattended.status, 'warnings');
  assert.ok(unattended.findings.some((f) => f.code === 'request_unattended'));

  // Una ejecución en curso no esconde el fallo anterior.
  const failedThenRunning = smoobu({
    runs: [run({ reservas: 5, errores: 5 })],
    requests: [{ id: 'q', pedida_at: minutesAgo(2), estado: 'en_curso', completada_at: null }],
  });
  assert.equal(failedThenRunning.status, 'running');
  assert.ok(failedThenRunning.findings.some((f) => f.code === 'last_attempt_failed'));
}

// ---------- Petición manual fallida sin fila de pasada ----------
{
  const h = smoobu({ runs: [run({ cuando: '2026-10-17T13:02:00Z' })], requests: [{ id: 'q', pedida_at: '2026-10-17T13:10:00Z', estado: 'error', completada_at: '2026-10-17T13:12:00Z' }] });
  assert.equal(h.status, 'error');
  assert.equal(h.lastAttempt.kind, 'manual');
}

// ---------- Información antigua y frecuencia real ----------
{
  const old = smoobu({ runs: [run({ cuando: '2026-10-15T17:05:00Z' })] });
  assert.equal(old.status, 'stale');
  assert.equal(old.label, 'Datos desactualizados');
  assert.equal(old.overduePass.label, '08:00', 'a las 15:20 la pasada de las 15:00 aún está dentro de la cortesía');
  assert.match(old.headline, /No se ha ejecutado la pasada de las 08:00/);

  // Entre pasadas, la antigüedad normal (13 h de noche) NO es incumplimiento.
  const night = smoobu({
    runs: [run({ cuando: '2026-10-16T17:03:00Z' })],
    now: new Date('2026-10-17T05:30:00Z'),
  });
  assert.equal(night.status, 'up_to_date', 'a las 07:30 Madrid, la pasada de las 19:00 de ayer sigue siendo la esperada');

  // Pero a las 08:40 sin la pasada de las 08:00, sí.
  const missed = smoobu({
    runs: [run({ cuando: '2026-10-16T17:03:00Z' })],
    now: new Date('2026-10-17T06:40:00Z'),
  });
  assert.equal(missed.status, 'stale');
  assert.equal(missed.overduePass.label, '08:00');

  // Tras el cambio de hora la pasada de las 08:00 son las 07:00Z.
  const winter = smoobu({
    runs: [run({ cuando: '2026-10-26T07:03:00Z' })],
    now: new Date('2026-10-26T07:40:00Z'),
  });
  assert.equal(winter.status, 'up_to_date');
  const winterMissed = smoobu({
    runs: [run({ cuando: '2026-10-25T18:03:00Z' })],
    now: new Date('2026-10-26T07:40:00Z'),
  });
  assert.equal(winterMissed.status, 'stale');
}

// ---------- Simulaciones: no cuentan ----------
{
  const h = smoobu({ runs: [run({ cuando: '2026-10-17T13:10:00Z', modo: 'simulacion', errores: 9, reservas: 9 }), run()] });
  assert.equal(h.status, 'up_to_date');
  assert.equal(h.ignoredAttempts, 1);
  assert.ok(h.findings.some((f) => f.code === 'ignored_simulations' && f.severity === 'info'));
  const onlySim = smoobu({ runs: [run({ modo: 'simulacion' })] });
  assert.equal(onlySim.status, 'insufficient', 'solo simulaciones: no hay ninguna importación real');
}

// ---------- Integración desactivada solo si la configuración lo confirma ----------
{
  const base = buildSmoobuEvidence({ runs: ok([run({ errores: 9, reservas: 9 })]), requests: ok([]), pending: ok({ reservations: [], mappings: [] }) }, NOW);
  assert.equal(evaluatePmsHealth({ ...base, enabled: false }).status, 'disabled');
  assert.notEqual(evaluatePmsHealth({ ...base, enabled: null }).status, 'disabled', 'sin confirmación no se declara desactivada');
  assert.equal(base.enabled, null, 'ninguna fuente real confirma la activación: nunca se infiere');
}

// ---------- Propiedades sin vincular (Smoobu) ----------
{
  const pending = ok({
    reservations: [
      { property_name: 'Apto 3', status: 'confirmed' },
      { property_name: 'Apto 3', status: 'confirmed' },
      { property_name: 'Apto 9', status: 'cancelled' },
      { property_name: 'Apto 7', status: 'canceled' },
      { property_name: 'Apto 1', status: 'confirmed' },
      { property_name: null, status: 'confirmed' },
    ],
    mappings: [{ smoobu_property_name: 'Apto 1', is_active: true }, { smoobu_property_name: 'Apto 3', is_active: false }],
  });
  const h = smoobu({ runs: [run()], pending });
  assert.equal(h.status, 'warnings');
  assert.equal(h.pendingLinks.unattributedTotal, 2, 'las canceladas no cuentan; un mapeo pausado no vincula');
  assert.deepEqual(h.pendingLinks.unattributed, [{ kind: 'property_unmapped', label: 'Apto 3', count: 2 }]);
  assert.deepEqual(h.pendingLinks.sede, { state: 'not_applicable' }, 'Smoobu no relaciona sus incidencias con sedes');
  assert.ok(h.findings.some((f) => f.code === 'pending_links'));
  assert.equal(h.scheduleBasis, 'execution');
  assert.equal(h.executionRecorded, true);
}

// ---------- Little Hotelier ----------
// 17/10/2026 15:20 Madrid (UTC+2). Horario declarado: 09:00, 14:00 y 20:00.
const LH_NOW = new Date('2026-10-17T13:20:00Z');
const lhRows = (startIso, count, over = {}) => Array.from({ length: count }, (_, i) => ({
  id: `${startIso}-${i}`, success: true, status_code: 200, error_message: null,
  created_at: new Date(new Date(startIso).getTime() + i * 2000).toISOString(),
  result: { reservation_created: false, cancelled: false }, ...over,
}));
const SEDE_A = { id: 'sede-a', nombre: 'Sede A' };
const noPending = ok({ reservations: [], mappings: [], properties: [] });
const lh = ({ logs, pending = noPending, now = LH_NOW, sede = SEDE_A } = {}) => evaluatePmsHealth(buildLhEvidence({
  logs: logs === 'error' ? err : ok(logs ?? []),
  pending,
}, now, sede));

assert.equal(M.LITTLE_HOTELIER_SCHEDULE.times.join(','), '09:00,14:00,20:00');

{
  // Programación, ejecución e importación confirmada son cosas distintas.
  const h = lh({ logs: lhRows('2026-10-17T12:00:30Z', 28) }); // 14:00 Madrid
  assert.equal(h.status, 'up_to_date');
  assert.equal(h.scheduleBasis, 'received_data');
  assert.equal(h.executionRecorded, false, 'ninguna fuente registra la ejecución de la pasada');
  assert.deepEqual(h.scheduleTimes, ['09:00', '14:00', '20:00']);
  assert.equal(h.lastSuccess.read, 28, 'importación confirmada = reservas recibidas sin error');
  assert.equal(h.lastAttempt.kind, 'unknown', 'en horario no se afirma nada sobre cómo se lanzó');
  assert.match(h.headline, /Última importación correcta/);
}
{
  // La siguiente pasada esperada y su margen: ni avisos de noche ni de la propia pasada.
  const pass = (iso) => lhRows(iso, 10);
  // 14:10 Madrid: la pasada de las 14:00 aún está dentro del margen aunque no conste.
  assert.equal(lh({ logs: pass('2026-10-17T07:00:30Z'), now: new Date('2026-10-17T12:10:00Z') }).status, 'up_to_date');
  // 14:40 Madrid sin pasada de las 14:00: desactualizado, con texto que no afirma «no se ejecutó».
  const missed = lh({ logs: pass('2026-10-17T07:00:30Z'), now: new Date('2026-10-17T12:40:00Z') });
  assert.equal(missed.status, 'stale');
  assert.equal(missed.overduePass.label, '14:00');
  assert.match(missed.headline, /No constan reservas recibidas de la pasada de las 14:00/);
  assert.doesNotMatch(missed.headline, /No se ha ejecutado/);
  assert.match(missed.findings.find((f) => f.code === 'not_run').text, /Puede que no se ejecutara, que fallara antes de enviar o que no encontrara reservas/);
  // Noche: a las 08:00 Madrid la última esperada es la de las 20:00 de ayer. No hay aviso.
  const night = lh({ logs: pass('2026-10-17T18:00:30Z'), now: new Date('2026-10-18T06:00:00Z') });
  assert.equal(night.status, 'up_to_date', 'durante la noche no se avisa');
  // 09:40 Madrid del día siguiente sin pasada de las 09:00: ahora sí.
  assert.equal(lh({ logs: pass('2026-10-17T18:00:30Z'), now: new Date('2026-10-18T07:40:00Z') }).status, 'stale');
  // Muy antigua: desactualizada, no «al día» ni «sin horario».
  const ancient = lh({ logs: lhRows('2026-09-01T09:00:00Z', 28) });
  assert.equal(ancient.status, 'stale');
  assert.ok(ancient.lastSuccess.ageMinutes > 60 * 24 * 40);
  assert.equal(formatAge(ancient.lastSuccess.ageMinutes).includes('días'), true);
}
{
  // Ejecución manual: solo se infiere cuando una pasada empieza claramente fuera de horario.
  const offHours = lh({ logs: lhRows('2026-10-17T09:30:00Z', 12) }); // 11:30 Madrid
  assert.equal(offHours.lastAttempt.kind, 'off_schedule');
  const nearSlot = lh({ logs: lhRows('2026-10-17T12:20:00Z', 12) }); // 14:20 Madrid, dentro de la ventana
  assert.equal(nearSlot.lastAttempt.kind, 'unknown');
  // Una pasada manual también cuenta como datos recibidos: cubre la pasada esperada.
  const manualCovers = lh({ logs: lhRows('2026-10-17T11:55:00Z', 12), now: new Date('2026-10-17T13:20:00Z') });
  assert.equal(manualCovers.status, 'up_to_date');
}
{
  // Pasadas separadas por más de diez minutos; conteos de nuevas y canceladas.
  const first = lhRows('2026-10-17T07:00:00Z', 10);
  const second = lhRows('2026-10-17T12:00:00Z', 12);
  second[0].result = { reservation_created: true };
  second[1].result = { reservation_created: true };
  second[2].result = { cancelled: true };
  const h = lh({ logs: [...first, ...second] });
  assert.equal(h.lastAttempt.read, 12);
  assert.equal(h.lastAttempt.created, 2);
  assert.equal(h.lastAttempt.cancelled, 1);
  assert.equal(h.lastAttempt.modified, null, 'las filas no distinguen una reserva modificada: no se inventa');
}
{
  // Fallo parcial y total, con mensajes depurados.
  const logs = lhRows('2026-10-17T12:00:00Z', 6);
  logs[1] = { ...logs[1], success: false, status_code: 500, error_message: 'Fallo con maria@example.com tel +34 600123456 en https://x.example/y' };
  logs[2] = { ...logs[2], success: false, status_code: 500, error_message: 'Fallo con maria@example.com tel +34 600123456 en https://x.example/y' };
  const partial = lh({ logs });
  assert.equal(partial.lastAttempt.outcome, 'partial');
  assert.equal(partial.status, 'warnings');
  const text = partial.lastErrorSummaries.join(' ');
  assert.doesNotMatch(text, /@|https?:|600123456/);
  assert.match(text, /Error del servicio \(500\)/);
  assert.match(text, /×2/);

  const allFailed = lh({ logs: lhRows('2026-10-17T12:00:00Z', 3, { success: false, status_code: 401, error_message: 'No autorizado' }) });
  assert.equal(allFailed.status, 'error');
  assert.match(allFailed.lastErrorSummaries[0], /Acceso rechazado \(401\)/);

  // Fallo posterior a un éxito anterior.
  const after = lh({ logs: [...lhRows('2026-10-17T07:00:00Z', 8), ...lhRows('2026-10-17T12:30:00Z', 4, { success: false, status_code: 502, error_message: null })] });
  assert.equal(after.status, 'error');
  assert.equal(after.lastSuccess.at, new Date(new Date('2026-10-17T07:00:00Z').getTime() + 7 * 2000).toISOString());
}
{
  // Recibiendo datos ahora vs. terminada.
  const live = lh({ logs: lhRows('2026-10-17T13:17:00Z', 20) });
  assert.equal(live.status, 'running');
  const finished = lh({ logs: lhRows('2026-10-17T12:50:00Z', 20) });
  assert.notEqual(finished.status, 'running');
}
{
  // Historial vacío y error de lectura. La falta de registros NUNCA se interpreta como «desactivada».
  const empty = lh({ logs: [] });
  assert.equal(empty.status, 'insufficient');
  assert.notEqual(empty.status, 'disabled');
  assert.match(empty.headline, /No hay ninguna ejecución registrada/);
  const failed = lh({ logs: 'error' });
  assert.equal(failed.status, 'insufficient');
  assert.equal(failed.diagnosticReadFailed, true);
  assert.equal(M.buildLhEvidence({ logs: ok([]), pending: noPending }, LH_NOW, null).enabled, null);
}

// ---------- Vinculación de Little Hotelier: casos separados y sede por mapeo ----------
{
  const map = (lh_room, service_kind, sede_id, over = {}) => ({ lh_room, service_kind, is_active: true, sede_id, propiedad_id: `p-${lh_room}`, ...over });
  const res = (id, room, over = {}) => ({ id, room, rooms: room ? [room] : null, status: 'confirmed', needs_room_assignment: false, ...over });
  const reservations = [
    res('1', 'Hab 1'),                                          // completa en A
    res('2', 'Hab 2'),                                          // sin ningún mapeo
    res('5', 'Hab 2'),
    res('4', 'Hab 2', { status: 'cancelled' }),                 // cancelada: no cuenta
    { id: '3', room: '-', rooms: null, status: 'confirmed', needs_room_assignment: true }, // sin habitación
    res('6', 'Hab 3'),                                          // solo estancia en A
    res('7', 'Hab 4'),                                          // mapeos pausados en B
    res('8', 'Hab 5'),                                          // solo salida en A
    res('9', 'Hab 6'),                                          // sede del mapeo ≠ sede de la propiedad
    { id: '10', room: 'Hab 1, Hab 3', rooms: ['Hab 1', 'Hab 3'], status: 'confirmed', needs_room_assignment: false },
  ];
  const mappings = [
    map('Hab 1', 'checkout', 'sede-a'), map('Hab 1', 'stay', 'sede-a'),
    map('Hab 3', 'stay', 'sede-a'),
    map('Hab 4', 'checkout', 'sede-b', { is_active: false }), map('Hab 4', 'stay', 'sede-b', { is_active: false }),
    map('Hab 5', 'checkout', 'sede-a'),
    map('Hab 6', 'checkout', 'sede-a'), map('Hab 6', 'stay', 'sede-a'),
  ];
  const properties = [{ id: 'p-Hab 6', sede_id: 'sede-b' }, { id: 'p-Hab 1', sede_id: 'sede-a' }];
  const pending = ok({ reservations, mappings, properties });

  const a = lh({ logs: lhRows('2026-10-17T12:00:30Z', 5), pending, sede: SEDE_A });
  // Sin propiedad ni sede: sin habitación (1) + Hab 2 (2 reservas vigentes, la cancelada no cuenta).
  assert.equal(a.pendingLinks.unattributedTotal, 3);
  assert.deepEqual(
    a.pendingLinks.unattributed.map((i) => [i.kind, i.count]).sort(),
    [['no_room', 1], ['room_unlinked', 2]].sort(),
  );
  assert.equal(a.pendingLinks.sede.state, 'ok');
  assert.deepEqual(a.pendingLinks.sede.blocking, [], 'en la sede A no hay nada que bloquee');
  const kindsA = a.pendingLinks.sede.review.map((i) => `${i.kind}:${/«([^»]+)»/.exec(i.label)[1]}:${i.count}`).sort();
  assert.deepEqual(kindsA, [
    'checkout_missing:Hab 3:2', // reservas 6 y 10
    'sede_mismatch:Hab 6:1',
    'stay_missing:Hab 5:1',
  ].sort(), 'salida y estancia pendientes se muestran como configuración por revisar');
  assert.equal(a.status, 'warnings', 'lo que no tiene sede sí cambia el estado global');

  // Otra sede ve solo lo suyo; el estado global no cambia con la sede.
  const b = lh({ logs: lhRows('2026-10-17T12:00:30Z', 5), pending, sede: { id: 'sede-b', nombre: 'Sede B' } });
  assert.deepEqual(b.pendingLinks.sede.blocking.map((i) => [i.kind, i.count]), [['room_unlinked', 1]]);
  assert.match(b.pendingLinks.sede.blocking[0].label, /mapeo pausado/);
  assert.deepEqual(b.pendingLinks.sede.review.map((i) => i.kind), ['sede_mismatch'], 'la incoherencia se ve en las dos sedes implicadas');
  assert.equal(b.status, a.status);
  assert.deepEqual(b.pendingLinks.unattributed, a.pendingLinks.unattributed);

  // Sin sede activa no se inventa ninguna: se declara sin información por sede.
  const none = lh({ logs: lhRows('2026-10-17T12:00:30Z', 5), pending, sede: null });
  assert.equal(none.pendingLinks.sede.state, 'no_active_sede');
  assert.ok(none.findings.some((f) => f.code === 'sede_unavailable' && f.scope === 'sede'));
  assert.equal(none.status, a.status);

  // La sede de la reserva NO se usa: el campo ni se lee.
  assert.ok(!('sede_id' in reservations[0]));
}
{
  // Solo incidencias de sede: el estado global no se ensucia, pero se ven.
  const pending = ok({
    reservations: [{ id: '1', room: 'Hab 7', rooms: ['Hab 7'], status: 'confirmed', needs_room_assignment: false }],
    mappings: [{ lh_room: 'Hab 7', service_kind: 'checkout', is_active: true, sede_id: 'sede-a', propiedad_id: 'p7' }],
    properties: [{ id: 'p7', sede_id: 'sede-a' }],
  });
  const h = lh({ logs: lhRows('2026-10-17T12:00:30Z', 5), pending });
  assert.equal(h.status, 'up_to_date', 'configuración por revisar no es una advertencia global');
  assert.ok(h.findings.some((f) => f.code === 'config_review' && f.severity === 'info'));
  assert.equal(h.pendingLinks.unattributedTotal, 0);
}
{
  // Un fallo al leer la vinculación nunca deja el estado en verde.
  const h = lh({ logs: lhRows('2026-10-17T12:00:30Z', 5), pending: err });
  assert.equal(h.status, 'warnings');
  assert.equal(h.pendingLinksUnavailable, true);
}

// ---------- Resumen de error seguro ----------
{
  const samples = [
    ['Bearer ', ['eyJ', 'hbGciOiJIUzI1NiJ9'].join(''), '.abc.def falló'].join(''),
    'password=hunter2 rechazada',
    ['apikey: ', ['sk', 'live', '1234567890abcdefghijklmnop'].join('_')].join(''),
    'at Object.fn (file:///C:/x.ts:1:2)\nTypeError: x is undefined\n    at run (/srv/app.js:3:4)',
    'Llamar al 981 123 456 o a juan.perez@correo.es',
  ];
  for (const sample of samples) {
    const out = safeErrorSummary(sample);
    assert.ok(out === null || out.length <= 141);
    assert.doesNotMatch(out ?? '', /eyJ|hunter2|sk_live|file:\/\/|\.js:|@|981 123 456/);
  }
  assert.equal(safeErrorSummary('at foo (x.js:1:1)'), null);
  assert.ok(safeErrorSummary('x'.repeat(500)).length <= 141);
  assert.equal(safeErrorSummary(undefined, 403), 'Acceso rechazado (403)');
  assert.deepEqual(dedupeSummaries(['a', 'b', 'a', null]), ['a (×2)', 'b']);
}

// ---------- Lecturas: solo select, sin escrituras, sin datos de huéspedes ----------
function fakeDb(fixtures, calls = []) {
  const ALLOWED = new Set(['select', 'order', 'limit', 'gte', 'in']);
  return {
    calls,
    from(table) {
      const entry = { table, ops: [] };
      calls.push(entry);
      const chain = new Proxy({}, {
        get(_t, prop) {
          if (prop === 'then') {
            const result = fixtures[table];
            const payload = typeof result === 'function' ? result(entry.ops) : result;
            return (resolve) => resolve(payload);
          }
          if (!ALLOWED.has(prop)) throw new Error(`Operación no permitida en el panel: ${String(prop)}`);
          return (...args) => { entry.ops.push({ op: prop, args }); return chain; };
        },
      });
      return chain;
    },
  };
}
{
  const calls = [];
  const db = fakeDb({
    lh_sync_logs: { data: lhRows('2026-10-17T12:00:00Z', 3), error: null },
    lh_reservations: { data: [{ id: '1', room: 'Hab 9', rooms: ['Hab 9'], status: 'confirmed', needs_room_assignment: false }], error: null },
    lh_room_mapping: { data: [{ lh_room: 'Hab 1', service_kind: 'checkout', is_active: true, sede_id: 'sede-a', propiedad_id: 'p1' }], error: null },
    properties: { data: [{ id: 'p1', sede_id: 'sede-a' }], error: null },
  }, calls);

  const raw = await readLhRaw(db, '2026-10-17');
  assert.equal(raw.pending.state, 'ok');
  assert.deepEqual(raw.pending.data.properties, [{ id: 'p1', sede_id: 'sede-a' }]);
  const reservationsCall = calls.find((c) => c.table === 'lh_reservations');
  assert.ok(reservationsCall.ops.some((o) => o.op === 'gte' && o.args[1] === '2026-10-17'), 'solo reservas vigentes');
  assert.equal(reservationsCall.ops.find((o) => o.op === 'select').args[0], 'id, room, rooms, status, needs_room_assignment',
    'no se lee sede_id de la reserva ni ningún dato de huésped');
  assert.deepEqual(calls.find((c) => c.table === 'properties').ops.find((o) => o.op === 'in').args, ['id', ['p1']]);
  assert.ok(calls.every((c) => c.ops.every((o) => ['select', 'order', 'limit', 'gte', 'in'].includes(o.op))));
  assert.ok(calls.every((c) => !/payload|guest_name/.test(JSON.stringify(c.ops))), 'no se leen datos de huéspedes ni cargas');

  // Sin mapeos no hay propiedades que consultar.
  const emptyCalls = [];
  const empty = await readLhRaw(fakeDb({
    lh_sync_logs: { data: [], error: null }, lh_reservations: { data: [], error: null }, lh_room_mapping: { data: [], error: null },
  }, emptyCalls), '2026-10-17');
  assert.equal(empty.pending.state, 'ok');
  assert.ok(!emptyCalls.some((c) => c.table === 'properties'));

  // Si falla la lectura de propiedades, la vinculación queda como error, no como «sin incidencias».
  const failProps = await readLhRaw(fakeDb({
    lh_sync_logs: { data: [], error: null },
    lh_reservations: { data: [], error: null },
    lh_room_mapping: { data: [{ lh_room: 'Hab 1', service_kind: 'checkout', is_active: true, sede_id: 'a', propiedad_id: 'p1' }], error: null },
    properties: { data: null, error: { message: 'boom' } },
  }), '2026-10-17');
  assert.equal(failProps.pending.state, 'error');
}
{
  // Un error de Supabase o una excepción nunca se convierte en lista vacía.
  const calls = [];
  const raw = await readSmoobuRaw(fakeDb({
    smoobu_sync_runs: { data: null, error: { message: 'permission denied for table x' } },
    smoobu_sync_requests: () => { throw new Error('boom'); },
    smoobu_reservations: { data: [], error: null },
    smoobu_property_mappings: { data: [], error: { message: 'x' } },
  }, calls), '2026-10-17');
  assert.equal(raw.runs.state, 'error');
  assert.equal(raw.requests.state, 'error');
  assert.equal(raw.pending.state, 'error', 'basta que falle una de las dos lecturas de vinculación');
  const h = evaluatePmsHealth(buildSmoobuEvidence(raw, NOW));
  assert.equal(h.status, 'insufficient');
  assert.ok(!JSON.stringify(h).includes('permission denied'), 'el mensaje técnico del servidor no llega a la interfaz');
  // Todas las lecturas piden columnas por nombre (nunca select *).
  assert.ok(calls.every((c) => c.ops.find((o) => o.op === 'select')?.args[0] !== '*'));
  assert.equal(calls.find((c) => c.table === 'smoobu_sync_runs').ops.find((o) => o.op === 'limit').args[0], 30);
}

// ---------- Contrato de solo lectura del código fuente ----------
{
  const files = [
    'src/features/pmsHealth/pmsHealthDomain.ts',
    'src/features/pmsHealth/pmsHealthEvidence.ts',
    'src/features/pmsHealth/pmsHealthReads.ts',
    'src/features/pmsHealth/usePmsHealth.ts',
    'src/features/pmsHealth/PmsHealthPanel.tsx',
    'src/pages/PmsHealth.tsx',
  ];
  const banned = [
    ['ins', 'ert'], ['upd', 'ate'], ['ups', 'ert'], ['del', 'ete'], ['r', 'pc'],
  ].map((p) => new RegExp(`\\.${p.join('')}\\s*\\(`));
  const bannedWords = [
    new RegExp(['use', 'Mutation'].join('')),
    new RegExp(['fun', 'ctions\\.inv', 'oke'].join('')),
    new RegExp(['\\bfe', 'tch\\('].join('')),
    new RegExp(['axi', 'os'].join('')),
    new RegExp(['service', '_role'].join('')),
    new RegExp(['\\.au', 'th\\b'].join('')),
    new RegExp(['Sincronizar ', 'ahora'].join('')),
  ];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const pattern of [...banned, ...bannedWords]) assert.doesNotMatch(source, pattern, `${file} no debe contener ${pattern}`);
  }
  const panel = readFileSync('src/features/pmsHealth/PmsHealthPanel.tsx', 'utf8');
  assert.match(panel, /Actualizar solo vuelve a leer/);
  assert.match(panel, /onClick=\{\(\) => void view\.refresh\(\)\}/);
  assert.match(panel, /to=\{meta\.route\}/);
  const hook = readFileSync('src/features/pmsHealth/usePmsHealth.ts', 'utf8');
  assert.match(hook, /refetchSmoobu\(\), refetchLh\(\)/);
  assert.match(hook, /queryKey: \['pms-health', 'little-hotelier'\]/, 'la lectura no depende de la sede');
  assert.match(hook, /sedeId, sedeNombre\]/, 'la sede solo filtra lo que se muestra');
}

// ---------- Navegación y permisos ----------
{
  const app = readFileSync('src/App.tsx', 'utf8');
  const sidebar = readFileSync('src/components/dashboard/DashboardSidebar.tsx', 'utf8');
  const mobile = readFileSync('src/components/dashboard/MobileDashboardSidebar.tsx', 'utf8');
  assert.match(app, /const PmsHealth = React\.lazy/);
  assert.match(app, /path="\/sincronizaciones"[\s\S]{0,140}requiredModule="admin"/);
  assert.match(sidebar, /title: 'Estado de los PMS'[\s\S]{0,80}href: '\/sincronizaciones'[\s\S]{0,60}permission: 'admin-only'/);
  assert.match(mobile, /title: 'Estado de los PMS', href: '\/sincronizaciones'[^}]*permission: 'admin-only'/);
}

console.log('pmsHealthDomainTest: OK');
