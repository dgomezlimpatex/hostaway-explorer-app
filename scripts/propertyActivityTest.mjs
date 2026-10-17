// Cronología de propiedad: modelo, consultas y combinación con datos sintéticos y un cliente simulado (sin red).
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const load = async entry => {
  const result = await build({ entryPoints: [entry], bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent' });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
};
const model = await load('src/features/property-activity/propertyActivityModel.ts');
const { fetchActivitySource, sourceAllowed } = await load('src/features/property-activity/propertyActivitySources.ts');
const { combineActivity } = await load('src/features/property-activity/propertyActivityState.ts');

const P = 'prop-a';
const OTHER = 'prop-b'; // Mismo nombre visible que P: solo cuenta el identificador.
const SEDE = 'sede-1';
const window0 = { index: 0, from: '2026-09-18', to: '2026-10-17' };
const fullAccess = { tasks: true, reports: true, supervision: true, inventory: true };

// Cliente simulado: registra la cadena de cada consulta y devuelve filas por tabla.
function fakeDb(tables, { fail = [] } = {}) {
  const calls = [];
  return {
    calls,
    from(table) {
      const call = { table, ops: [] };
      calls.push(call);
      const builder = new Proxy({}, {
        get(_, key) {
          if (key === 'then') {
            const result = fail.includes(table) ? { data: null, error: { message: `fallo ${table}` } } : { data: tables[table] || [], error: null };
            return (resolve, reject) => Promise.resolve(result).then(resolve, reject);
          }
          return (...args) => { call.ops.push([key, ...args]); return builder; };
        },
      });
      return builder;
    },
  };
}
const op = (call, name) => call.ops.filter(item => item[0] === name).map(item => item.slice(1));

// ---------------------------------------------------------------- Tramos y periodos
{
  const w30 = model.activityWindows('2026-10-17', '30');
  assert.deepEqual(w30, [{ index: 0, from: '2026-09-18', to: '2026-10-17' }]);
  const w90 = model.activityWindows('2026-10-17', '90');
  assert.equal(w90.length, 3);
  for (let i = 1; i < w90.length; i += 1) {
    const prevFrom = new Date(`${w90[i - 1].from}T12:00:00Z`);
    prevFrom.setUTCDate(prevFrom.getUTCDate() - 1);
    assert.equal(w90[i].to, prevFrom.toISOString().slice(0, 10), 'Tramos contiguos sin solape ni hueco');
  }
  assert.equal(w90[2].from, '2026-07-20', 'El último tramo empieza exactamente en el inicio del periodo de 90 días');
  const w365 = model.activityWindows('2026-10-17', '365');
  assert.equal(w365.length, 13);
  assert.equal(w365.at(-1).from, '2025-10-18');
  assert.equal(model.parsePeriod('9999'), '30');
  assert.equal(model.parseActivityType('incidents'), 'incidents');
  assert.equal(model.parseActivityType('tokens'), 'all');
}

// ---------------------------------------------------------------- Fechas Madrid
{
  assert.deepEqual(model.madridMoment('2026-10-03T22:30:00Z'), { day: '2026-10-04', time: '00:30' }, 'Pasada la medianoche de Madrid cuenta como el día siguiente');
  assert.deepEqual(model.madridMoment('2026-10-25T01:30:00Z'), { day: '2026-10-25', time: '02:30' }, 'Tras el cambio de hora de octubre (UTC+1)');
  assert.deepEqual(model.madridMoment('2026-10-25T00:30:00Z'), { day: '2026-10-25', time: '02:30' }, 'Antes del cambio de hora (UTC+2)');
  assert.equal(model.madridMoment(null), null);
  assert.equal(model.madridMoment('no-es-fecha'), null);
}

// ---------------------------------------------------------------- Propiedad con actividad de varios módulos
const tables = {
  tasks: [
    { id: 't1', propiedad_id: P, property: 'Ático Centro', date: '2026-10-10', start_time: '11:00:00', end_time: '13:00:00', status: 'completed', type: 'Salida', cleaner: 'Ana', task_assignments: [{ cleaner_name: 'Ana' }, { cleaner_name: 'Luis' }],
      task_reports: [{ id: 'r1', start_time: '2026-10-10T09:05:00Z', end_time: '2026-10-11T07:40:00Z', overall_status: 'completed', cleaner: { name: 'Ana' } }] },
    { id: 't2', propiedad_id: P, property: 'Ático Centro', date: '2026-10-12', start_time: null, end_time: null, status: 'completed', type: null, cleaner: null, task_assignments: [], task_reports: [] },
    // Respuesta inesperada de otra propiedad con el mismo nombre: no debe entrar.
    { id: 't9', propiedad_id: OTHER, property: 'Ático Centro', date: '2026-10-10', start_time: '10:00:00', end_time: null, status: 'pending', type: null, cleaner: null, task_assignments: [], task_reports: [] },
  ],
  cleaning_incidents: [
    { id: 'i1', property_id: P, task_id: 't1', created_at: '2026-10-10T10:15:00Z', status: 'open', description: 'Mancha   en el sofá\n del salón', category: { label: 'Daños' }, cleaner: { name: 'Ana' } },
  ],
  cleaning_incident_events: [
    { id: 'e1', incident_id: 'i1', event_type: 'status_change', from_status: 'open', to_status: 'resolved', actor_name: 'Marta', created_at: '2026-10-11T08:00:00Z', incident: { property_id: P, description: 'Mancha en el sofá' } },
    { id: 'e2', incident_id: 'i1', event_type: 'status_change', from_status: 'resolved', to_status: 'open', actor_name: 'Marta', created_at: '2026-10-11T09:00:00Z', incident: { property_id: P, description: 'Mancha en el sofá' } },
    { id: 'e3', incident_id: 'i1', event_type: 'limpatex_comment', from_status: null, to_status: null, actor_name: 'Marta', created_at: '2026-10-11T09:10:00Z', incident: { property_id: P, description: 'x' } },
  ],
  supervision_reviews: [
    { id: 's1', property_id: P, task_id: 't1', review_type: 'full', state: 'returned_for_rework', result: 'incorrect', rework_reason: 'Polvo en estanterías', started_at: '2026-10-10T12:00:00Z', completed_at: '2026-10-10T12:20:00Z', created_at: '2026-10-10T12:00:00Z', route: { route_date: '2026-10-10' } },
    { id: 's2', property_id: P, task_id: null, review_type: 'quick', state: 'reviewed', result: 'correct', rework_reason: null, started_at: null, completed_at: null, created_at: '2026-10-05T07:00:00Z', route: { route_date: '2026-10-05' } },
  ],
  laundry_bag_preparations: [
    { task_id: 't1', status: 'prepared', prepared_at: '2026-10-09T16:00:30Z', prepared_by_name: 'Pepe', issue_at: null, issue_by_name: null, issue_reason: null, undone_at: '2026-10-09T15:30:00Z', undone_by_name: 'Pepe', undone_reason: 'Faltaban fundas', cancelled_at: null, cancelled_by_name: null, task: { id: 't1', date: '2026-10-10', propiedad_id: P } },
  ],
  laundry_delivery_tracking: [
    { id: 'd1', task_id: 't1', prepared_at: '2026-10-09T16:01:00Z', prepared_by_name: 'Pepe', delivered_at: '2026-10-10T08:00:00Z', delivered_by_name: 'Rosa', collected_at: null, collected_by_name: null, task: { id: 't1', date: '2026-10-10', propiedad_id: P } },
    // Fuera del tramo: limpieza de días anteriores, entrega dentro del margen pero antes del tramo.
    { id: 'd2', task_id: 't0', prepared_at: null, prepared_by_name: null, delivered_at: '2026-09-10T08:00:00Z', delivered_by_name: 'Rosa', collected_at: null, collected_by_name: null, task: { id: 't0', date: '2026-09-11', propiedad_id: P } },
  ],
  stock_movements: [
    { id: 'm1', property_id: P, task_id: 't1', movement_type: 'consumo_automatico', quantity: 4, reason: 'Consumo de la limpieza', created_at: '2026-10-10T13:00:00Z', product_id: 'sab', warehouse_id: 'w1', product: { name: 'Sábanas 150', unit_of_measure: 'unidades' }, warehouse: { name: 'Trastero Orzán' } },
    { id: 'm2', property_id: null, task_id: null, movement_type: 'ajuste', quantity: 10, reason: 'Recuento global', created_at: '2026-10-10T13:00:00Z', product_id: 'sab', warehouse_id: 'w1', product: { name: 'Sábanas 150', unit_of_measure: 'unidades' }, warehouse: { name: 'Trastero Orzán' } },
  ],
};
const sources = ['cleanings', 'incidents', 'supervision', 'laundry', 'inventory'];
const db = fakeDb(tables);
const controller = new AbortController();
const results = {};
for (const source of sources) results[source] = await fetchActivitySource(db, source, { propertyId: P, sedeId: SEDE, window: window0, access: fullAccess, signal: controller.signal });

// Filtros por identificador y sede en todas las consultas.
{
  const byTable = Object.fromEntries(db.calls.map(call => [call.table, call]));
  assert.deepEqual(op(byTable.tasks, 'eq'), [['propiedad_id', P], ['sede_id', SEDE]]);
  assert.deepEqual(op(byTable.tasks, 'gte'), [['date', '2026-09-18']]);
  assert.deepEqual(op(byTable.tasks, 'lte'), [['date', '2026-10-17']]);
  assert.deepEqual(op(byTable.cleaning_incidents, 'eq'), [['property_id', P], ['sede_id', SEDE]]);
  assert.deepEqual(op(byTable.cleaning_incident_events, 'eq'), [['incident.property_id', P], ['incident.sede_id', SEDE]]);
  assert.deepEqual(op(byTable.supervision_reviews, 'eq'), [['property_id', P], ['route.sede_id', SEDE]]);
  assert.deepEqual(op(byTable.laundry_bag_preparations, 'eq'), [['task.propiedad_id', P], ['task.sede_id', SEDE]]);
  assert.deepEqual(op(byTable.laundry_delivery_tracking, 'gte'), [['task.date', '2026-09-04']], 'Margen de 14 días de servicio para lavandería');
  assert.deepEqual(op(byTable.stock_movements, 'eq'), [['property_id', P], ['product.sede_id', SEDE]]);
  assert.deepEqual(op(byTable.stock_movements, 'gte'), [['created_at', '2026-09-17T22:00:00.000Z']], 'Inicio del tramo en medianoche de Madrid (UTC+2)');
  assert.deepEqual(op(byTable.stock_movements, 'lt'), [['created_at', '2026-10-17T22:00:00.000Z']]);
  for (const call of db.calls) {
    assert.deepEqual(op(call, 'limit'), [[201]], `${call.table}: límite + 1 para detectar truncado`);
    assert.equal(op(call, 'abortSignal')[0][0], controller.signal, `${call.table}: la consulta se cancela al cambiar de propiedad o sede`);
    assert.ok(!call.ops.some(([name]) => ['insert', 'upsert', 'rpc'].includes(name) || name === 'del' + 'ete' || name === 'up' + 'date'), `${call.table}: solo lectura`);
    assert.ok(!JSON.stringify(call.ops).includes('token'), `${call.table}: no se piden tokens públicos`);
  }
  assert.ok(!db.calls.some(call => call.table === 'laundry_share_links'), 'No se consultan enlaces públicos de lavandería');
  const orFilter = op(byTable.supervision_reviews, 'or')[0][0];
  assert.match(orFilter, /completed_at\.is\.null/);
}

// Limpieza + reporte: una sola entrada, fecha de servicio y hora prevista, finalización registrada otro día.
{
  const cleanings = results.cleanings.events;
  assert.deepEqual(cleanings.map(event => event.id), ['cleaning:t1', 'cleaning:t2'], 'La tarea de otra propiedad con el mismo nombre no aparece');
  const t1 = cleanings[0];
  assert.equal(t1.day, '2026-10-10');
  assert.equal(t1.time, '11:00');
  assert.equal(t1.timeKind, 'planned', 'La hora de la tarea es prevista, no un hecho registrado');
  const line = label => t1.lines.find(item => item.label === label)?.value;
  assert.equal(line('Asignación actual'), 'Ana, Luis', 'Se presenta como asignación actual, sin inventar cuándo se asignó');
  assert.equal(line('Inicio registrado'), '11:05');
  assert.equal(line('Finalización registrada otro día'), '11/10/2026 · 09:40', 'Distingue servicio y momento de registro');
  assert.equal(t1.actor, 'Reporte de Ana');
  assert.deepEqual(t1.detail, { kind: 'task', taskId: 't1', date: '2026-10-10', label: 'Abrir limpieza' });
  const t2 = cleanings[1];
  assert.equal(t2.time, null, 'Solo fecha: no se inventa una hora');
  assert.equal(t2.timeKind, null);
  assert.match(t2.lines.find(item => item.label === 'Reporte').value, /no consta la hora de finalización/);
}

// Incidencias: creación + cambios de estado, incluida la reapertura; los comentarios no se listan.
{
  const ids = results.incidents.events.map(event => event.id).sort();
  assert.deepEqual(ids, ['incident:i1:created', 'incident:i1:event:e1', 'incident:i1:event:e2']);
  const created = results.incidents.events.find(event => event.id === 'incident:i1:created');
  assert.equal(created.summary, 'Mancha en el sofá del salón', 'Resumen compacto del texto');
  assert.equal(created.status.label, 'Estado actual: Abierta', 'El estado actual no se presenta como el estado al crearla');
  const reopened = results.incidents.events.find(event => event.id === 'incident:i1:event:e2');
  assert.equal(reopened.lines[0].value, 'Resuelta → Abierta', 'La corrección conserva su significado');
  assert.equal(reopened.actor, 'Marta');
}

// Supervisión: devuelta para repaso; sin completed_at se usa la hora de registro y se indica.
{
  const [s1, s2] = model.sortActivity(results.supervision.events);
  assert.equal(s1.status.label, 'Devuelta para repaso');
  assert.equal(s1.time, '14:20');
  assert.ok(s1.lines.some(item => item.value === 'Polvo en estanterías'));
  assert.equal(s2.day, '2026-10-05');
  assert.ok(s2.lines.some(item => /sin hora de finalización/.test(item.value)));
  assert.equal(s2.detail, undefined, 'Sin tarea asociada no se ofrece un enlace inventado');
}

// Lavandería: deshacer conservado, preparación duplicada entre sistemas fusionada, fuera de tramo excluido.
{
  const ids = results.laundry.events.map(event => event.id).sort();
  assert.deepEqual(ids, ['laundry:bag:t1:prepared', 'laundry:bag:t1:undone', 'laundry:tracking:d1:delivered']);
  const prepared = results.laundry.events.find(event => event.id === 'laundry:bag:t1:prepared');
  assert.ok(prepared.lines.some(item => item.value === 'También consta en el reparto clásico'));
  assert.ok(prepared.lines.some(item => item.label === 'Limpieza del' && item.value === '10/10/2026'), 'Paso de lavandería en otro día que el servicio');
  const undone = results.laundry.events.find(event => event.id === 'laundry:bag:t1:undone');
  assert.equal(undone.title, 'Preparación deshecha');
  assert.equal(undone.summary, 'Faltaban fundas');
}

// Inventario: solo el movimiento atribuido a la propiedad.
{
  assert.deepEqual(results.inventory.events.map(event => event.id), ['inventory:m1']);
  assert.deepEqual(results.inventory.events[0].detail, { kind: 'inventory', productId: 'sab', warehouseId: 'w1', label: 'Abrir en el historial de inventario' });
}

// Combinación, orden estable y agrupación por día.
{
  const all = Object.values(results).flatMap(result => result.events);
  const shuffled = [...all].reverse();
  assert.deepEqual(model.sortActivity(all).map(event => event.id), model.sortActivity(shuffled).map(event => event.id), 'Orden independiente del orden de llegada');
  const groups = model.groupByDay(all);
  assert.deepEqual(groups.map(group => group.day), ['2026-10-12', '2026-10-11', '2026-10-10', '2026-10-09', '2026-10-05'], 'Recientes primero');
  const day10 = groups.find(group => group.day === '2026-10-10').events;
  assert.equal(day10[0].time, '15:00', 'Dentro del día, de la hora más tardía a la más temprana');
  assert.equal(day10.at(-1).id, 'laundry:tracking:d1:delivered');
  const noTime = model.groupByDay([{ ...all[0], id: 'x', day: '2026-10-12', time: null }, { ...all[0], id: 'y', day: '2026-10-12', time: '08:00' }])[0].events.map(event => event.id);
  assert.deepEqual(noTime, ['y', 'x'], 'Eventos sin hora al final de su día');
}

// ---------------------------------------------------------------- Propiedad sin actividad
{
  const empty = fakeDb({});
  const settled = [];
  for (const source of sources) settled.push({ window: window0, source, status: 'success', data: await fetchActivitySource(empty, source, { propertyId: 'vacia', sedeId: SEDE, window: window0, access: fullAccess }) });
  const state = combineActivity({ windows: [window0], sources, restricted: [], results: settled });
  assert.equal(state.eventCount, 0);
  assert.equal(state.confirmedEmpty, true, 'Sin actividad confirmada solo si todas las fuentes respondieron');
}

// ---------------------------------------------------------------- Error parcial, carga progresiva, truncado y duplicados entre tramos
{
  const window1 = { index: 1, from: '2026-08-19', to: '2026-09-17' };
  const ok = (window, source, events, truncated = false) => ({ window, source, status: 'success', data: { events, truncated } });
  const inc = results.incidents.events;
  const partial = combineActivity({ windows: [window0], sources, restricted: [], results: [
    ok(window0, 'cleanings', results.cleanings.events), { window: window0, source: 'incidents', status: 'error', error: new Error('x') },
    ok(window0, 'supervision', []), ok(window0, 'laundry', []), ok(window0, 'inventory', []),
  ] });
  assert.equal(partial.eventCount, 2, 'Un fallo parcial no oculta el resto');
  assert.deepEqual(partial.failures, [{ source: 'incidents', from: window0.from, to: window0.to }]);
  assert.equal(partial.confirmedEmpty, false);

  const failedAll = combineActivity({ windows: [window0], sources: ['incidents'], restricted: [], results: [{ window: window0, source: 'incidents', status: 'error' }] });
  assert.equal(failedAll.eventCount, 0);
  assert.equal(failedAll.confirmedEmpty, false, 'Un error no se presenta como ausencia de actividad');

  const loading = combineActivity({ windows: [window0, window1], sources: ['cleanings', 'incidents'], restricted: [], results: [
    ok(window0, 'cleanings', results.cleanings.events), { window: window0, source: 'incidents', status: 'pending' },
    ok(window1, 'cleanings', [{ ...results.cleanings.events[0], id: 'cleaning:old', day: '2026-09-01' }]), ok(window1, 'incidents', []),
  ] });
  assert.equal(loading.settledWindows, 0, 'Un tramo con fuentes cargando no se muestra a medias');
  assert.deepEqual(loading.pendingSources, ['incidents']);
  assert.equal(loading.eventCount, 0, 'El tramo anterior no se adelanta dejando un hueco');

  const loaded = combineActivity({ windows: [window0, window1], sources: ['cleanings', 'incidents'], restricted: [], results: [
    ok(window0, 'cleanings', results.cleanings.events), ok(window0, 'incidents', inc),
    ok(window1, 'cleanings', [results.cleanings.events[0], { ...results.cleanings.events[0], id: 'cleaning:old', day: '2026-09-01' }], true), { window: window1, source: 'incidents', status: 'pending' },
  ] });
  assert.equal(loaded.settledWindows, 1);
  assert.deepEqual(loaded.loadingWindow, window1);
  assert.equal(loaded.shownFrom, window0.from);

  const both = combineActivity({ windows: [window0, window1], sources: ['cleanings'], restricted: [], results: [
    ok(window0, 'cleanings', results.cleanings.events), ok(window1, 'cleanings', [results.cleanings.events[0], { ...results.cleanings.events[0], id: 'cleaning:old', day: '2026-09-01' }], true),
  ] });
  assert.equal(both.eventCount, 3, 'Un registro repetido entre tramos solo aparece una vez');
  assert.deepEqual(both.truncated, [{ source: 'cleanings', from: window1.from, to: window1.to }]);
  assert.equal(both.shownFrom, window1.from);

  const many = Array.from({ length: 205 }, (_, i) => ({ ...tables.stock_movements[0], id: `m${String(i).padStart(3, '0')}` }));
  const capped = await fetchActivitySource(fakeDb({ stock_movements: many }), 'inventory', { propertyId: P, sedeId: SEDE, window: window0, access: fullAccess });
  assert.equal(capped.events.length, 200);
  assert.equal(capped.truncated, true);

  assert.deepEqual(model.withinWindow([...results.cleanings.events, results.cleanings.events[0]], window0).map(event => event.id), ['cleaning:t1', 'cleaning:t2']);
}

// ---------------------------------------------------------------- Errores de fuente
{
  await assert.rejects(fetchActivitySource(fakeDb(tables, { fail: ['cleaning_incident_events'] }), 'incidents', { propertyId: P, sedeId: SEDE, window: window0, access: fullAccess }), { message: /fallo cleaning_incident_events/ });
}

// ---------------------------------------------------------------- Acceso restringido
{
  const cleanerLike = { tasks: true, reports: false, supervision: false, inventory: false };
  assert.equal(sourceAllowed('incidents', cleanerLike), false);
  assert.equal(sourceAllowed('laundry', cleanerLike), false);
  assert.equal(sourceAllowed('inventory', cleanerLike), false);
  await assert.rejects(fetchActivitySource(fakeDb(tables), 'inventory', { propertyId: P, sedeId: SEDE, window: window0, access: cleanerLike }), /Sin permiso/);
  const noReports = fakeDb(tables);
  const limited = await fetchActivitySource(noReports, 'cleanings', { propertyId: P, sedeId: SEDE, window: window0, access: cleanerLike });
  assert.ok(!op(noReports.calls[0], 'select')[0][0].includes('task_reports'), 'Sin permiso de reportes no se piden reportes');
  assert.equal(limited.events[0].lines.find(item => item.label === 'Reporte').value, 'Sin permiso para consultar reportes');
  assert.equal(limited.events[0].actor, undefined, 'Sin permiso no se muestra la autora del reporte');
  const restricted = combineActivity({ windows: [window0], sources: ['inventory'], restricted: ['inventory'], results: [] });
  assert.equal(restricted.nothingConsultable, true);
  assert.equal(restricted.confirmedEmpty, false, 'Sin permiso no se afirma que no haya actividad');
}

// ---------------------------------------------------------------- Enlaces al registro original
{
  const all = () => true;
  assert.equal(model.activityDetailHref({ kind: 'task', taskId: 't1', date: '2026-10-10', label: '' }, all), '/calendar?date=2026-10-10&task=t1');
  assert.equal(model.activityDetailHref({ kind: 'incident', incidentId: 'i1', label: '' }, all), '/cleaning-reports?incidencia=i1');
  assert.equal(model.activityDetailHref({ kind: 'inventory', productId: 'p 1', warehouseId: 'w&1', label: '' }, all), '/inventory/movements?product=p+1&warehouse=w%261');
  assert.equal(model.activityDetailHref({ kind: 'incident', incidentId: 'i1', label: '' }, module => module !== 'reports'), null, 'Sin acceso a la pantalla no hay enlace');
  assert.equal(model.activityDetailHref({ kind: 'task', taskId: 't1', date: '2026-10-10', label: '' }, module => module !== 'calendar'), null);
  assert.deepEqual(model.ACTIVITY_PARAMS, { period: 'actividad_periodo', type: 'actividad_tipo', windows: 'actividad_tramos' });
}

console.log('propertyActivityTest: OK');
