import assert from 'node:assert/strict';
import { readStaffingPage } from '../src/features/staffing/readClient';
import { buildStaffingForecast } from '../src/features/staffing/engine';
import { readStaffingDataset, type StaffingReadPage, type StaffingReadSpec, type StaffingRow } from '../src/features/staffing/data';

const day = '2026-09-14';
const property = { id: 'shift-property', nombre: 'Nombre arbitrario', sede_id: 's', is_active: true, duracion_servicio: 270, check_out_predeterminado: '11:00', check_in_predeterminado: '15:00', planning_required_cleaners: 3 };
const recurrence = { id: 'rec', sede_id: 's', propiedad_id: property.id, is_active: true, type: 'limpieza-turistica', start_date: day, end_date: day, frequency: 'daily', interval_days: 1, duracion: 300, start_time: '08:00', end_time: '13:00', check_out: '11:00', check_in: '12:00' };
const task = { id: 'task', sede_id: 's', propiedad_id: property.id, date: day, status: 'pending', type: 'limpieza-turistica', duracion: 270, start_time: '07:00', end_time: '11:30', check_out: '11:00', check_in: '12:00' };
const rules = { shiftPropertyIds: [property.id] };
type Tables = Record<string, StaffingRow[]>;
function fixture(tables: Tables, specs: StaffingReadSpec[] = []): StaffingReadPage {
  return async spec => {
    await readStaffingPage(spec);
    specs.push(spec);
    assert.ok(spec.equals?.sede_id === 's' || spec.within?.ids.length, `scope: ${spec.table}`);
    return (tables[spec.table] || []).filter(row =>
      Object.entries(spec.equals || {}).every(([key, value]) => row[key] === value) &&
      (!spec.within || spec.within.ids.includes(String(row[spec.within.column]))) &&
      (!spec.since || String(row[spec.since.column]) >= spec.since.value) &&
      (!spec.until || String(row[spec.until.column]) <= spec.until.value))
      .sort((a, b) => String(a.id).localeCompare(String(b.id))).slice(spec.from, spec.to + 1)
      .map(row => Object.fromEntries(spec.columns.split(',').map(key => [key, row[key]])));
  };
}
async function fixedShifts() {
  const result = await readStaffingDataset(fixture({ properties: [property], tasks: [task], recurring_tasks: [recurrence] }), 's', day, '2026-09-20', rules);
  assert.deepEqual(result.services.map(s => [s.id, s.personMinutes, s.startMinute, s.endMinute, s.requiredWorkers, s.kind]), [
    ['task:task', 270, 420, 690, 1, 'fixed'],
    [`recurring:rec:${day}`, 300, 480, 780, 1, 'fixed'],
  ], 'explicit shifts preserve own duration, one person and exact work window, not apartment rules');
  assert.deepEqual(result.centers.map(c => [c.startMinute, c.endMinute]), [[0, 1440]], 'center must not clip the shift');
  const defaults = await readStaffingDataset(fixture({ properties: [property], tasks: [task] }), 's', day, day);
  assert.equal(defaults.services[0].personMinutes, 300, 'default keeps apartment base+30');
  assert.equal(defaults.services[0].kind, 'checkout');
  assert.equal(defaults.services[0].requiredWorkers, 3);
  assert.deepEqual([defaults.services[0].startMinute, defaults.services[0].endMinute], [660, 720]);
  console.log('PASS explicit task/recurrence fixed shifts and unchanged default reader');
}
async function invalidShifts() {
  const examples = [
    { label: 'missing start', start_time: null }, { label: 'missing end', end_time: null },
    { label: 'malformed start', start_time: 'bad' }, { label: 'invalid hour', end_time: '25:00' },
    { label: 'inverted window', end_time: '06:00' }, { label: 'zero window', end_time: '07:00' },
    { label: 'no duration', duracion: null }, { label: 'zero duration', duracion: 0 },
    { label: 'negative duration', duracion: -5 }, { label: 'nonfinite duration', duracion: Infinity },
    { label: 'boolean duration', duracion: true },
  ];
  for (const example of examples) {
    for (const source of ['task', 'recurring']) {
      const row = { ...task, ...example };
      const tables = source === 'task' ? { tasks: [row] } : { recurring_tasks: [{ ...recurrence, ...row, id: 'rec' }] };
      const result = await readStaffingDataset(fixture({ properties: [property], ...tables }), 's', day, day, rules);
      const service = result.services[0];
      assert.ok(Number.isNaN(service.startMinute) && Number.isNaN(service.endMinute), `${source}: ${example.label} withholds assignability, not a fallback window`);
      assert.ok(result.issues.some(i => i.code === ('duracion' in example ? 'invalid-shift-duration' : 'invalid-shift-window')), `${source}: ${example.label} diagnostic`);
      if ('duracion' in example) assert.ok(Number.isNaN(service.personMinutes));
    }
  }
  for (const duration of [240, 300]) {
    const result = await readStaffingDataset(fixture({ properties: [property], tasks: [{ ...task, duracion: duration }] }), 's', day, day, rules);
    assert.equal(result.services[0].personMinutes, duration, 'discrepancy must not silently rewrite duration');
    assert.ok(Number.isNaN(result.services[0].startMinute) && Number.isNaN(result.services[0].endMinute), 'inconsistent shift must not silently leave unoccupied time or change the schedule');
    assert.ok(result.issues.some(i => i.code === 'shift-duration-window-conflict'));
  }
  console.log('PASS invalid shift inputs and duration/window discrepancies withhold coverage');
}
async function scopeAndCenters() {
  const other = { ...property, id: 'other', nombre: property.nombre };
  const foreign = { ...property, id: 'foreign', sede_id: 'elsewhere' };
  const tables = { properties: [property, other, foreign], tasks: [{ ...task, propiedad_id: other.id }], recurring_tasks: [{ ...recurrence, propiedad_id: null, nombre: property.nombre }] };
  const invalid = await readStaffingDataset(fixture(tables), 's', day, day, { shiftPropertyIds: ['foreign', 'missing', ` ${property.id}`] });
  assert.ok(invalid.issues.some(i => i.code === 'invalid-shift-property'), 'invalid/out-of-scope IDs are diagnosed, not normalized or guessed');
  assert.ok(invalid.issues.some(i => i.code === 'unmapped-recurring'), 'unlinked recurrence remains unvalidated');
  assert.equal(invalid.services[0].kind, 'checkout', 'same name does not classify shifts');
  assert.ok(invalid.centers.every(c => c.startMinute === 660 && c.endMinute === 900));
  const grouped = await readStaffingDataset(fixture({
    properties: [property, other, { ...other, id: 'unrelated' }],
    tasks: [task, { ...task, id: 'other', propiedad_id: other.id }],
    property_group_assignments: [property, other].map(p => ({ id: p.id, property_id: p.id, property_group_id: 'group' })),
    property_groups: [{ id: 'group', name: 'Mixed', is_active: true, check_out_time: '10:00', check_in_time: '16:00' }],
  }), 's', day, day, rules);
  assert.deepEqual(grouped.centers.map(c => [c.id, c.startMinute, c.endMinute]), [['group', 0, 1440], ['unrelated', 660, 900]]);
  assert.deepEqual(grouped.services.map(s => [s.id, s.startMinute, s.endMinute]), [['task:other', 660, 720], ['task:task', 420, 690]], 'group broadening never expands ordinary service access');
  assert.ok(grouped.issues.some(i => i.code === 'mixed-shift-center' && i.centerId === 'group'));
  console.log('PASS exact scoped shift IDs, unmapped recurrence and mixed/unrelated center boundaries');
}
function pms(provider: 'lh' | 'avirato' | 'avantio', linked: boolean, propertyId = property.id): Tables {
  if (provider === 'avantio') return { avantio_reservations: [{ id: 'reservation', property_id: propertyId, departure_date: day, status: 'confirmed', task_id: linked ? task.id : null }] };
  const roomColumn = provider === 'lh' ? 'lh_room' : 'space_subtype_id';
  return {
    [`${provider}_reservations`]: [{ id: 'reservation', sede_id: 's', check_in: '2026-09-13', check_out: day, status: 'confirmed', normalized_status: 'confirmed', rooms: ['room'], space_subtype_id: 'room' }],
    [`${provider}_room_mapping`]: [{ id: 'map', sede_id: 's', [roomColumn]: 'room', service_kind: 'checkout', propiedad_id: propertyId, is_active: true, default_start_time: '11:00', default_duration_min: 50 }],
    [`${provider}_reservation_tasks`]: linked ? [{ id: 'link', reservation_id: 'reservation', task_id: task.id, [roomColumn]: 'room', service_kind: 'checkout', task_date: day, status: 'active' }] : [],
  };
}
async function noRoomRecalculation() {
  for (const provider of ['lh', 'avirato', 'avantio'] as const) {
    for (const linked of [false, true]) {
      const specs: StaffingReadSpec[] = [];
      const result = await readStaffingDataset(fixture({ properties: [property], tasks: [task], ...pms(provider, linked) }, specs), 's', day, day, rules);
      assert.equal(result.services.length, 1, `${provider} cannot add room demand to explicit shift`);
      assert.deepEqual(result.services.map(s => [s.personMinutes, s.startMinute, s.endMinute, s.kind, s.requiredWorkers]), [[270, 420, 690, 'fixed', 1]], `${provider} cannot enrich shift from PMS mapping`);
      assert.ok(result.issues.some(i => i.code === 'shift-pms-conflict'));
      if (provider === 'avirato') assert.ok(specs.find(s => s.table === 'avirato_reservation_tasks')?.columns.split(',').includes('space_subtype_id'), 'literal Avirato metadata includes subtype; do not remove it');
    }
  }
  const result = await readStaffingDataset(fixture({ properties: [property, { ...property, id: 'ordinary' }], tasks: [task], ...pms('lh', true, 'ordinary') }), 's', day, day, rules);
  assert.deepEqual(result.services.map(s => [s.personMinutes, s.startMinute, s.endMinute, s.kind]), [[270, 420, 690, 'fixed']], 'mapping to another model cannot override a linked shift task');
  assert.ok(result.issues.some(i => i.code === 'reservation-link-conflict'));
  assert.ok(result.issues.some(i => i.code === 'shift-pms-conflict'));
  console.log('PASS shift PMS collisions never expand rooms or enrich tasks; Avirato subtype retained');
}
async function materializationAndMargins() {
  const execution = { id: 'execution', recurring_task_id: recurrence.id, execution_day: day, generated_task_id: task.id, success: true };
  for (const state of ['current', 'moved', 'outside', 'cancelled', 'missing']) {
    const current = { ...task, date: state === 'moved' ? '2026-09-16' : state === 'outside' ? '2026-10-01' : day, status: state === 'cancelled' ? 'cancelled' : 'pending' };
    const result = await readStaffingDataset(fixture({ properties: [property], tasks: state === 'missing' ? [] : [current], recurring_tasks: [recurrence], recurring_task_executions: [execution] }), 's', day, '2026-09-20', rules);
    assert.equal(result.services.length, ['current', 'moved'].includes(state) ? 1 : 0, `${state}: successful materialization suppresses virtual shift`);
    if (result.services.length) assert.deepEqual(result.services.map(s => [s.date, s.personMinutes, s.startMinute, s.endMinute]), [[current.date, 270, 420, 690]], 'actual task controls changed duration/time/date, not recurrence');
    if (['moved', 'outside', 'cancelled'].includes(state)) assert.ok(result.issues.some(i => i.code === 'reservation-link-conflict'));
    if (state === 'missing') assert.ok(result.issues.some(i => i.code === 'linked-task-unavailable'));
  }
  const conflict = await readStaffingDataset(fixture({ properties: [property], tasks: [task], recurring_tasks: [recurrence], recurring_task_executions: [execution], ...pms('lh', true) }), 's', day, day, rules);
  assert.equal(conflict.services.length, 1);
  assert.equal(conflict.services[0].personMinutes, 270);
  assert.ok(Number.isNaN(conflict.services[0].startMinute));
  assert.ok(conflict.issues.some(i => i.code === 'task-occurrence-conflict'), 'D2 still withholds cross-provider shift claims');
  const result = await readStaffingDataset(fixture({ properties: [property], tasks: [task] }), 's', day, day, rules);
  result.workers = [{ id: 'worker', name: 'Synthetic', weeklyMinutes: 1200, homeCenterIds: [property.id], availability: [{ day: 1, startMinute: 360, endMinute: 900 }], restDay: 0, flexibleRest: false, canMove: true, unavailableDates: [], confirmedRestDates: [] }];
  for (const asOf of [day, '2026-08-01']) {
    const forecast = buildStaffingForecast(result, { dateFrom: day, asOf, weeks: 1, lateReservePercent: 20, seasonalPercent: 80, travelMinutes: 0 });
    assert.equal(forecast.days[0].knownMinutes, 270);
    assert.equal(forecast.days[0].estimatedMinutes, 0, 'fixed shift is neither near-horizon +20% nor seasonal load');
    assert.deepEqual(forecast.days[0].assignments.map(a => [a.startMinute, a.endMinute, a.personMinutes]), [[420, 690, 270]], 'engine does not clip/reposition shift to apartment checkout');
  }
  console.log('PASS current/moved/cancelled materializations, inverse conflicts and engine fixed-demand windows');
}
async function collaboratorRuleForwarding() {
  const tables = { properties: [property], cleaners: [{ id: 'collaborator', name: 'Synthetic', sede_id: 's', is_active: true, contract_hours_per_week: 0 }], cleaner_availability: [{ id: 'slot', cleaner_id: 'collaborator', day_of_week: 1, is_available: true, start_time: '07:00', end_time: '12:00' }] };
  const enabled = await readStaffingDataset(fixture(tables), 's', day, day, { ...rules, useHabitualCollaborators: true });
  // Regla de Dani: disponibilidad registrada ya no genera capacidad; 0 h en ficha
  // queda fuera de la previsión, da igual que tenga disponibilidad o tareas.
  assert.equal(enabled.workers.length, 0, '0-hour worker is excluded even with availability and opt-in rule');
  assert.ok(enabled.issues.some(i => i.code === 'zero-hour-rule-excluded'), 'exclusion is visible in criteria');
  const disabled = await readStaffingDataset(fixture(tables), 's', day, day, { ...rules, useHabitualCollaborators: false });
  assert.equal(disabled.workers.length, 0, '0-hour worker is excluded without opt-in too');
  assert.ok(disabled.issues.some(i => i.code === 'zero-hour-rule-excluded'));
  console.log('PASS 0-hour workers excluded from forecast even with availability and opt-in rule');
}
async function exactClockAndDiagnostics() {
  const result = await readStaffingDataset(fixture({ properties: [{ ...property, duracion_servicio: null }], tasks: [{ ...task, start_time: '07:00:30', end_time: '11:30:30' }], recurring_tasks: [recurrence] }), 's', day, day, rules);
  assert.deepEqual([result.services[0].startMinute, result.services[0].endMinute], [420.5, 690.5], 'shift clocks preserve seconds instead of silently rounding');
  assert.ok(!result.issues.some(i => i.code === 'task-duration-assumption'), 'confirmed shift own duration is not an apartment fallback');
  assert.ok(result.issues.find(i => i.code === 'duration-assumption')?.message.includes('jornadas'), 'global margin explanation must explicitly exempt shifts');
  console.log('PASS exact shift seconds and separate duration-model diagnostics');
}
export async function run() { await fixedShifts(); await invalidShifts(); await scopeAndCenters(); await noRoomRecalculation(); await materializationAndMargins(); await collaboratorRuleForwarding(); await exactClockAndDiagnostics(); }
