import assert from 'node:assert/strict';
import { isPropertyActive } from '../src/components/properties/propertyPresentation';
import type { Property } from '../src/types/property';
import { readStaffingPage } from '../src/features/staffing/readClient';
import { readStaffingDataset, timeMinutes, type StaffingRow, type StaffingReadPage, type StaffingReadSpec } from '../src/features/staffing/data';
const property = { id: 'p', nombre: 'Centro', sede_id: 's', is_active: true, duracion_servicio: 120, check_out_predeterminado: '10:00', check_in_predeterminado: '17:00' };
function fixture(tables: Record<string, StaffingRow[]>, specs: StaffingReadSpec[] = []): StaffingReadPage {
  return async spec => {
    await readStaffingPage(spec); // Real whitelist/column/page validation with offline client.
    specs.push(spec);
    assert.ok(!spec.table.includes('hostaway'), 'Hostaway forbidden');
    assert.ok(!spec.columns.includes('*'), 'explicit minimal fields');
    assert.ok(spec.equals?.sede_id === 's' || spec.within?.ids.length, `unscoped ${spec.table}`);
    const rows = (tables[spec.table] || []).filter(row =>
      Object.entries(spec.equals || {}).every(([key, value]) => row[key] === value) &&
      (!spec.within || spec.within.ids.includes(String(row[spec.within.column]))) &&
      (!spec.since || String(row[spec.since.column]) >= spec.since.value) &&
      (!spec.until || String(row[spec.until.column]) <= spec.until.value));
    return rows.sort((a, b) => String(a.id).localeCompare(String(b.id))).slice(spec.from, spec.to + 1)
      .map(row => Object.fromEntries(spec.columns.split(',').map(key => [key, row[key]])));
  };
}
async function inheritedClientActivity() {
  const specs: StaffingReadSpec[] = [];
  const properties = [
    { ...property, id: 'inherit-off', is_active: null, cliente_id: 'off' },
    { ...property, id: 'explicit-on', is_active: true, cliente_id: 'off' },
    { ...property, id: 'explicit-off', is_active: false, cliente_id: 'on' },
    { ...property, id: 'inherit-on', is_active: null, cliente_id: 'on' },
    { ...property, id: 'default', is_active: null },
  ];
  const result = await readStaffingDataset(fixture({ properties, clients: [{ id: 'off', sede_id: 's', is_active: false }, { id: 'on', sede_id: 's', is_active: true }] }, specs), 's', '2026-09-14', '2026-09-20');
  assert.deepEqual(result.centers.map(c => c.id).sort(), ['default', 'explicit-on', 'inherit-on'], 'NULL inherits client, explicit property state wins');
  const reads = specs.filter(s => s.table === 'clients');
  assert.equal(reads.length, 1);
  assert.equal(reads[0].columns, 'id,sede_id,is_active');
  assert.deepEqual(reads[0].equals, { sede_id: 's' });
  assert.deepEqual(reads[0].within?.ids.sort(), ['off', 'on']);
  const unreadable = await readStaffingDataset(async spec => { if (spec.table === 'clients') throw Error('denied'); return fixture({ properties })(spec); }, 's', '2026-09-14', '2026-09-20');
  assert.ok(unreadable.issues.some(i => i.code === 'client-state-unavailable'));
  assert.ok(!unreadable.centers.some(c => c.id === 'inherit-off'), 'unknown inherited state withheld, not silently active');
  assert.ok(unreadable.centers.some(c => c.id === 'explicit-on'));
  for (const state of [true, false, null, undefined]) for (const clientState of [true, false, null, undefined]) {
    const specs: StaffingReadSpec[] = [];
    const result = await readStaffingDataset(fixture({ properties: [{ ...property, is_active: state, cliente_id: 'client' }], clients: [{ id: 'client', sede_id: 's', is_active: clientState }] }, specs), 's', '2026-09-14', '2026-09-20');
    assert.equal(result.centers.some(center => center.id === 'p'), isPropertyActive({ isActive: state, clientIsActive: clientState } as Property), `directory parity property=${state}, client=${clientState}`);
    if (state != null) assert.ok(!specs.some(spec => spec.table === 'clients'), 'explicit override needs no client read');
  }
  const foreign = await readStaffingDataset(fixture({ properties: [{ ...property, is_active: null, cliente_id: 'foreign' }], clients: [{ id: 'foreign', sede_id: 'other', is_active: true }] }), 's', '2026-09-14', '2026-09-20');
  assert.equal(foreign.centers.length, 0);
  assert.ok(foreign.issues.some(issue => issue.code === 'client-state-unavailable'));
  await assert.rejects(() => readStaffingPage({ table: 'clients', columns: 'id,sede_id,is_active', within: { column: 'id', ids: ['client'] }, from: 0, to: 10 }), /requieren sede/);
  await assert.rejects(() => readStaffingPage({ table: 'clients', columns: 'id,sede_id,is_active', equals: { sede_id: 's' }, from: 0, to: 10 }), /sin ámbito/);
  console.log('PASS inherited client activity: 16 directory parity cases, minimum sede+IDs read, foreign/missing/error state explicit');
}
await inheritedClientActivity();
async function hotelExcludedProperties() {
  const failures: string[] = [];
  let cases = 0;
  for (const provider of ['lh', 'avirato'] as const) {
    const roomColumn = provider === 'lh' ? 'lh_room' : 'space_subtype_id';
    for (const state of ['explicit-false', 'inherited-false', 'missing-client', 'denied-client']) {
      for (const excludedFirst of [true, false]) {
        cases++;
        const label = `${provider}/${state}/${excludedFirst ? 'excluded-first' : 'active-first'}`;
        const tables: Record<string, StaffingRow[]> = {
          properties: [
            { ...property, id: 'off', is_active: state === 'explicit-false' ? false : null, cliente_id: 'client' },
            { ...property, id: 'on', cliente_id: 'client', planning_required_cleaners: 1 },
          ],
          clients: state === 'missing-client' ? [] : [{ id: 'client', sede_id: 's', is_active: state === 'explicit-false' }],
          [`${provider}_reservations`]: ['off', 'on'].map(room => ({ id: room, sede_id: 's', room, rooms: [room], space_subtype_id: room, check_in: '2026-09-13', check_out: '2026-09-15', status: 'confirmed', normalized_status: 'confirmed' })),
          [`${provider}_room_mapping`]: ['off', 'on'].flatMap(room => ['stay', 'checkout'].map(kind => ({ id: `${room}-${kind}`, sede_id: 's', [roomColumn]: room, service_kind: kind, propiedad_id: room, is_active: true, default_start_time: '11:00', default_duration_min: kind === 'stay' ? 25 : 60 }))),
        };
        const read = fixture(tables);
        const result = await readStaffingDataset(async spec => {
          if (state === 'denied-client' && spec.table === 'clients') throw Error('denied');
          const rows = await read(spec);
          return spec.table === `${provider}_reservations` && !excludedFirst ? rows.reverse() : rows;
        }, 's', '2026-09-14', '2026-09-20');
        const baseline = await readStaffingDataset(fixture({ ...tables, properties: [tables.properties[1]], [`${provider}_reservations`]: [tables[`${provider}_reservations`][1]] }), 's', '2026-09-14', '2026-09-20');
        try {
          assert.deepEqual(result.services, baseline.services, `${label}: active stays/checkouts and exact effort/windows unchanged`);
          assert.equal(result.services.length, 2);
          assert.deepEqual(result.centers.map(center => center.id), ['on']);
          assert.ok(!result.issues.some(issue => issue.code === 'source-unavailable' && !issue.message.includes('clients')), `${label}: no false provider failure`);
          assert.ok(!result.issues.some(issue => issue.code === 'hotel-mapping-conflict'), 'known excluded mapping is not missing mapping');
          assert.equal(result.issues.some(issue => issue.code === 'client-state-unavailable'), state.endsWith('client'), 'unresolved eligibility remains explicitly partial');
          assert.equal(result.issues.some(issue => issue.code === 'source-unavailable'), state === 'denied-client', 'real client read failure must remain visible');
          assert.equal(result.issues.some(issue => issue.code === 'inactive-properties-excluded'), !state.endsWith('client'), 'unknown client is not certified inactive');
          const coverage = result.providerCoverage?.find(row => row.provider === provider);
          assert.equal(coverage?.status, 'limited', 'successful provider read is not unknown');
          assert.equal(coverage?.reservations30, 2, 'provider inventory still records read reservations');
          console.log(`PASS R1 ${label}`);
        } catch (error) { failures.push(`${label}: ${String(error)}`); }
      }
    }
  }
  assert.deepEqual(failures, [], `R1 failures across ${cases} cases`);
  console.log(`PASS R1 ${cases} cases: excluded eligibility cannot abort hotel demand`);
}
async function hotelExpansion() {
  const specs: StaffingReadSpec[] = [];
  const result = await readStaffingDataset(fixture({
    properties: [property],
    lh_reservations: [{ id: 'lh', sede_id: 's', check_in: '2026-09-13', check_out: '2026-09-16', rooms: ['A', 'B', 'A'], status: 'confirmed' }],
    lh_room_mapping: ['A', 'B'].flatMap(room => ['stay', 'checkout'].map(kind => ({ id: `${room}-${kind}`, sede_id: 's', lh_room: room, service_kind: kind, propiedad_id: 'p', is_active: true, default_start_time: '11:00', default_duration_min: kind === 'stay' ? 25 : 65 }))),
    avirato_reservations: [{ id: 'av', sede_id: 's', check_in: '2026-09-13', check_out: '2026-09-15', space_subtype_id: 'X', normalized_status: 'confirmed', status: 'confirmed' }],
    avirato_room_mapping: ['stay', 'checkout'].map(kind => ({ id: kind, sede_id: 's', space_subtype_id: 'X', service_kind: kind, propiedad_id: 'p', is_active: true, default_start_time: '12:00', default_duration_min: kind === 'stay' ? 20 : 70 })),
  }, specs), 's', '2026-09-14', '2026-09-20');
  assert.equal(result.services.length, 8, 'expand every room, interior stay and checkout even without links');
  assert.equal(new Set(result.services.map(s => s.id)).size, 8);
  assert.equal(result.services.filter(s => s.kind === 'stay').length, 5);
  assert.deepEqual(result.services.map(s => s.personMinutes).sort((a, b) => a - b), [20, 25, 25, 25, 25, 65, 65, 70], 'mapping minutes are total, service-kind-specific, no property substitution or second buffer');
  assert.ok(specs.filter(s => s.table.endsWith('_reservation_tasks')).every(s => s.within?.column === 'reservation_id'));
  assert.ok(result.issues.some(i => i.code === 'required-workers-assumption'));
  console.log('PASS hotel multiroom stays/checkouts, scoped mappings and total minutes');
}
async function hotelLinks() {
  const tasks = [
    { id: 'moved', sede_id: 's', propiedad_id: 'p', date: '2026-09-18', status: 'pending', duracion: 50 },
    { id: 'outside', sede_id: 's', propiedad_id: 'p', date: '2027-01-01', status: 'pending', duracion: 50 },
  ];
  const specs: StaffingReadSpec[] = [];
  const result = await readStaffingDataset(fixture({ properties: [property], tasks,
    lh_reservations: ['moved', 'outside', 'missing'].map(id => ({ id, sede_id: 's', rooms: ['A'], check_in: '2026-09-13', check_out: '2026-09-14', status: 'confirmed' })),
    lh_room_mapping: [{ id: 'map', sede_id: 's', lh_room: 'A', service_kind: 'checkout', propiedad_id: 'p', is_active: true, default_start_time: '11:00', default_duration_min: 65 }],
    lh_reservation_tasks: ['moved', 'outside', 'missing'].map(id => ({ id, reservation_id: id, task_id: id, lh_room: 'A', service_kind: 'checkout', task_date: '2026-09-14', status: 'active' })),
  }, specs), 's', '2026-09-14', '2026-09-20');
  assert.equal(result.services.length, 1, 'do not regenerate unresolved or moved linked occurrences');
  assert.equal(result.services[0].id, 'task:moved');
  assert.equal(result.services[0].personMinutes, 65, 'linked hotel task retains service-kind effort');
  assert.equal(result.services[0].kind, 'checkout');
  assert.equal(result.services[0].startMinute, 660, 'linked hotel task uses the service-kind mapping reference when no task start is stored');
  assert.ok(result.issues.some(i => i.code === 'reservation-link-conflict'));
  assert.ok(result.issues.some(i => i.code === 'linked-task-outside-range'));
  assert.ok(result.issues.some(i => i.code === 'linked-task-unavailable'));
  assert.ok(specs.some(s => s.table === 'tasks' && s.within?.ids.includes('outside') && s.equals?.sede_id === 's'));
  console.log('PASS exact links preserve moved task and diagnose missing/out-of-range tasks');
}
async function reservationSafety() {
  const result = await readStaffingDataset(fixture({ properties: [property],
    lh_reservations: [
      { id: 'cancelled', sede_id: 's', rooms: ['A'], check_in: '2026-09-13', check_out: '2026-09-14', status: 'no_show' },
      { id: 'unknown', sede_id: 's', rooms: ['A'], check_in: '2026-09-13', check_out: '2026-09-14', status: 'mystery' },
    ],
    lh_room_mapping: [{ id: 'map', sede_id: 's', lh_room: 'A', service_kind: 'checkout', propiedad_id: 'p', is_active: true, default_start_time: '11:00', default_duration_min: 65 }],
    lh_reservation_tasks: [{ id: 'link', reservation_id: 'cancelled', task_id: 't', lh_room: 'A', service_kind: 'checkout', task_date: '2026-09-14', status: 'active' }],
    tasks: [{ id: 't', sede_id: 's', propiedad_id: 'p', date: '2026-09-14', status: 'pending' }],
    avirato_reservations: [{ id: 'block', sede_id: 's', space_subtype_id: 'X', check_in: '2026-09-13', check_out: '2026-09-14', normalized_status: 'block' }],
    avirato_room_mapping: [{ id: 'a-map', sede_id: 's', space_subtype_id: 'X', service_kind: 'checkout', propiedad_id: 'p', is_active: true, default_start_time: '11:00', default_duration_min: 65 }],
    avantio_reservations: [{ id: 'missing', property_id: 'p', departure_date: '2026-09-15', task_id: 'hidden', status: 'confirmed' }],
  }), 's', '2026-09-14', '2026-09-20');
  assert.deepEqual(result.services.map(s => s.id), ['task:t'], 'unknown, cancelled and block reservations cannot become certified new demand; unresolved link not duplicated');
  assert.ok(result.issues.some(i => i.code === 'reservation-link-conflict'));
  assert.ok(result.issues.some(i => i.code === 'unknown-reservation-status'));
  assert.ok(result.issues.some(i => i.code === 'linked-task-unavailable'));
  console.log('PASS cancellation conflicts, unknown statuses, blocks and missing Avantio links');
}
async function recurringIdentity() {
  const specs: StaffingReadSpec[] = [];
  const result = await readStaffingDataset(fixture({ properties: [property],
    tasks: ['14', '19'].map(day => ({ id: `t${day}`, sede_id: 's', propiedad_id: 'p', date: `2026-09-${day}`, status: 'pending', duracion: 45 })),
    recurring_tasks: [{ id: 'rec', sede_id: 's', propiedad_id: 'p', is_active: true, start_date: '2026-09-14', end_date: '2026-09-20', frequency: 'daily', interval_days: 2, duracion: 45, start_time: '11:00', end_time: '12:00' }],
    recurring_task_executions: [
      { id: 'e14', recurring_task_id: 'rec', execution_date: '2026-09-13T22:30:00Z', generated_task_id: 't14', success: true },
      { id: 'failed', recurring_task_id: 'rec', execution_date: '2026-09-16T10:00:00Z', generated_task_id: 'garbage', success: false },
      { id: 'e18', recurring_task_id: 'rec', execution_date: '2026-09-20T10:00:00Z', execution_day: '2026-09-18', generated_task_id: 't19', success: true },
    ],
  }, specs), 's', '2026-09-14', '2026-09-20');
  assert.equal(result.services.length, 4, 'one service per exact successful execution or virtual occurrence, not per attempt');
  assert.deepEqual(result.services.filter(s => s.source === 'recurring').map(s => s.date), ['2026-09-16', '2026-09-20']);
  assert.ok(result.issues.some(i => i.code === 'execution-date-fallback'));
  assert.ok(result.issues.some(i => i.code === 'reservation-link-conflict'));
  assert.ok(specs.filter(s => s.table === 'recurring_task_executions').every(s => s.within?.ids.join() === 'rec'));
  console.log('PASS recurring interval expansion with exact execution day and Madrid fallback');
}
async function workerConstraints() {
  const result = await readStaffingDataset(fixture({ properties: [property],
    cleaners: [{ id: 'w', sede_id: 's', name: 'Persona sintética', is_active: true, contract_hours_per_week: 20, planning_max_daily_minutes: 300 }],
    property_group_assignments: [{ id: 'pg', property_id: 'p', property_group_id: 'g' }],
    property_groups: [{ id: 'g', name: 'G', is_active: true, check_out_time: '10:00', check_in_time: '17:00' }],
    cleaner_group_assignments: [{ id: 'cg', cleaner_id: 'w', property_group_id: 'g', priority: 90, is_active: true }],
    cleaner_availability: [
      { id: 'available', cleaner_id: 'w', day_of_week: 1, is_available: true, start_time: '09:00', end_time: '17:00' },
      { id: 'no', cleaner_id: 'w', day_of_week: 1, is_available: false, start_time: '12:00', end_time: '13:00' },
    ],
    worker_fixed_days_off: [0, 6].map(day => ({ id: `rest${day}`, cleaner_id: 'w', day_of_week: day, is_active: true })),
    worker_absences: [
      { id: 'rest', cleaner_id: 'w', start_date: '2026-09-15', end_date: '2026-09-15', start_time: null, end_time: null, absence_type: 'day_off' },
      { id: 'partial', cleaner_id: 'w', start_date: '2026-09-16', end_date: '2026-09-16', start_time: '11:00', end_time: '12:00', absence_type: 'vacation' },
      { id: 'external', cleaner_id: 'w', start_date: '2026-09-17', end_date: '2026-09-17', start_time: '13:00', end_time: '15:00', absence_type: 'external_work' },
    ],
    worker_maintenance_cleanings: [
      { id: 'maintenance', cleaner_id: 'w', days_of_week: [1], start_time: '10:00', end_time: '11:00', is_active: true, schedule_type: 'maintenance' },
      { id: 'unavailability', cleaner_id: 'w', days_of_week: [2], start_time: '11:00', end_time: '12:00', is_active: true, schedule_type: 'unavailability' },
    ],
    worker_contracts: [{ id: 'contract', cleaner_id: 'w', start_date: '2026-09-16', end_date: null, contract_hours_per_week: 30, is_active: true }],
  }), 's', '2026-09-14', '2026-09-20');
  const worker = result.workers[0];
  assert.deepEqual(worker.excludedCenterIds, ['g'], 'priority 90 excludes, not a home team');
  assert.deepEqual(worker.homeCenterIds, []);
  assert.deepEqual(worker.confirmedRestDates, ['2026-09-15']);
  assert.equal(worker.flexibleRest, false);
  assert.equal(worker.maxDailyMinutes, 300);
  assert.equal(worker.weeklyMinutes, 1200, 'dated contract not arbitrarily merged with current contract');
  assert.ok(result.issues.some(i => i.code === 'contract-current-assumption'));
  const blocks = worker.blockedSlots!;
  assert.ok(blocks.some(b => b.day === 1 && b.startMinute === 720 && !b.consumesContract));
  assert.ok(blocks.some(b => b.day === 6 && b.startMinute === 0 && b.endMinute === 1440));
  assert.ok(blocks.some(b => b.date === '2026-09-16' && b.startMinute === 660 && b.endMinute === 720 && !b.consumesContract));
  assert.ok(blocks.some(b => b.date === '2026-09-17' && b.consumesContract));
  assert.ok(blocks.some(b => b.day === 1 && b.startMinute === 600 && b.consumesContract));
  assert.ok(blocks.some(b => b.day === 2 && b.startMinute === 660 && !b.consumesContract));
  console.log('PASS fixed and dated rests, partial absence, maintenance, contract warning and exclusions');
}
async function planningAndQuality() {
  const tables = { properties: [{ ...property, planning_required_cleaners: 2, planning_estimated_checkout_minutes: 180 }],
    tasks: [{ id: 't', sede_id: 's', propiedad_id: 'p', date: '2026-09-14', status: 'pending', type: 'limpieza-turistica' }],
    avirato_reservations: [{ id: 'av', sede_id: 's', check_in: '2026-09-13', check_out: '2026-09-15', space_subtype_id: 123, normalized_status: 'confirmed' }],
    avirato_room_mapping: [{ id: 'map', sede_id: 's', space_subtype_id: 123, service_kind: 'checkout', propiedad_id: 'p', is_active: true, default_start_time: '11:00', default_duration_min: 70 }],
  };
  const result = await readStaffingDataset(fixture(tables), 's', '2026-09-14', '2026-09-20');
  assert.equal(result.services[0].requiredWorkers, 2, 'configured simultaneous team is not silently 1');
  assert.equal(result.services[0].personMinutes, 210, 'checkout estimate is base effort +30, not multiplied by team');
  assert.equal(result.services[1].personMinutes, 70, 'numeric Avirato subtype is an exact mapping key');
  assert.equal(result.services[1].requiredWorkers, 2);
  const baseRead = fixture({ ...tables, properties: [{ ...property, duracion_servicio: null }], tasks: [tables.tasks[0]], avirato_reservations: [], avirato_room_mapping: [] });
  const fallback = await readStaffingDataset(async spec => {
    if (spec.columns.includes('planning_')) throw new Error('column unavailable');
    return baseRead(spec);
  }, 's', '2026-09-14', '2026-09-20');
  assert.ok(Number.isNaN(fallback.services[0].personMinutes), 'unknown effort must not be a certified zero');
  assert.ok(fallback.issues.some(i => i.code === 'extension-unavailable'));
  assert.ok(fallback.issues.some(i => i.code === 'missing-duration'));
  assert.ok(fallback.issues.some(i => i.code === 'required-workers-assumption'));
  assert.ok(fallback.issues.some(i => i.code === 'non-atomic-read'));
  console.log('PASS optional planning extensions, numeric subtype and unknown effort quality');
}
async function missingSourcesAndScope() {
  const specs: StaffingReadSpec[] = [];
  const baseRead = fixture({ properties: [property], tasks: [{ id: 'orphan', sede_id: 's', propiedad_id: null, date: '2026-09-14', status: 'pending', duracion: 40 }] }, specs);
  const result = await readStaffingDataset(async spec => {
    if (spec.table === 'client_reservations') throw new Error('outside requested sources');
    return baseRead(spec);
  }, 's', '2026-09-14', '2026-09-20');
  assert.ok(!specs.some(s => s.table === 'hostaway_reservations'));
  assert.equal(result.services.length, 1, 'unmapped task remains visible demand, never disappears');
  assert.equal(result.services[0].personMinutes, 40);
  assert.ok(result.issues.some(i => i.code === 'unmapped-task'));
  assert.ok(result.issues.some(i => i.code === 'provider-coverage'));
  assert.ok(!result.issues.some(i => i.message.includes('client_reservations') && i.code === 'source-unavailable'), 'client reservations are out of scope, not queried');
  console.log('PASS orphan demand and explicit provider scope limits');
}
async function invalidDates() {
  let calls = 0;
  await assert.rejects(() => readStaffingDataset(async () => { calls++; return []; }, 's', '2026-02-30', '2026-03-05'), /rango/i);
  assert.equal(calls, 0);
  assert.ok(Number.isNaN(timeMinutes('12:30:99')));
  const result = await readStaffingDataset(fixture({ properties: [property], lh_reservations: [{ id: 'invalid', sede_id: 's', rooms: ['A'], check_in: '2026-02-30', check_out: '2026-03-03', status: 'confirmed' }] }), 's', '2026-03-01', '2026-03-07');
  assert.ok(result.issues.some(i => i.code === 'invalid-reservation-dates'));
  console.log('PASS real civil date and clock validation, no rollover or silent zero');
}
async function ambiguousHotelLinks() {
  const result = await readStaffingDataset(fixture({ properties: [property],
    lh_reservations: [{ id: 'r', sede_id: 's', rooms: ['A'], check_in: '2026-09-13', check_out: '2026-09-14', status: 'confirmed' }],
    lh_room_mapping: [{ id: 'map', sede_id: 's', lh_room: 'A', service_kind: 'checkout', propiedad_id: 'p', is_active: true, default_start_time: '11:00', default_duration_min: 60 }],
    lh_reservation_tasks: ['one', 'two'].map(id => ({ id, reservation_id: 'r', task_id: null, lh_room: 'A', service_kind: 'checkout', task_date: '2026-09-14', status: 'active' })),
  }), 's', '2026-09-14', '2026-09-20');
  assert.equal(result.services.length, 0, 'ambiguous materialization must not regenerate demand');
  assert.ok(result.issues.some(i => i.code === 'hotel-link-conflict'));
  const cancelled = await readStaffingDataset(fixture({ properties: [property],
    lh_reservations: [{ id: 'r', sede_id: 's', room: 'A', check_in: '2026-09-13', check_out: '2026-09-14', status: 'confirmed' }],
    lh_room_mapping: [{ id: 'map', sede_id: 's', lh_room: 'A', service_kind: 'checkout', propiedad_id: 'p', is_active: true, default_start_time: '11:00', default_duration_min: 60 }],
    lh_reservation_tasks: [{ id: 'one', reservation_id: 'r', task_id: 't', lh_room: 'A', service_kind: 'checkout', task_date: '2026-09-14', status: 'cancelled' }],
    tasks: [{ id: 't', sede_id: 's', propiedad_id: 'p', date: '2026-09-14', status: 'pending' }],
  }), 's', '2026-09-14', '2026-09-20');
  assert.equal(cancelled.services.length, 1);
  assert.ok(cancelled.issues.some(i => i.code === 'hotel-link-conflict'), 'cancelled link and active task conflict must be visible');
  console.log('PASS ambiguous/cancelled hotel links cannot silently regenerate');
}
async function paginatedInventory() {
  const specs: StaffingReadSpec[] = [];
  const tasks = Array.from({ length: 501 }, (_, n) => ({ id: `t${String(n).padStart(4, '0')}`, sede_id: 's', propiedad_id: 'p', date: '2026-09-14', status: 'pending', duracion: 20 }));
  const reservations = Array.from({ length: 501 }, (_, n) => ({ id: `r${String(n).padStart(4, '0')}`, sede_id: 's', rooms: ['A'], check_in: '2026-09-13', check_out: '2026-09-14', status: 'confirmed' }));
  const tables = { properties: [property], tasks, lh_reservations: reservations,
    lh_room_mapping: [{ id: 'map', sede_id: 's', lh_room: 'A', service_kind: 'checkout', propiedad_id: 'p', is_active: true, default_start_time: '11:00', default_duration_min: 60 }],
  };
  const read = fixture(tables, specs);
  const result = await readStaffingDataset(async spec => {
    const rows = await read(spec);
    if (spec.table === 'tasks' && spec.from === 500) return [{ ...tasks[499], duracion: 25 }, ...rows];
    return rows;
  }, 's', '2026-09-14', '2026-09-20');
  assert.equal(result.inventory[0].tasks, 501);
  assert.equal(result.services.length, 1002, 'all task and reservation pages without property/day heuristic dedup');
  assert.equal(new Set(result.services.map(s => s.id)).size, 1002);
  assert.ok(specs.some(s => s.table === 'lh_reservations' && s.from === 500));
  assert.equal(specs.filter(s => s.table === 'lh_reservation_tasks').length, 6, 'parent IDs batched to bounded IN lists');
  assert.ok(specs.every(s => !s.within || s.within.ids.length <= 100));
  assert.ok(result.issues.some(i => i.code === 'concurrent-read-conflict'), 'changed duplicate across pages is not silently last-row-wins');
  const partial = await readStaffingDataset(async spec => {
    if (spec.table === 'lh_reservations' && spec.from === 500) throw new Error('second-page failure');
    return read(spec);
  }, 's', '2026-09-14', '2026-09-20');
  assert.ok(partial.issues.some(i => i.code === 'source-unavailable'));
  assert.equal(partial.services.filter(s => s.source === 'reservation').length, 0, 'incomplete provider cannot masquerade as complete first page');
  console.log('PASS offset pages, dedup, parent batching, concurrent rows and partial-source failure');
}
async function preferredAndForeignChildren() {
  const base = fixture({ properties: [property], cleaners: [{ id: 'w', sede_id: 's', is_active: true, contract_hours_per_week: null }],
    property_preferred_cleaners: [{ id: 'excluded', property_id: 'p', cleaner_id: 'w', priority: 95 }],
  });
  const result = await readStaffingDataset(async spec => {
    if (spec.table === 'cleaner_availability') return [{ id: 'foreign-slot', cleaner_id: 'other-sede', day_of_week: 1, is_available: true, start_time: '09:00', end_time: '17:00' }];
    if (spec.table === 'worker_absences') return [{ id: 'foreign-absence', cleaner_id: 'other-sede', start_date: '2026-09-14', end_date: '2026-09-20', absence_type: 'day_off' }];
    return base(spec);
  }, 's', '2026-09-14', '2026-09-20');
  assert.deepEqual(result.workers[0].excludedCenterIds, ['p'], 'property exclusions apply also to ungrouped centers');
  assert.deepEqual(result.workers[0].availability, []);
  assert.deepEqual(result.workers[0].confirmedRestDates, []);
  assert.ok(Number.isNaN(result.workers[0].weeklyMinutes));
  assert.equal(result.workers[0].restDay, null);
  assert.equal(result.workers[0].flexibleRest, false);
  assert.ok(result.issues.some(i => i.code === 'scope-violation'));
  console.log('PASS property exclusions, foreign worker children rejected, unknown hours/rest not invented');
}
async function sourceFailureQuality() {
  const read = fixture({ properties: [property], cleaners: [{ id: 'w', sede_id: 's', is_active: true, contract_hours_per_week: 20 }], worker_fixed_days_off: [{ id: 'off', cleaner_id: 'w', day_of_week: 0, is_active: true }], cleaner_availability: [{ id: 'a', cleaner_id: 'w', day_of_week: 1, is_available: true, start_time: '09:00', end_time: '17:00' }] });
  const result = await readStaffingDataset(async spec => {
    if (spec.table === 'worker_absences' || spec.table === 'tasks') throw new Error('denied');
    return read(spec);
  }, 's', '2026-09-14', '2026-09-20');
  assert.ok(result.issues.some(i => i.code === 'source-unavailable' && i.message.includes('tasks')));
  assert.ok(result.issues.some(i => i.code === 'source-unavailable' && i.message.includes('worker_absences')));
  assert.deepEqual(result.workers[0].availability, [], 'unknown absences must not assert full known availability');
  assert.ok(result.issues.some(i => i.code === 'capacity-incomplete'));
  console.log('PASS core source failures are explicit issues and unknown capacity is withheld');
}
async function inactivePropertiesExcluded() {
  const result = await readStaffingDataset(async spec => {
    if (spec.table === 'properties') return [
      { id: 'active', nombre: 'Piso activo', sede_id: 's', is_active: true, duracion_servicio: 60, check_out_predeterminado: '11:00', check_in_predeterminado: '17:00' },
      { id: 'inactive', nombre: 'Piso inactivo', sede_id: 's', is_active: false, duracion_servicio: 60, check_out_predeterminado: '11:00', check_in_predeterminado: '17:00' },
      { id: 'unknown', nombre: 'Piso sin estado', sede_id: 's', is_active: null, duracion_servicio: 60, check_out_predeterminado: '11:00', check_in_predeterminado: '17:00' },
      { id: 'inactive-building-property', nombre: 'Piso de edificio inactivo', sede_id: 's', is_active: true, duracion_servicio: 60, check_out_predeterminado: '11:00', check_in_predeterminado: '17:00' },
    ];
    if (spec.table === 'tasks') return [
      { id: 'active-task', propiedad_id: 'active', sede_id: 's', date: '2026-09-15', status: 'pending', duracion: 60, type: 'limpieza-turistica' },
      { id: 'inactive-task', propiedad_id: 'inactive', sede_id: 's', date: '2026-09-15', status: 'pending', duracion: 60, type: 'limpieza-turistica' },
      { id: 'unknown-status-task', propiedad_id: 'unknown', sede_id: 's', date: '2026-09-15', status: 'pending', duracion: 60, type: 'limpieza-turistica' },
      { id: 'inactive-building-task', propiedad_id: 'inactive-building-property', sede_id: 's', date: '2026-09-15', status: 'pending', duracion: 60, type: 'limpieza-turistica' },
    ];
    if (spec.table === 'property_group_assignments') return [{ id: 'inactive-membership', property_id: 'inactive-building-property', property_group_id: 'inactive-building' }];
    if (spec.table === 'property_groups') return [{ id: 'inactive-building', name: 'Edificio inactivo', is_active: false, check_out_time: '11:00', check_in_time: '17:00' }];
    return [];
  }, 's', '2026-09-14', '2026-09-20');
  assert.deepEqual(result.services.map(service => service.id), ['task:active-task', 'task:unknown-status-task', 'task:inactive-building-task'], 'active property in inactive group retains its own demand');
  assert.ok(!result.centers.some(center => ['inactive', 'inactive-building'].includes(center.id)));
  assert.ok(result.centers.some(center => center.id === 'inactive-building-property'), 'individual fallback for active property');
  assert.ok(result.issues.some(issue => issue.code === 'inactive-properties-excluded'), 'exclusion must remain visible as data quality information');
  console.log('PASS default-active properties enter forecast demand; explicit inactive properties/buildings stay excluded');
}
async function recurrenceBoundaries() {
  const result = await readStaffingDataset(fixture({ properties: [property],
    recurring_tasks: [
      { id: 'weekly', sede_id: 's', propiedad_id: 'p', is_active: true, start_date: '2026-09-14', end_date: '2026-09-30', frequency: 'weekly', interval_days: 2, days_of_week: [1, 3] },
      { id: 'monthly', sede_id: 's', propiedad_id: 'p', is_active: true, start_date: '2026-08-31', frequency: 'monthly', interval_days: 1, day_of_month: 31 },
      { id: 'invalid-execution', sede_id: 's', propiedad_id: 'p', is_active: true, start_date: '2026-09-14', end_date: '2026-09-14', frequency: 'daily', interval_days: 1 },
    ], recurring_task_executions: [{ id: 'bad', recurring_task_id: 'invalid-execution', success: true, execution_date: 'invalid', generated_task_id: null }],
  }), 's', '2026-09-14', '2026-10-31');
  assert.deepEqual(result.services.filter(s => s.id.includes(':weekly:')).map(s => s.date), ['2026-09-14', '2026-09-16', '2026-09-28', '2026-09-30']);
  assert.deepEqual(result.services.filter(s => s.id.includes(':monthly:')).map(s => s.date), ['2026-09-30', '2026-10-31']);
  assert.ok(!result.services.some(s => s.id.includes(':invalid-execution:')), 'success with unknown identity cannot silently regenerate potentially materialized demand');
  assert.ok(result.issues.some(i => i.code === 'invalid-execution-date'));
  console.log('PASS weekly interval, month-end clamping and unidentifiable successful executions');
}
async function paginatedHotelChildren() {
  const specs: StaffingReadSpec[] = [];
  const rooms = Array.from({ length: 501 }, (_, n) => `room${String(n).padStart(4, '0')}`);
  const tables = { properties: [property],
    lh_reservations: [{ id: 'r', sede_id: 's', rooms, check_in: '2026-09-13', check_out: '2026-09-14', status: 'confirmed' }],
    lh_room_mapping: rooms.map(room => ({ id: room, sede_id: 's', lh_room: room, service_kind: 'checkout', propiedad_id: 'p', is_active: true, default_start_time: '11:00', default_duration_min: 60 })),
    lh_reservation_tasks: rooms.map(room => ({ id: room, reservation_id: 'r', lh_room: room, service_kind: 'checkout', task_date: '2026-09-14', status: 'cancelled' })),
  };
  const result = await readStaffingDataset(fixture(tables, specs), 's', '2026-09-14', '2026-09-20');
  assert.equal(result.services.length, 0, 'last cancelled room link cannot be lost at page boundary');
  assert.ok(specs.some(s => s.table === 'lh_room_mapping' && s.from === 500));
  assert.ok(specs.some(s => s.table === 'lh_reservation_tasks' && s.from === 500 && s.within?.ids.join() === 'r'));
  assert.ok(result.issues.some(i => i.code === 'hotel-link-conflict'));
  const stuck = await readStaffingDataset(async spec => {
    if (spec.table === 'lh_reservations') return Array.from({ length: 500 }, (_, n) => ({ ...tables.lh_reservations[0], id: String(n) }));
    return [];
  }, 's', '2026-09-14', '2026-09-20');
  assert.ok(stuck.issues.some(i => i.code === 'source-unavailable'));
  console.log('PASS mapping and child-link pages plus non-progress pagination guard');
}
async function recurringAccessWindows() {
  const cases = [
    { label: 'early checkin', start_time: '11:00', end_time: '12:00', check_out: '11:00', check_in: '12:00', expected: [660, 720] },
    { label: 'scheduled end is not access deadline', start_time: '11:00', end_time: '12:00', check_out: '10:00', check_in: '16:00', expected: [660, 960] },
    { label: 'checkout wins over earlier reference', start_time: '09:00', end_time: '12:00', check_out: '11:00', check_in: '12:00', expected: [660, 720] },
    { label: 'missing access uses center and reference', start_time: '11:00', end_time: '12:00', check_out: null, check_in: null, expected: [660, 1020] },
    { label: 'malformed checkout fallback is explicit', start_time: '11:00', end_time: '12:00', check_out: 'bad', check_in: '12:00', expected: [660, 720], issue: true },
    { label: 'malformed checkin fallback is explicit', start_time: '11:00', end_time: '12:00', check_out: '10:00', check_in: '25:00', expected: [660, 1020], issue: true },
    { label: 'malformed reference fallback is explicit', start_time: 'bad', end_time: '12:00', check_out: '11:00', check_in: '12:00', expected: [660, 720], issue: true },
    { label: 'contradictory access is not expanded', start_time: '11:00', end_time: '15:00', check_out: '13:00', check_in: '12:00', expected: [780, 720], issue: true },
  ];
  for (const example of cases) {
    const row = { id: 'rec', sede_id: 's', propiedad_id: 'p', is_active: true, start_date: '2026-09-15', end_date: '2026-09-15', frequency: 'daily', interval_days: 1, duracion: 45, ...example };
    const virtual = await readStaffingDataset(fixture({ properties: [property], recurring_tasks: [row] }), 's', '2026-09-14', '2026-09-20');
    const materialized = await readStaffingDataset(fixture({ properties: [property], recurring_tasks: [row],
      tasks: [{ ...row, id: 'generated', date: '2026-09-15', status: 'pending' }],
      recurring_task_executions: [{ id: 'exec', recurring_task_id: 'rec', execution_day: '2026-09-15', execution_date: '2026-09-15T09:00:00Z', generated_task_id: 'generated', success: true }],
    }), 's', '2026-09-14', '2026-09-20');
    assert.equal(virtual.services.length, 1);
    assert.equal(materialized.services.length, 1);
    const window = (service: typeof virtual.services[number]) => [service.startMinute, service.endMinute];
    assert.deepEqual(window(virtual.services[0]), example.expected, `D1 virtual: ${example.label}`);
    assert.deepEqual(window(materialized.services[0]), example.expected, `D1 materialized: ${example.label}`);
    if (Number.isFinite(timeMinutes(example.check_in))) assert.ok(virtual.services[0].endMinute <= timeMinutes(example.check_in), 'never past checkin');
    for (const data of [virtual, materialized]) assert.equal(data.issues.some(i => i.code === 'invalid-access-window'), !!example.issue, example.label);
  }
  console.log('PASS D1 virtual/materialized access equality, checkin boundary and explicit invalid fallbacks');
}
async function conflictingTaskClaims() {
  const day = '2026-09-14';
  const hotel = (provider: 'lh' | 'avirato', rooms: string[]): Record<string, StaffingRow[]> => {
    const roomColumn = provider === 'lh' ? 'lh_room' : 'space_subtype_id';
    return {
      [`${provider}_reservations`]: provider === 'lh'
        ? [{ id: 'r', sede_id: 's', rooms, check_in: '2026-09-13', check_out: day, status: 'confirmed' }]
        : rooms.map(room => ({ id: room, sede_id: 's', space_subtype_id: room, check_in: '2026-09-13', check_out: day, normalized_status: 'confirmed' })),
      [`${provider}_room_mapping`]: rooms.map((room, index) => ({ id: room, sede_id: 's', [roomColumn]: room, service_kind: 'checkout', propiedad_id: 'p', is_active: true, default_start_time: index ? '12:00' : '11:00', default_duration_min: index ? 90 : 60 })),
      [`${provider}_reservation_tasks`]: rooms.map(room => ({ id: room, reservation_id: provider === 'lh' ? 'r' : room, [roomColumn]: room, service_kind: 'checkout', task_date: day, status: 'active', task_id: 'shared' })),
    };
  };
  const recurrence = (ids: string[]): Record<string, StaffingRow[]> => ({
    recurring_tasks: ids.map(id => ({ id, sede_id: 's', propiedad_id: 'p', is_active: true, start_date: day, end_date: day, frequency: 'daily', interval_days: 1, start_time: '11:00' })),
    recurring_task_executions: ids.map(id => ({ id, recurring_task_id: id, execution_day: day, generated_task_id: 'shared', success: true })),
  });
  const avantio = (ids: string[]): Record<string, StaffingRow[]> => ({ avantio_reservations: ids.map(id => ({ id, property_id: 'p', departure_date: day, status: 'confirmed', task_id: 'shared' })) });
  const scenarios = [
    { label: 'LH multiroom', tables: hotel('lh', ['A', 'B']) },
    { label: 'Avirato reservations', tables: hotel('avirato', ['A', 'B']) },
    { label: 'cross hotel providers', tables: { ...hotel('lh', ['A']), ...hotel('avirato', ['A']) } },
    { label: 'hotel and recurrence', tables: { ...hotel('lh', ['A']), ...recurrence(['rec']) } },
    { label: 'hotel and Avantio', tables: { ...hotel('lh', ['A']), ...avantio(['r']) } },
    { label: 'two recurrences', tables: recurrence(['rec1', 'rec2']) },
    { label: 'same recurrence on different days', tables: { ...recurrence(['rec']), recurring_tasks: recurrence(['rec']).recurring_tasks.map(row => ({ ...row, end_date: '2026-09-15' })), recurring_task_executions: [day, '2026-09-15'].map(date => ({ id: date, recurring_task_id: 'rec', execution_day: date, generated_task_id: 'shared', success: true })) } },
    { label: 'two Avantio reservations', tables: avantio(['r1', 'r2']) },
    { label: 'Avantio and recurrence', tables: { ...avantio(['r']), ...recurrence(['rec']) } },
  ];
  for (const scenario of scenarios) {
    for (const effortSource of ['property', 'task', 'unknown']) {
      const scopedProperty = { ...property, duracion_servicio: effortSource === 'property' ? 100 : null };
      const tasks = [{ id: 'shared', sede_id: 's', propiedad_id: 'p', date: day, status: 'pending', duracion: effortSource === 'unknown' ? null : 45 }];
      const tables: Record<string, StaffingRow[]> = { properties: [scopedProperty], tasks, ...scenario.tables };
      const baseline = await readStaffingDataset(fixture({ properties: [scopedProperty], tasks }), 's', day, '2026-09-20');
      const forward = await readStaffingDataset(fixture(tables), 's', day, '2026-09-20');
      const read = fixture({ ...tables, lh_reservations: (tables.lh_reservations || []).map(row => ({ ...row, rooms: [...row.rooms as string[]].reverse() })) });
      const reversed = await readStaffingDataset(async spec => (await read(spec)).reverse(), 's', day, '2026-09-20');
      for (const data of [forward, reversed]) {
        assert.equal(data.services.length, 1, `${scenario.label}: no regenerated or summed demand`);
        assert.equal(data.services[0].personMinutes, baseline.services[0].personMinutes, `D2 ${scenario.label}: retain initial task effort, not last mapping`);
        assert.equal(data.services[0].kind, baseline.services[0].kind);
        assert.ok(data.issues.some(i => i.code === 'task-occurrence-conflict' && i.centerId === 'p'), `${scenario.label}: explicit inverse identity conflict`);
        assert.ok(Number.isNaN(data.services[0].startMinute) && Number.isNaN(data.services[0].endMinute), 'conflicting task cannot become certified assignable capacity');
      }
      assert.deepEqual(forward.services, reversed.services, `${scenario.label}: order-independent services`);
    }
  }
  const duplicate = recurrence(['rec']);
  duplicate.recurring_task_executions.push({ ...duplicate.recurring_task_executions[0], id: 'retry' });
  const repeated = await readStaffingDataset(fixture({ properties: [property], tasks: [{ id: 'shared', sede_id: 's', propiedad_id: 'p', date: day, status: 'pending' }], ...duplicate }), 's', day, '2026-09-20');
  assert.ok(repeated.issues.some(i => i.code === 'recurring-execution-conflict'), 'duplicate successful rows retain existing occurrence warning');
  assert.ok(!repeated.issues.some(i => i.code === 'task-occurrence-conflict'), 'same occurrence repeated is not a distinct inverse claim');
  console.log('PASS D2 inverse task claims across hotels/Avantio/recurrences, order-independent original or unknown effort');
}
async function staffingRolePriorities() {
  for (const origin of ['group', 'property', 'both', 'ungrouped-property']) {
    for (const priority of [10, 19, 20, 29, 30, 39, 89, 90, 95]) {
      const grouped = origin !== 'ungrouped-property';
      const result = await readStaffingDataset(fixture({ properties: [property],
        cleaners: [{ id: 'w', sede_id: 's', is_active: true, contract_hours_per_week: 20 }],
        cleaner_availability: [{ id: 'slot', cleaner_id: 'w', day_of_week: 1, is_available: true, start_time: '10:00', end_time: '17:00' }],
        property_group_assignments: grouped ? [{ id: 'pg', property_id: 'p', property_group_id: 'g' }] : [],
        property_groups: grouped ? [{ id: 'g', name: 'G', is_active: true, check_out_time: '10:00', check_in_time: '17:00' }] : [],
        cleaner_group_assignments: origin === 'group' || origin === 'both' ? [{ id: 'cg', cleaner_id: 'w', property_group_id: 'g', priority, is_active: true }] : [],
        property_preferred_cleaners: origin !== 'group' ? [{ id: 'pc', property_id: 'p', cleaner_id: 'w', priority }] : [],
      }), 's', '2026-09-14', '2026-09-20');
      assert.equal(result.workers.length, 1, 'preferences cannot duplicate worker capacity');
      const worker = result.workers[0]; const centerId = grouped ? 'g' : 'p';
      assert.deepEqual(worker.homeCenterIds, priority < 30 ? [centerId] : [], `D3 ${origin} priority ${priority}: backup is support, not home`);
      assert.deepEqual(worker.excludedCenterIds, priority >= 90 ? [centerId] : []);
      assert.equal(worker.canMove, false, 'mobility requires an explicit sede rule, not a missing exclusion');
      assert.equal(worker.weeklyMinutes, 1200);
      assert.equal(worker.availability.length, 1);
    }
  }
  console.log('PASS D3 primary/secondary home, backup support and exclusions across group/property preferences without duplicated capacity');
}
async function avantioOperationalStatuses() {
  const statuses = ['CONFIRMED', 'PAID', 'IN_PROGRESS', 'paid', 'in_progress', 'CANCELLED', 'REQUESTED', 'mystery'];
  const result = await readStaffingDataset(fixture({
    properties: [{ ...property, is_active: true }],
    tasks: [{ id: 'linked', sede_id: 's', propiedad_id: 'p', date: '2026-09-14', status: 'pending', duracion: 40 }],
    avantio_reservations: [
      ...statuses.map((status, index) => ({ id: `r${index}`, property_id: 'p', departure_date: '2026-09-14', status })),
      { id: 'cancel-date', property_id: 'p', departure_date: '2026-09-14', status: 'PAID', cancellation_date: '2026-09-13T10:00:00Z' },
      { id: 'materialized', property_id: 'p', departure_date: '2026-09-14', status: 'PAID', task_id: 'linked' },
    ],
    lh_reservations: [{ id: 'lh-paid', sede_id: 's', check_in: '2026-09-13', check_out: '2026-09-14', status: 'PAID', rooms: ['A'] }],
    lh_room_mapping: [{ id: 'm', sede_id: 's', lh_room: 'A', service_kind: 'checkout', propiedad_id: 'p', is_active: true, default_start_time: '11:00', default_duration_min: 50 }],
  }), 's', '2026-09-14', '2026-09-20');
  assert.deepEqual(result.services.map(s => s.id).sort(), [
    'task:linked', ...statuses.slice(0, 5).map((_, index) => `avantio_reservations:r${index}`),
  ].sort(), 'Avantio paid/in-progress are demand, cancelled/unknown excluded, exact task link not duplicated, active property included');
  assert.ok(result.issues.some(i => i.code === 'unknown-reservation-status'), 'unknown states remain uncertain and Avantio vocabulary is not global');
  assert.ok(!result.issues.some(i => i.code === 'reservation-link-conflict'), 'paid materialized reservation is not a cancellation conflict');
  console.log('PASS Avantio provider-specific states, cancellation precedence, materialized identity and active-property scope');
}
async function checkInIsNotCleaning() {
  const result = await readStaffingDataset(fixture({
    properties: [property],
    tasks: [
      { id: 'welcome', sede_id: 's', propiedad_id: 'p', date: '2026-09-14', status: 'pending', type: 'check-in', duracion: 30 },
      { id: 'clean', sede_id: 's', propiedad_id: 'p', date: '2026-09-14', status: 'pending', type: 'limpieza-turistica', check_in: '12:00' },
    ],
    recurring_tasks: [
      { id: 'r-welcome', sede_id: 's', propiedad_id: 'p', is_active: true, type: 'check-in', frequency: 'daily', start_date: '2026-09-14', end_date: '2026-09-15', interval_days: 1, duracion: 30 },
      { id: 'r-clean', sede_id: 's', propiedad_id: 'p', is_active: true, type: 'limpieza-turistica', frequency: 'daily', start_date: '2026-09-14', end_date: '2026-09-14', interval_days: 1, duracion: 60 },
    ],
    recurring_task_executions: [{ id: 'e', recurring_task_id: 'r-welcome', execution_day: '2026-09-14', execution_date: '2026-09-14T08:00:00Z', generated_task_id: 'welcome', success: true }],
  }), 's', '2026-09-14', '2026-09-20');
  assert.deepEqual(result.services.map(s => s.id).sort(), ['task:clean', 'recurring:r-clean:2026-09-14'].sort(), 'exclude check-in tasks and virtual/materialized recurrence without excluding cleaning with check_in deadline');
  assert.equal(result.services.find(s => s.id === 'task:clean')?.endMinute, 720);
  assert.ok(result.issues.some(i => i.code === 'check-in-occupancy-unverified'), 'do not silently claim excluded check-in execution time is free capacity');
  assert.equal(result.inventory[0].tasks, 2, 'raw task inventory remains raw, not a cleaning demand total');
  console.log('PASS check-in excluded from cleaning, access deadline retained, occupancy explicitly unverified');
}
async function littleHotelierHyphenatedStatus() {
  const result = await readStaffingDataset(fixture({ properties: [property],
    lh_reservations: ['checked-in', 'confirmed', 'cancelled', 'mystery'].map((status, index) => ({ id: `lh${index}`, sede_id: 's', check_in: '2026-09-13', check_out: '2026-09-14', status, rooms: ['A'] })),
    lh_room_mapping: [{ id: 'map', sede_id: 's', lh_room: 'A', service_kind: 'checkout', propiedad_id: 'p', is_active: true, default_start_time: '11:00', default_duration_min: 50 }],
  }), 's', '2026-09-14', '2026-09-20');
  assert.deepEqual(result.services.map(s => s.id).sort(), ['lh:lh0:A:checkout:2026-09-14', 'lh:lh1:A:checkout:2026-09-14'], 'observed LH checked-in is active, not unknown');
  assert.ok(result.issues.some(i => i.code === 'unknown-reservation-status'));
  console.log('PASS observed LH checked-in status without touching sync or jobs');
}

async function unlinkedHotelTaskConflict() {
  const result = await readStaffingDataset(fixture({
    properties: [property],
    tasks: [{ id: 'task', sede_id: 's', propiedad_id: 'p', date: '2026-09-14', status: 'pending', type: 'limpieza-turistica', duracion: 60 }],
    lh_reservations: [{ id: 'reservation', sede_id: 's', check_in: '2026-09-13', check_out: '2026-09-14', status: 'confirmed', rooms: ['A'] }],
    lh_room_mapping: [{ id: 'mapping', sede_id: 's', lh_room: 'A', service_kind: 'checkout', propiedad_id: 'p', is_active: true, default_start_time: '11:00', default_duration_min: 60 }],
  }), 's', '2026-09-14', '2026-09-20');
  assert.deepEqual(result.services.map(service => service.id), ['task:task']);
  assert.ok(result.issues.some(issue => issue.code === 'possible-duplicate'));
}

async function mismatchedRecurringExecution() {
  const result = await readStaffingDataset(fixture({
    properties: [property],
    tasks: [{ id: 'generated', sede_id: 's', propiedad_id: 'p', date: '2026-09-15', status: 'pending', duracion: 60 }],
    recurring_tasks: [{ id: 'rec', sede_id: 's', propiedad_id: 'p', is_active: true, start_date: '2026-09-14', end_date: '2026-09-14', frequency: 'daily', interval_days: 1, duracion: 60, start_time: '11:00', end_time: '12:00' }],
    recurring_task_executions: [{ id: 'execution', recurring_task_id: 'rec', execution_day: '2026-09-15', execution_date: '2026-09-15T09:00:00Z', generated_task_id: 'generated', success: true }],
  }), 's', '2026-09-14', '2026-09-20');
  assert.equal(result.services.filter(service => service.id.startsWith('recurring:')).length, 0);
  assert.ok(result.issues.some(issue => issue.code === 'recurring-execution-conflict'));
  const generated = result.services.find(service => service.id === 'task:generated');
  assert.ok(generated && Number.isNaN(generated.startMinute) && Number.isNaN(generated.endMinute));
}

async function invalidRecurringParameters() {
  const result = await readStaffingDataset(fixture({
    properties: [property],
    recurring_tasks: [{ id: 'invalid', sede_id: 's', propiedad_id: 'p', is_active: true, start_date: '2026-09-14', end_date: '2026-09-28', frequency: 'weekly', interval_days: 0, days_of_week: [99], duracion: 60, start_time: '11:00', end_time: '12:00' }],
  }), 's', '2026-09-14', '2026-09-28');
  assert.equal(result.services.filter(service => service.id.includes(':invalid:')).length, 0);
  assert.ok(result.issues.some(issue => issue.code === 'invalid-recurrence'));
  const fallback = await readStaffingDataset(async spec => {
    if (spec.table === 'recurring_task_executions' && spec.columns.includes('execution_day')) throw new Error('column unavailable');
    return fixture({
      properties: [property],
      tasks: [{ id: 'generated-fallback', sede_id: 's', propiedad_id: 'p', date: '2026-09-15', status: 'pending', duracion: 60 }],
      recurring_tasks: [{ id: 'fallback-rec', sede_id: 's', propiedad_id: 'p', is_active: true, start_date: '2026-09-14', end_date: '2026-09-14', frequency: 'daily', interval_days: 1, duracion: 60 }],
      recurring_task_executions: [{ id: 'fallback-execution', recurring_task_id: 'fallback-rec', execution_date: '2026-09-15T09:00:00Z', generated_task_id: 'generated-fallback', success: true }],
    })(spec);
  }, 's', '2026-09-14', '2026-09-20');
  assert.equal(fallback.services.filter(service => service.id.startsWith('recurring:')).length, 0);
  assert.ok(fallback.issues.some(issue => issue.code === 'execution-day-unavailable'));
  const monthly = await readStaffingDataset(fixture({
    properties: [property],
    recurring_tasks: [
      { id: 'bad-month-day', sede_id: 's', propiedad_id: 'p', is_active: true, start_date: '2026-09-01', end_date: '2026-10-01', frequency: 'monthly', interval_days: 1, day_of_month: 0, duracion: 60 },
      { id: 'bad-month-end', sede_id: 's', propiedad_id: 'p', is_active: true, start_date: '2026-09-01', end_date: '2026-09-31', frequency: 'monthly', interval_days: 1, day_of_month: 1, duracion: 60 },
    ],
  }), 's', '2026-09-01', '2026-10-31');
  assert.equal(monthly.services.filter(service => service.id.includes('bad-month')).length, 0);
  assert.ok(monthly.issues.some(issue => issue.code === 'invalid-recurrence'));
  const invalidEnd = await readStaffingDataset(fixture({
    properties: [property],
    recurring_tasks: [{ id: 'bad-end-only', sede_id: 's', propiedad_id: 'p', is_active: true, start_date: '2026-09-01', end_date: '2026-09-31', frequency: 'monthly', interval_days: 1, day_of_month: 1, duracion: 60 }],
  }), 's', '2026-09-01', '2026-10-31');
  assert.equal(invalidEnd.services.length, 0);
  assert.ok(invalidEnd.issues.some(issue => issue.code === 'invalid-recurrence'));
}
export async function run(focus?: string) {
  if (focus === 'R1') return hotelExcludedProperties();
  if (!focus) await hotelExcludedProperties();
  if (focus === 'lh-status') return littleHotelierHyphenatedStatus();
  if (focus === 'check-in') return checkInIsNotCleaning();
  if (focus === 'statuses') return avantioOperationalStatuses();
  if (focus === 'D1') return recurringAccessWindows();
  if (focus === 'D2') return conflictingTaskClaims();
  if (focus === 'D3') return staffingRolePriorities();
  assert.ok(!focus, `Unknown focus: ${focus}`);
  await avantioOperationalStatuses();
  await checkInIsNotCleaning();
  await littleHotelierHyphenatedStatus();
  await unlinkedHotelTaskConflict();
  await mismatchedRecurringExecution();
  await invalidRecurringParameters();
  await recurringAccessWindows();
  await conflictingTaskClaims();
  await staffingRolePriorities();
  let calls = 0;
  await assert.rejects(() => readStaffingDataset(async () => { calls++; return []; }, '', '2026-09-14', '2026-12-06'), /sede/i);
  assert.equal(calls, 0, 'missing sede must not issue any read');
  console.log('PASS missing sede is fail-closed');
  const specs: { table: string; equals?: Record<string, string | boolean>; from: number }[] = [];
  const result = await readStaffingDataset(async spec => {
    await readStaffingPage(spec); // Real whitelist/column/page validation with offline client.
    specs.push(spec);
    if (spec.table === 'properties') return [{ id: 'p', nombre: 'Apartamento', sede_id: 's', is_active: true, duracion_servicio: 120, check_out_predeterminado: '11:00', check_in_predeterminado: '17:00' }];
    if (spec.table === 'tasks') return [{ id: 't', propiedad_id: 'p', sede_id: 's', date: '2026-09-14', status: 'completed', duracion: 2, check_out: '12:00', check_in: '16:00', type: 'limpieza-turistica' }];
    if (spec.table === 'cleaners') return [{ id: 'w', sede_id: 's', name: 'Trabajador prueba', is_active: true, contract_hours_per_week: 15 }];
    if (spec.table === 'cleaner_availability') return [{ id: 'a', cleaner_id: 'w', day_of_week: 1, is_available: true, start_time: '10:00', end_time: '18:00' }];
    if (spec.table === 'worker_fixed_days_off') return [{ id: 'rest', cleaner_id: 'w', day_of_week: 0, is_active: true }];
    return [];
  }, 's', '2026-09-14', '2026-12-06');
  assert.equal(result.inventory[0]?.tasks, 1, 'aggregate actual task history');
  assert.equal(result.services[0]?.personMinutes, 150, 'property base 120 minutes + explicit 30 minute cleaning buffer');
  assert.equal(result.services[0]?.startMinute, 720, 'later actual checkout constrains default');
  assert.equal(result.workers[0]?.weeklyMinutes, 900);
  assert.equal(result.workers[0]?.restDay, 0);
  assert.ok(specs.filter(s => ['properties', 'tasks', 'cleaners'].includes(s.table)).every(s => s.equals?.sede_id === 's'));
  assert.ok(result.issues.length, 'source confidence remains explicit without historical snapshots');
  console.log('PASS scoped historical inventory and hours/window mapping');
  const props = [{ id: 'p', nombre: 'A', sede_id: 's', is_active: true, duracion_servicio: 60, check_out_predeterminado: '11:00', check_in_predeterminado: '17:00' }];
  const external = await readStaffingDataset(async spec => {
    if (spec.table === 'properties') return props;
    if (spec.table === 'tasks') return [{ id: 't', propiedad_id: 'p', sede_id: 's', date: '2026-09-15', status: 'pending', duracion: 1, type: 'limpieza-turistica' }];
    if (spec.table === 'avantio_reservations') {
      assert.equal(spec.within?.column, 'property_id');
      assert.deepEqual(spec.within?.ids, ['p']);
      return [{ id: 'r', property_id: 'p', departure_date: '2026-09-15', task_id: 't', status: 'confirmed' }, { id: 'r2', property_id: 'p', departure_date: '2026-09-16', status: 'confirmed' }, { id: 'cancel', property_id: 'p', departure_date: '2026-09-17', status: 'cancelled' }];
    }
    if (spec.table === 'avirato_reservations') throw new Error('permission denied');
    return [];
  }, 's', '2026-09-14', '2026-12-06');
  assert.equal(external.services.length, 2, 'linked reservation must not duplicate task and cancelled must not count');
  assert.ok(external.issues.some(issue => issue.code === 'source-unavailable'), 'unreadable source must be explicit, never silent zero');
  assert.deepEqual(external.providerCoverage?.find(provider => provider.provider === 'avantio'), { provider: 'avantio', label: 'Avantio', referenceDate: '2026-09-14', reservations30: 2, reservations31to60: 0, latestDate: '2026-09-16', status: 'limited' }, 'provider horizon counts active rows without adding future services');
  assert.equal(external.providerCoverage?.find(provider => provider.provider === 'lh')?.status, 'none', 'empty readable provider is not confused with unavailable');
  assert.equal(external.providerCoverage?.find(provider => provider.provider === 'avirato')?.status, 'unknown', 'unreadable provider is not presented as zero reservations');
  console.log('PASS linked identity deduplication and explicit source failure');
  const fallback = await readStaffingDataset(async spec => {
    if (spec.table === 'properties') return [{ ...props[0], duracion_servicio: null }];
    if (spec.table === 'tasks') return [{ id: 'fallback', sede_id: 's', propiedad_id: 'p', date: '2026-09-14', status: 'pending', duracion: 90 }];
    return [];
  }, 's', '2026-09-14', '2026-09-20');
  assert.equal(fallback.services[0].personMinutes, 90, 'stored task minutes are not hours and must not receive a second buffer');
  assert.ok(fallback.issues.some(i => i.code === 'task-duration-assumption'));
  console.log('PASS task fallback minutes without double buffer');
  const foreign = await readStaffingDataset(async spec => {
    if (spec.table === 'properties') return props;
    if (spec.table === 'property_group_assignments') return [{ id: 'evil', property_id: 'foreign', property_group_id: 'secret' }];
    assert.ok(!spec.within?.ids.includes('secret'), 'foreign membership must not authorize another parent read');
    return [];
  }, 's', '2026-09-14', '2026-09-20');
  assert.ok(foreign.issues.some(i => i.code === 'scope-violation'));
  console.log('PASS foreign children cannot authorize reads');
  await hotelExpansion();
  await hotelLinks();
  await reservationSafety();
  await recurringIdentity();
  await workerConstraints();
  await planningAndQuality();
  await missingSourcesAndScope();
  await invalidDates();
  await ambiguousHotelLinks();
  await paginatedInventory();
  await preferredAndForeignChildren();
  await sourceFailureQuality();
  await inactivePropertiesExcluded();
  await recurrenceBoundaries();
  await paginatedHotelChildren();
}
