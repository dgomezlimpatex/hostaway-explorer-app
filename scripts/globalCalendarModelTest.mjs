// Calendario global: modelo, lecturas y enlaces de menú con datos sintéticos y un cliente simulado (sin red).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const load = async entry => {
  const result = await build({ entryPoints: [entry], bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent', metafile: true });
  const inputs = Object.keys(result.metafile.inputs);
  assert.ok(!inputs.some(path => /integrations[\\/]supabase/.test(path)), `${entry} no debe incluir el cliente real de Supabase`);
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
};
const model = await load('src/features/global-calendar/globalCalendarModel.ts');
const reads = await load('src/features/global-calendar/globalCalendarReads.ts');
const {
  civilDay, dayDiff, mondayOf, weekDaysFrom, resolveWeekStart, classifyReservation, mergeReservations,
  projectStays, toCleaning, buildWeek, filterRows, groupRows, formatWeekRange, formatRecordedTime, occupiesNight,
} = model;

let passed = 0;
const test = async (name, fn) => {
  try { await fn(); passed += 1; } catch (error) { console.error(`✗ ${name}`); throw error; }
};

// ---------------------------------------------------------------------------
// Semanas en Europe/Madrid
// ---------------------------------------------------------------------------
await test('semanas de lunes a domingo, también con cambio de hora y de año', () => {
  assert.equal(mondayOf('2026-10-25'), '2026-10-19', 'domingo del cambio de hora de octubre pertenece a la semana del lunes 19');
  assert.equal(mondayOf('2026-10-19'), '2026-10-19');
  assert.deepEqual(weekDaysFrom('2026-10-19'), ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']);
  assert.deepEqual(weekDaysFrom('2026-03-23').slice(-2), ['2026-03-28', '2026-03-29'], 'semana del cambio de hora de marzo');
  assert.deepEqual(weekDaysFrom('2025-12-29'), ['2025-12-29', '2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04']);
  assert.equal(dayDiff('2026-10-24', '2026-10-26'), 2);
  assert.equal(dayDiff('2026-03-28', '2026-03-30'), 2);
  assert.equal(resolveWeekStart('2026-10-25', '2026-01-07'), '2026-10-19');
  assert.equal(resolveWeekStart('2026-02-30', '2026-01-07'), '2026-01-05', 'fecha imposible: semana de hoy');
  assert.equal(resolveWeekStart('basura', '2026-01-04'), '2025-12-29');
  assert.equal(resolveWeekStart(null, '2026-10-19'), '2026-10-19');
  assert.equal(formatWeekRange(weekDaysFrom('2026-10-19')), '19 – 25 oct 2026');
  assert.equal(formatWeekRange(weekDaysFrom('2026-09-28')), '28 sept – 4 oct 2026');
  assert.equal(formatWeekRange(weekDaysFrom('2025-12-29')), '29 dic 2025 – 4 ene 2026');
});

await test('fechas civiles: columnas date intactas e instantes convertidos a Madrid', () => {
  assert.equal(civilDay('2026-10-25'), '2026-10-25');
  assert.equal(civilDay('2026-10-25 00:00:00'), '2026-10-25');
  assert.equal(civilDay('2026-10-24T22:30:00Z'), '2026-10-25', 'verano (UTC+2): ya es día 25 en Madrid');
  assert.equal(civilDay('2026-10-25T23:30:00Z'), '2026-10-26', 'tras el cambio (UTC+1): ya es día 26 en Madrid');
  assert.equal(civilDay('2026-03-28T23:30:00Z'), '2026-03-29');
  assert.equal(civilDay('2026-02-30'), null);
  assert.equal(civilDay(''), null);
  assert.equal(civilDay(null), null);
  assert.equal(formatRecordedTime('2026-10-24T09:05:00Z'), '11:05');
  assert.equal(formatRecordedTime('2026-10-25T09:05:00Z'), '10:05', 'el día del cambio de hora');
  assert.equal(formatRecordedTime('2026-10-25T23:30:00Z', '2026-10-25'), 'lun 26 oct, 00:30', 'fin registrado al día siguiente');
  assert.equal(formatRecordedTime(null), null);
});

// ---------------------------------------------------------------------------
// Reservas
// ---------------------------------------------------------------------------
await test('estados de reserva: canceladas no ocupan, bloqueos aparte', () => {
  for (const status of ['cancelled', 'CANCELED', 'Cancelada', 'no_show', 'No Show', 'UNAVAILABLE', 'deleted', 'Eliminada']) {
    assert.equal(classifyReservation(status), 'cancelled', status);
  }
  assert.equal(classifyReservation('CONFIRMED', '2026-10-01'), 'cancelled', 'fecha de cancelación registrada');
  assert.equal(classifyReservation('block'), 'block');
  assert.equal(classifyReservation('Bloqueo propietario'), 'block');
  for (const status of ['confirmed', 'CONFIRMED', 'active', 'check_in', null, '']) assert.equal(classifyReservation(status), 'stay', String(status));
});

const P = 'prop-a';
const Q = 'prop-b';
const raw = (overrides) => ({ source: 'portal', sourceId: 'r1', propertyId: P, checkIn: '2026-10-19', checkOut: '2026-10-22', status: 'active', ...overrides });

await test('unificación: duplicados entre fuentes, canceladas, solapes y fechas inválidas', () => {
  const merged = mergeReservations([
    raw({}),
    raw({}), // misma fila leída dos veces
    raw({ source: 'avantio', sourceId: 'a1', status: 'CONFIRMED', externalId: 'AV-1' }), // misma estancia en otra fuente
    raw({ sourceId: 'r2', checkIn: '2026-10-20', checkOut: '2026-10-24', status: 'cancelled' }),
    raw({ source: 'avantio', sourceId: 'a2', checkIn: '2026-10-21', checkOut: '2026-10-23', status: 'CONFIRMED' }), // se pisa con r1
    raw({ sourceId: 'r3', propertyId: Q, checkIn: '2026-10-22', checkOut: '2026-10-20' }),
    raw({ sourceId: 'r4', propertyId: Q, checkIn: null }),
  ]);
  assert.equal(merged.cancelled, 1);
  assert.equal(merged.stays.length, 2);
  const [first, second] = merged.stays;
  assert.deepEqual(first.sources.map(source => source.source), ['portal', 'avantio'], 'misma propiedad y fechas: una estancia con dos fuentes');
  assert.equal(first.nights, 3);
  assert.ok(first.notes.includes('overlap') && second.notes.includes('overlap'), 'el solape real se señala en ambas');
  assert.deepEqual(merged.issues.map(issue => issue.sourceId).sort(), ['r3', 'r4']);
});

await test('unificación: no fusiona por similitud y señala reservas ligadas a la misma limpieza', () => {
  const merged = mergeReservations([
    raw({ sourceId: 'x1', taskId: 't-9', checkOut: '2026-10-22' }),
    raw({ source: 'hostaway', sourceId: 'h1', taskId: 't-9', checkIn: '2026-10-22', checkOut: '2026-10-25' }),
    raw({ source: 'avirato', sourceId: 'b1', propertyId: Q, status: 'block', checkIn: '2026-10-19', checkOut: '2026-10-22' }),
    raw({ source: 'portal', sourceId: 'q1', propertyId: Q, checkIn: '2026-10-19', checkOut: '2026-10-22' }),
  ]);
  assert.equal(merged.stays.length, 4, 'fechas distintas o tipo distinto no se fusionan');
  const shared = merged.stays.filter(stay => stay.notes.includes('shared-task'));
  assert.equal(shared.length, 2);
  assert.ok(!shared[0].notes.includes('overlap'), 'salida y entrada el mismo día no es solape');
  const block = merged.stays.find(stay => stay.kind === 'block');
  assert.ok(block.notes.includes('overlap'), 'bloqueo y estancia sobre las mismas noches se señalan');
});

await test('proyección semanal: cruces de semana, mismo día y carriles', () => {
  const days = weekDaysFrom('2026-10-19');
  const { stays } = mergeReservations([
    raw({ sourceId: 'before', checkIn: '2026-10-15', checkOut: '2026-10-21' }), // entra la semana anterior, sale miércoles
    raw({ sourceId: 'turn', checkIn: '2026-10-21', checkOut: '2026-10-28' }), // entra el mismo miércoles, sale la semana siguiente
    raw({ sourceId: 'over', checkIn: '2026-10-20', checkOut: '2026-10-22' }), // se pisa con las dos
    raw({ sourceId: 'mon', checkIn: '2026-10-12', checkOut: '2026-10-19' }), // sale el lunes de esta semana
    raw({ sourceId: 'sun', checkIn: '2026-10-25', checkOut: '2026-10-27' }), // entra el domingo
    raw({ sourceId: 'old', checkIn: '2026-10-10', checkOut: '2026-10-18' }), // fuera de la semana
  ]);
  const { segments, lanes } = projectStays(stays, days);
  const by = id => segments.find(segment => segment.stay.id.includes(`:${id}:`));
  assert.equal(by('old'), undefined);
  assert.deepEqual([by('before').start, by('before').end, by('before').continuesBefore], [0, 5, true]);
  assert.deepEqual([by('turn').start, by('turn').end, by('turn').continuesAfter], [5, 14, true]);
  assert.equal(by('before').lane, by('turn').lane, 'cambio de huésped el mismo día: comparten carril sin pisarse');
  assert.notEqual(by('over').lane, by('before').lane);
  assert.deepEqual([by('mon').start, by('mon').end], [0, 1], 'la salida del lunes se ve hasta mediodía');
  assert.deepEqual([by('sun').start, by('sun').end], [13, 14]);
  assert.ok(lanes >= 2);
  assert.equal(occupiesNight(by('before').stay, '2026-10-21'), false, 'la noche de salida no está ocupada');
  assert.equal(occupiesNight(by('turn').stay, '2026-10-21'), true);
});

// ---------------------------------------------------------------------------
// Limpiezas
// ---------------------------------------------------------------------------
const task = (overrides) => ({
  id: 't1', date: '2026-10-21', start_time: '11:00:00', end_time: '13:00:00', status: 'pending', type: 'Salida',
  propiedad_id: P, property: 'Ático Centro', cleaner: null, task_assignments: [], task_reports: [], ...overrides,
});

await test('estado registrado: prevista, en curso, hecha y revisión', () => {
  const pending = toCleaning(task({ task_assignments: [{ cleaner_id: 'c1', cleaner_name: 'Ana López' }] }));
  assert.equal(pending.state, 'pending');
  assert.equal(pending.start, '11:00');
  assert.deepEqual(pending.cleaners, ['Ana López']);
  const started = toCleaning(task({ task_assignments: [{ cleaner_id: 'c1', cleaner_name: 'Ana' }], task_reports: [{ cleaner_id: 'c1', overall_status: 'in_progress', start_time: '2026-10-21T09:05:00Z', end_time: null }] }));
  assert.equal(started.state, 'in-progress', 'parte iniciado aunque la tarea siga pendiente');
  assert.equal(started.recordedStart, '2026-10-21T09:05:00Z');
  assert.equal(started.recordedEnd, null);
  const team = [{ cleaner_id: 'c1', cleaner_name: 'Ana' }, { cleaner_id: 'c2', cleaner_name: 'Luis' }];
  const half = toCleaning(task({ task_assignments: team, task_reports: [{ cleaner_id: 'c1', overall_status: 'completed', start_time: '2026-10-21T09:00:00Z', end_time: '2026-10-21T10:00:00Z' }] }));
  assert.equal(half.state, 'in-progress', 'equipo: solo una persona ha cerrado');
  assert.deepEqual(half.cleaners, ['Ana', 'Luis']);
  const done = toCleaning(task({ task_assignments: team, task_reports: [
    { cleaner_id: 'c1', overall_status: 'completed', start_time: '2026-10-21T09:00:00Z', end_time: '2026-10-21T10:00:00Z' },
    { cleaner_id: 'c2', overall_status: 'needs_review', start_time: '2026-10-21T09:10:00Z', end_time: '2026-10-21T10:20:00Z' },
  ] }));
  assert.equal(done.state, 'completed');
  assert.equal(done.needsReview, true);
  assert.equal(done.recordedEnd, '2026-10-21T10:20:00Z');
  const legacy = toCleaning(task({ cleaner: ' Marta ', status: 'completed', start_time: null }));
  assert.deepEqual(legacy.cleaners, ['Marta'], 'asignación antigua en la columna cleaner');
  assert.equal(legacy.state, 'completed');
  assert.equal(legacy.start, null);
  assert.equal(toCleaning(task({ status: 'en revisión rara' })).state, 'unknown', 'estado desconocido no se convierte en pendiente ni hecha');
  assert.equal(toCleaning(task({ date: null })), null);
});

// ---------------------------------------------------------------------------
// Semana completa
// ---------------------------------------------------------------------------
const property = (id, overrides = {}) => ({
  id, name: `Piso ${id}`, code: id.toUpperCase(), clientId: 'c1', clientName: 'Cliente Uno', buildingId: 'b1', buildingName: 'Edificio Orzán',
  isActive: true, defaultCheckIn: '16:00', defaultCheckOut: '11:00', ...overrides,
});

await test('semana: noches, cambios de huésped, limpiezas múltiples y datos no disponibles', () => {
  const days = weekDaysFrom('2026-10-19');
  const { stays } = mergeReservations([
    raw({ sourceId: 's1', checkIn: '2026-10-17', checkOut: '2026-10-21' }),
    raw({ sourceId: 's2', checkIn: '2026-10-21', checkOut: '2026-10-23' }),
    raw({ sourceId: 's3', checkIn: '2026-10-24', checkOut: '2026-10-26', status: 'cancelled' }),
    raw({ source: 'avirato', sourceId: 'b1', propertyId: 'prop-c', status: 'block', checkIn: '2026-10-20', checkOut: '2026-10-22' }),
    raw({ sourceId: 'ghost', propertyId: 'otra-sede', checkIn: '2026-10-19', checkOut: '2026-10-21' }),
  ]);
  const cleanings = [
    task({ id: 'late', start_time: '15:00:00' }),
    task({ id: 'early', start_time: '10:00:00', task_assignments: [{ cleaner_id: 'c1', cleaner_name: 'Ana' }, { cleaner_id: 'c2', cleaner_name: 'Luis' }] }),
    task({ id: 'orphan', propiedad_id: null, property: 'Casa sin ficha', date: '2026-10-20' }),
    task({ id: 'foreign', propiedad_id: 'desconocida', date: '2026-10-22' }),
    task({ id: 'other-week', date: '2026-10-27' }),
    task({ id: 'inactive-task', propiedad_id: 'prop-old', date: '2026-10-24' }),
  ].map(toCleaning);
  const week = buildWeek({
    weekDays: days,
    properties: [property(P), property('prop-c'), property('prop-d'), property('prop-e'), property('prop-old', { isActive: false }), property('prop-gone', { isActive: false })],
    stays,
    cleanings,
    isIncomplete: id => id === 'prop-e',
  });
  const row = id => week.rows.find(item => item.property.id === id);
  assert.deepEqual(week.rows.map(item => item.property.id), [P, 'prop-c', 'prop-d', 'prop-e', 'prop-old'], 'inactiva sin actividad no aparece; con limpieza sí');
  assert.deepEqual(row(P).days.map(day => day.night), ['occupied', 'occupied', 'occupied', 'occupied', 'none', 'none', 'none'], 'cancelada no ocupa');
  const wednesday = row(P).days[2];
  assert.equal(wednesday.arrivals.length, 1);
  assert.equal(wednesday.departures.length, 1);
  assert.deepEqual(wednesday.cleanings.map(cleaning => cleaning.id), ['early', 'late'], 'varias limpiezas ordenadas por hora, ninguna oculta');
  assert.equal(wednesday.departureWithoutCleaning, false);
  assert.equal(row(P).days[4].departureWithoutCleaning, true, 'salida del viernes sin limpieza registrada');
  assert.deepEqual(row('prop-c').days.map(day => day.night).slice(0, 3), ['none', 'blocked', 'blocked']);
  assert.ok(row('prop-d').days.every(day => day.night === 'none'), 'sin reservas: «sin reserva registrada», nunca disponible');
  assert.ok(row('prop-e').days.every(day => day.night === 'unknown'), 'fuente no leída: dato no disponible');
  assert.deepEqual(week.unplacedCleanings.map(cleaning => cleaning.id), ['orphan', 'foreign'], 'limpiezas sin propiedad conocida no se pierden');
  assert.equal(week.summary.arrivals, 1, 'la entrada del sábado anterior no cuenta en esta semana');
  assert.equal(week.summary.departures, 2);
  assert.equal(week.summary.turnovers, 1);
  assert.equal(week.summary.departuresWithoutCleaning, 1);
  assert.equal(week.summary.cleanings.pending, 5, 'incluye las limpiezas sin propiedad y la de la propiedad inactiva');
  assert.equal(week.summary.properties, 5);
});

await test('semana sin reservas ni limpiezas', () => {
  const week = buildWeek({ weekDays: weekDaysFrom('2026-10-19'), properties: [property(P)], stays: [], cleanings: [], isIncomplete: () => false });
  assert.equal(week.rows.length, 1);
  assert.ok(week.rows[0].days.every(day => day.night === 'none' && day.cleanings.length === 0 && !day.departureWithoutCleaning));
  assert.equal(week.rows[0].lanes, 1);
});

await test('búsqueda y agrupación', () => {
  const days = weekDaysFrom('2026-10-19');
  const week = buildWeek({
    weekDays: days,
    properties: [
      property('p10', { code: 'ORZ-10', name: 'Orzán 10' }),
      property('p2', { code: 'ORZ-2', name: 'Orzán 2' }),
      property('p3', { code: 'MAR-1', name: 'Marina', buildingId: null, buildingName: null, clientId: null, clientName: null }),
      property('p4', { code: 'ALT-1', name: 'Ático', buildingId: 'b0', buildingName: 'Altamira', clientId: 'c2', clientName: 'Bárbara' }),
    ],
    stays: [],
    cleanings: [toCleaning(task({ propiedad_id: 'p3', task_assignments: [{ cleaner_id: 'x', cleaner_name: 'Begoña Ruiz' }] }))],
    isIncomplete: () => false,
  });
  const byBuilding = groupRows(week.rows, 'building');
  assert.deepEqual(byBuilding.map(group => group.label), ['Altamira', 'Edificio Orzán', 'Sin edificio asignado']);
  assert.deepEqual(byBuilding[1].rows.map(row => row.property.code), ['ORZ-2', 'ORZ-10'], 'orden numérico natural');
  assert.deepEqual(groupRows(week.rows, 'client').map(group => group.label), ['Bárbara', 'Cliente Uno', 'Sin cliente asignado']);
  assert.equal(groupRows(week.rows, 'none')[0].rows.length, 4);
  assert.deepEqual(filterRows(week.rows, 'begona').map(row => row.property.id), ['p3'], 'busca por persona asignada sin acentos');
  assert.deepEqual(filterRows(week.rows, 'orz').map(row => row.property.id).sort(), ['p10', 'p2']);
  assert.deepEqual(filterRows(week.rows, 'barbara').map(row => row.property.id), ['p4']);
  assert.equal(filterRows(week.rows, '   ').length, 4);
  assert.deepEqual(groupRows([], 'none'), []);
});

// ---------------------------------------------------------------------------
// Lecturas con un cliente simulado (solo select)
// ---------------------------------------------------------------------------
const WRITE_METHODS = ['insert', 'update', 'upsert', 'delete', 'rpc'];
function fakeDb(tables, { fail = [] } = {}) {
  const calls = [];
  const matches = (row, [op, column, value]) => {
    const current = row[column];
    if (op === 'eq') return current === value;
    if (op === 'neq') return current !== value;
    if (op === 'gte') return current != null && String(current) >= value;
    if (op === 'lte') return current != null && String(current) <= value;
    return true;
  };
  return {
    calls,
    from(table) {
      const call = { table, ops: [] };
      calls.push(call);
      const builder = new Proxy({}, {
        get(_, key) {
          if (key === 'then') {
            const filters = call.ops.filter(([name]) => ['eq', 'neq', 'gte', 'lte'].includes(name));
            const range = call.ops.find(([name]) => name === 'range');
            let rows = (tables[table] || []).filter(row => filters.every(filter => matches(row, filter)));
            if (range) rows = rows.slice(range[1], range[2] + 1);
            const result = fail.includes(table) ? { data: null, error: { message: `fallo ${table}` } } : { data: rows, error: null };
            return (resolve, reject) => Promise.resolve(result).then(resolve, reject);
          }
          return (...args) => { call.ops.push([key, ...args]); return builder; };
        },
      });
      return builder;
    },
  };
}
const RANGE = { from: '2026-10-19', to: '2026-10-25' };
const reservationTables = () => ({
  client_reservations: [
    { id: 'c1', property_id: P, check_in_date: '2026-10-18', check_out_date: '2026-10-20', status: 'active', task_id: 't1' },
    { id: 'c-old', property_id: P, check_in_date: '2026-10-01', check_out_date: '2026-10-18', status: 'active', task_id: null },
    { id: 'c-next', property_id: P, check_in_date: '2026-10-26', check_out_date: '2026-10-28', status: 'active', task_id: null },
  ],
  avantio_reservations: [
    { id: 'a1', avantio_reservation_id: 'AV-1', property_id: P, arrival_date: '2026-10-18', departure_date: '2026-10-20', status: 'CONFIRMED', task_id: 't1', cancellation_date: null },
    { id: 'a2', avantio_reservation_id: 'AV-2', property_id: null, arrival_date: '2026-10-20', departure_date: '2026-10-22', status: 'CONFIRMED', task_id: null, cancellation_date: null },
    { id: 'a3', avantio_reservation_id: 'AV-3', property_id: null, arrival_date: '2026-10-20', departure_date: '2026-10-22', status: 'CANCELLED', task_id: null, cancellation_date: '2026-10-02' },
  ],
  hostaway_reservations: [],
  smoobu_reservations: [{ id: 's1', external_id: 'SM-1', property_id: null, check_in: '2026-10-22', check_out: '2026-10-24', status: 'confirmed' }],
  smoobu_property_mappings: [{ id: 'm1', property_id: 'prop-sm', is_active: true }],
  lh_reservations: [
    { id: 'l1', external_id: 'LH-1', room: 'Hab 1', rooms: ['Hab 1', 'Hab 2'], check_in: '2026-10-21', check_out: '2026-10-23', status: 'confirmed' },
    { id: 'l2', external_id: 'LH-2', room: 'Hab 9', rooms: [], check_in: '2026-10-21', check_out: '2026-10-23', status: 'confirmed' },
  ],
  lh_room_mapping: [
    { id: 'lm1', lh_room: 'hab 1', service_kind: 'checkout', propiedad_id: 'prop-lh1', is_active: true },
    { id: 'lm2', lh_room: 'Hab 2', service_kind: 'checkout', propiedad_id: 'prop-lh2', is_active: true },
    { id: 'lm3', lh_room: 'Hab 9', service_kind: 'stay', propiedad_id: 'prop-lh9', is_active: true },
  ],
  avirato_reservations: [
    { id: 'v1', external_id: 'AVI-1', space_name: '101', space_subtype_id: 7, check_in: '2026-10-19', check_out: '2026-10-21', status: 'Bloqueado', normalized_status: 'block' },
  ],
  avirato_room_mapping: [{ id: 'vm1', space_subtype_id: 7, service_kind: 'checkout', propiedad_id: 'prop-av', is_active: true }],
});

await test('lecturas de reservas: ventana de la semana, mapeos y sin escrituras', async () => {
  const db = fakeDb(reservationTables());
  const result = await reads.readWeekReservations(db, RANGE);
  for (const call of db.calls) {
    assert.ok(call.ops.some(([name]) => name === 'select'), `${call.table} usa select`);
    assert.ok(!call.ops.some(([name]) => WRITE_METHODS.includes(name)), `${call.table} sin escrituras`);
  }
  const portalCall = db.calls.find(call => call.table === 'client_reservations');
  assert.deepEqual(portalCall.ops.filter(([name]) => name === 'lte' || name === 'gte'), [['lte', 'check_in_date', '2026-10-25'], ['gte', 'check_out_date', '2026-10-19']]);
  assert.ok(!db.calls.some(call => call.ops.some(([name, columns]) => name === 'select' && /guest|email|phone/.test(columns))), 'no se piden datos de huéspedes');
  const ids = result.raws.map(item => `${item.source}:${item.sourceId}:${item.propertyId}`).sort();
  assert.deepEqual(ids, ['avantio:a1:prop-a', 'avirato:v1:prop-av', 'littleHotelier:l1:prop-lh1', 'littleHotelier:l1:prop-lh2', 'portal:c1:prop-a']);
  assert.deepEqual(result.unmapped, [{ source: 'avantio', count: 1 }, { source: 'smoobu', count: 1 }, { source: 'littleHotelier', count: 1 }], 'canceladas sin propiedad no cuentan; la habitación con solo mapeo de estancia tampoco se sitúa');
  assert.ok(result.coverage.every(item => item.state === 'ok'));
  const merged = mergeReservations(result.raws);
  assert.equal(merged.stays.filter(stay => stay.propertyId === P).length, 1, 'portal y Avantio con las mismas fechas: una estancia');
  assert.equal(merged.stays.find(stay => stay.propertyId === 'prop-av').kind, 'block');
});

await test('lecturas de reservas: una fuente caída marca solo las propiedades que puede afectar', async () => {
  const smoobuDown = await reads.readWeekReservations(fakeDb(reservationTables(), { fail: ['smoobu_reservations'] }), RANGE);
  const smoobuCoverage = smoobuDown.coverage.find(item => item.source === 'smoobu');
  assert.deepEqual(smoobuCoverage, { source: 'smoobu', state: 'error', affected: ['prop-sm'] });
  const checker = reads.incompleteChecker(smoobuDown.coverage);
  assert.equal(checker('prop-sm'), true);
  assert.equal(checker(P), false);
  const mappingDown = await reads.readWeekReservations(fakeDb(reservationTables(), { fail: ['lh_room_mapping'] }), RANGE);
  assert.deepEqual(mappingDown.coverage.find(item => item.source === 'littleHotelier'), { source: 'littleHotelier', state: 'error', affected: 'all' });
  assert.equal(reads.incompleteChecker(mappingDown.coverage)(P), true, 'sin mapeo no se sabe qué propiedades afecta');
  const portalDown = await reads.readWeekReservations(fakeDb(reservationTables(), { fail: ['client_reservations'] }), RANGE);
  assert.equal(reads.incompleteChecker(portalDown.coverage)('cualquiera'), true);
});

await test('lecturas paginadas: varias páginas y truncado señalado', async () => {
  const many = Array.from({ length: 2500 }, (_, index) => ({ id: `t${String(index).padStart(5, '0')}`, sede_id: 'sede-1', date: '2026-10-20', status: 'pending' }));
  const db = fakeDb({ tasks: many.concat([{ id: 'zz-cancel', sede_id: 'sede-1', date: '2026-10-20', status: 'cancelled' }, { id: 'zz-other', sede_id: 'sede-2', date: '2026-10-20', status: 'pending' }]) });
  const result = await reads.readWeekTasks(db, 'sede-1', RANGE);
  assert.equal(result.state, 'ok');
  assert.equal(result.rows.length, 2500);
  assert.equal(result.truncated, false);
  assert.equal(db.calls.length, 3, 'tres páginas de mil');
  const ops = db.calls[0].ops;
  assert.deepEqual(ops.filter(([name]) => ['eq', 'gte', 'lte', 'neq'].includes(name)), [['eq', 'sede_id', 'sede-1'], ['gte', 'date', '2026-10-19'], ['lte', 'date', '2026-10-25'], ['neq', 'status', 'cancelled']]);
  assert.ok(ops.some(([name, column]) => name === 'order' && column === 'id'), 'orden estable para paginar');
  const huge = Array.from({ length: reads.PAGE_SIZE * reads.MAX_PAGES }, (_, index) => ({ id: `h${String(index).padStart(6, '0')}`, sede_id: 'sede-1', date: '2026-10-20', status: 'pending' }));
  const truncated = await reads.readWeekTasks(fakeDb({ tasks: huge }), 'sede-1', RANGE);
  assert.equal(truncated.truncated, true);
  assert.deepEqual(await reads.readWeekTasks(fakeDb({}, { fail: ['tasks'] }), 'sede-1', RANGE), { state: 'error' });
});

await test('edificios: primer edificio activo por nombre', () => {
  const map = reads.buildingByProperty([
    { id: '1', property_id: P, property_group_id: 'g2', property_groups: { id: 'g2', name: 'Zeta', display_name: null, is_active: true } },
    { id: '2', property_id: P, property_group_id: 'g1', property_groups: { id: 'g1', name: 'x', display_name: 'Alfa', is_active: true } },
    { id: '3', property_id: Q, property_group_id: 'g3', property_groups: { id: 'g3', name: 'Inactivo', display_name: null, is_active: false } },
  ]);
  assert.deepEqual(map.get(P), { id: 'g1', name: 'Alfa' });
  assert.equal(map.has(Q), false);
});

// ---------------------------------------------------------------------------
// Navegación: página enlazada en ambos menús y protegida como el planificador
// ---------------------------------------------------------------------------
await test('navegación de gestión', () => {
  const app = readFileSync('src/App.tsx', 'utf8');
  assert.match(app, /const GlobalCalendar = React\.lazy\(\(\) => import\("\.\/pages\/GlobalCalendar"\)\)/);
  assert.match(app, /path="\/calendario-global" element=\{\s*<RoleProtectedRoute requiredModule="tasks" requiredAction="canEdit"><GlobalCalendar \/><\/RoleProtectedRoute>/);
  for (const file of ['src/components/dashboard/DashboardSidebar.tsx', 'src/components/dashboard/MobileDashboardSidebar.tsx']) {
    const source = readFileSync(file, 'utf8');
    assert.match(source, /title: 'Calendario global',\s*href: '\/calendario-global',\s*icon: CalendarRange,\s*permission: 'tasks-edit'/, file);
    assert.ok(source.indexOf("'/calendario-global'") > source.indexOf('const managementItems'), `${file}: dentro de gestión`);
  }
});

console.log(`globalCalendarModelTest: ${passed} pruebas correctas`);
