import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapStaffingWorkers } from '../src/features/staffing/dataWorkers';
import type { StaffingRow } from '../src/features/staffing/data';
import { buildStaffingForecast } from '../src/features/staffing/engine';
import type { StaffingDataset, StaffingOptions, StaffingService, StaffingWorker } from '../src/features/staffing/types';

const options: StaffingOptions = { dateFrom: '2026-09-14', weeks: 1, asOf: '2026-09-14', lateReservePercent: 0, travelMinutes: 15, seasonalPercent: 0 };
const worker = (id: string, patch: Partial<StaffingWorker> = {}): StaffingWorker => ({ id, name: id, weeklyMinutes: 120, homeCenterIds: ['a'], availability: Array.from({ length: 7 }, (_, day) => ({ day, startMinute: 480, endMinute: 600 })), restDay: 0, flexibleRest: false, canMove: true, unavailableDates: [], confirmedRestDates: [], costPerHour: 10, ...patch });
const service = (id = 's', patch: Partial<StaffingService> = {}): StaffingService => ({ id, centerId: 'a', date: '2026-09-14', startMinute: 480, endMinute: 540, personMinutes: 60, requiredWorkers: 1, kind: 'checkout', source: 'task', ...patch });
const forecast = (workers: StaffingWorker[], services: StaffingService[] = [], overrides: Partial<StaffingOptions> = {}) => {
  const dataset: StaffingDataset = { workers, services, centers: [{ id: 'a', name: 'A', startMinute: 480, endMinute: 600 }], issues: [], inventory: [], fetchedAt: options.asOf };
  return buildStaffingForecast(dataset, { ...options, ...overrides });
};
test('engine includes collaborator capacity once and keeps contract totals employee-only including overrides and absence', () => {
  const employee = worker('e');
  const collaborator = worker('c', { engagement: 'collaborator', weeklyMinutes: 720 });
  const mixed = forecast([employee, collaborator]);
  assert.equal(mixed.weeks[0].contractedMinutes, 120);
  assert.equal(mixed.weeks[0].collaboratorCapacityMinutes, 720);
  assert.equal(mixed.weeks[0].capacityMinutes, 840);
  assert.equal(forecast([{ ...collaborator, weeklyMinutes: 90 }]).weeks[0].contractedMinutes, 0);
  assert.equal(forecast([{ ...collaborator, weeklyMinutes: 90 }]).weeks[0].collaboratorCapacityMinutes, 90);
  const absentCollaborator = forecast([employee, collaborator], [], { absenceWorkerId: 'c' });
  assert.equal(absentCollaborator.weeks[0].collaboratorCapacityMinutes, 0);
  assert.equal(absentCollaborator.weeks[0].capacityMinutes, 120);
  const absentEmployee = forecast([employee, collaborator], [], { absenceWorkerId: 'e' });
  assert.equal(absentEmployee.weeks[0].contractedMinutes, 120);
  assert.equal(absentEmployee.weeks[0].capacityMinutes, 720);
  assert.equal(forecast([employee]).weeks[0].collaboratorCapacityMinutes, 0);
});

test('collaborator service activity makes total cost unknown even with a supplied hourly salary rate', () => {
  const employee = worker('z-employee');
  for (const rate of [undefined, 0, 25]) {
    const collaborator = worker('a-collaborator', { engagement: 'collaborator', weeklyMinutes: 720, costPerHour: rate });
    const used = forecast([employee, collaborator], [service()]);
    assert.equal(used.days[0].assignments[0].workerId, collaborator.id);
    assert.equal(used.weeks[0].cost, null, 'do not report employee subtotal as total or price all available hours');
    assert.ok(used.issues.some(i => i.code === 'collaborator-cost-unconfirmed'));
    assert.equal(forecast([employee, collaborator]).weeks[0].cost, 20, 'unused availability is not payroll');
    assert.equal(forecast([employee, collaborator], [], { absenceWorkerId: employee.id }).weeks[0].cost, 20, 'absence retains employee payroll');
    const external = { ...collaborator, blockedSlots: [{ day: 1, startMinute: 480, endMinute: 540, consumesContract: true }] };
    assert.equal(forecast([employee, external]).weeks[0].cost, null, 'known collaborator work also has unconfirmed service cost');
    assert.equal(forecast([collaborator], [service()]).weeks[0].cost, null);
  }
});

test('availability alone never creates capacity: 0-hour workers are excluded entirely', () => {
  for (const flag of [true, false, undefined]) {
    const source = inputs({ useHabitualCollaborators: flag });
    assert.equal(mapStaffingWorkers(source).length, 0, `0 h ficha + availability is excluded (flag ${String(flag)})`);
    assert.ok(source.issues.some(i => i.code === 'zero-hour-rule-excluded'), 'exclusion is visible in criteria');
  }
  const [twenty] = mapStaffingWorkers(inputs({ useHabitualCollaborators: true, workers: [{ id: 'c', is_active: true, contract_hours_per_week: 20 }] }));
  assert.equal(twenty.weeklyMinutes, 1200, 'ficha hours still create capacity');
});

const inputs = (patch: Partial<Parameters<typeof mapStaffingWorkers>[0]> = {}): Parameters<typeof mapStaffingWorkers>[0] => ({
  workers: [{ id: 'c', name: 'Synthetic collaborator', is_active: true, contract_hours_per_week: null, contract_type: 'full-time' }],
  availability: Array.from({ length: 7 }, (_, day_of_week) => ({ cleaner_id: 'c', day_of_week, start_time: '08:00', end_time: '10:00', is_available: true })),
  rests: [{ cleaner_id: 'c', is_active: true, day_of_week: 0 }], staffing: [], absences: [], maintenance: [], maintenanceTypes: [], contracts: [], planning: [],
  groupIds: ['a'], from: '2026-09-14', to: '2026-09-20', issues: [], allowCrossCenterMobility: true, ...patch,
});
test('0-hour workers are out of capacity and candidates; their assigned work stays as load', () => {
  const source = inputs({ useHabitualCollaborators: true, absences: [{ cleaner_id: 'c', start_date: '2026-09-14', end_date: '2026-09-14' }] });
  const mapped = mapStaffingWorkers(source);
  assert.equal(mapped.length, 0, 'availability, rest and absence rows do not resurrect a 0-hour worker');
  assert.ok(source.issues.some(i => i.code === 'zero-hour-rule-excluded'), 'exclusion is visible in criteria');
  const result = forecast(mapped, [service(), service('rest', { date: '2026-09-20' })]);
  assert.equal(result.weeks[0].collaboratorCapacityMinutes, 0);
  assert.equal(result.weeks[0].uncoveredMinutes, 120, 'their assigned work remains demand to cover');
  for (const patch of [{ confirmedRestDates: [options.dateFrom] }, { unavailableDates: [options.dateFrom] }, { activeFrom: '2026-09-15' }, { activeTo: '2026-09-13' }, { blockedSlots: [{ day: 1, startMinute: 480, endMinute: 540, consumesContract: false }] }, { excludedCenterIds: ['a'] }]) {
    const restricted = forecast([worker('c', { engagement: 'collaborator', ...patch })], [service()]);
    assert.equal(restricted.days[0].assignments.length, 0);
  }
});
test('collaborator visible-week capacity subtracts union blocks once and clips dates/daily limits', () => {
  const c = worker('c', { engagement: 'collaborator', weeklyMinutes: 720, maxDailyMinutes: 90,
    blockedSlots: [{ day: 1, startMinute: 480, endMinute: 510, consumesContract: true }, { day: 1, startMinute: 495, endMinute: 525, consumesContract: true }] });
  const bounded = forecast([c]);
  assert.equal(bounded.weeks[0].collaboratorCapacityMinutes, 495, 'Monday45 + five days90, paid overlap union45');
  assert.equal(bounded.weeks[0].capacityMinutes, 495);
  const partial = forecast([worker('c', { engagement: 'collaborator', weeklyMinutes: 720 })], [], { dateFrom: '2026-09-16' });
  assert.deepEqual(partial.weeks.map(w => w.collaboratorCapacityMinutes), [480, 240]);
  assert.deepEqual(partial.weeks.map(w => w.contractedMinutes), [0, 0]);
  const paidOutside = forecast([worker('c', { engagement: 'collaborator', weeklyMinutes: 120, blockedSlots: [{ day: 1, startMinute: 480, endMinute: 540, consumesContract: true }] })], [], { dateFrom: '2026-09-16' });
  assert.equal(paidOutside.weeks[0].collaboratorCapacityMinutes, 60, 'external work before visible range consumes same week operational budget');
});
test('collaborator assignments preserve indivisibility, overlaps, six days and weekly/daily budgets', () => {
  const c = worker('c', { engagement: 'collaborator', weeklyMinutes: 720 });
  const days = ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20'];
  const result = forecast([c], days.flatMap((date, i) => [service(`day${i}`, { date }), service(`overlap${i}`, { date })]));
  assert.equal(result.days.flatMap(d => d.assignments).length, 6);
  assert.equal(result.weeks[0].contractedMinutes, 0);
  assert.equal(forecast([{ ...c, maxDailyMinutes: 30 }], [service()]).days[0].assignments.length, 0);
  assert.equal(forecast([{ ...c, weeklyMinutes: 90 }], [service(), service('next', { date: '2026-09-15' })]).weeks[0].uncoveredMinutes, 60);
  const adjacent = worker('c', { engagement: 'collaborator', weeklyMinutes: 720, flexibleRest: true, confirmedRestDates: ['2026-09-14', '2026-09-27'] });
  const dates = ['2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20', '2026-09-21'];
  const continuity = forecast([adjacent], dates.map((date, i) => service(String(i), { date })), { weeks: 2 });
  assert.equal(continuity.days.flatMap(d => d.assignments).length, 6);
});
test('invalid or duplicate collaborator input is quarantined without making a labour contract', () => {
  const c = worker('c', { engagement: 'collaborator', weeklyMinutes: 720 });
  for (const patch of [{ weeklyMinutes: NaN }, { weeklyMinutes: Infinity }, { weeklyMinutes: -1 }, { availability: [] }]) {
    const result = forecast([{ ...c, ...patch }], [service()]);
    assert.equal(result.weeks[0].collaboratorCapacityMinutes, 0);
    assert.equal(result.weeks[0].contractedMinutes, 0);
    assert.ok(result.issues.some(i => i.code === 'incomplete-worker'));
  }
  const missingRest = forecast([{ ...c, restDay: null }]);
  assert.equal(missingRest.weeks[0].collaboratorCapacityMinutes, 720);
  assert.ok(!missingRest.issues.some(i => i.code === 'incomplete-worker'));
  const duplicate = forecast([c, { ...c }], [service()]);
  assert.equal(duplicate.weeks[0].collaboratorCapacityMinutes, 0);
  assert.equal(duplicate.weeks[0].contractedMinutes, 0);
  assert.ok(duplicate.issues.some(i => i.code === 'duplicate-worker'));
});

test('ficha and contract hours are the only capacity sources; 0 h or invalid never count', () => {
  for (const hours of [null, 0, -1, NaN, Infinity, -Infinity]) {
    const source = inputs({ useHabitualCollaborators: true, workers: [{ id: 'c', is_active: true, contract_hours_per_week: hours } as StaffingRow] });
    // Regla de Dani: ni disponibilidad ni tareas dan capacidad; solo ficha o contrato con horas.
    assert.equal(mapStaffingWorkers(source).length, 0, `${String(hours)} never creates capacity nor presence`);
  }
  const [twenty] = mapStaffingWorkers(inputs({ workers: [{ id: 'c', is_active: true, contract_hours_per_week: 20 }] }));
  assert.notEqual(twenty.engagement, 'collaborator');
  assert.equal(twenty.weeklyMinutes, 1200);
  const [contract] = mapStaffingWorkers(inputs({ workers: [{ id: 'c', is_active: true, contract_hours_per_week: 0 }], contracts: [{ id: 'k', cleaner_id: 'c', is_active: true, status: 'active', start_date: '2026-01-01', end_date: null, contract_hours_per_week: 40 }] }));
  assert.equal(contract.weeklyMinutes, 2400, 'active contract with hours counts even with ficha 0');
});

test('active contract takes precedence over habitual collaborator opt-in and supplies its hours', () => {
  const source = inputs({
    useHabitualCollaborators: true,
    workers: [{ id: 'c', is_active: true, contract_hours_per_week: 20, contract_type: 'full-time' }],
    contracts: [{ id: 'contract', cleaner_id: 'c', is_active: true, status: 'active', start_date: '2026-01-01', end_date: null, contract_hours_per_week: 40 }],
  });
  const [mapped] = mapStaffingWorkers(source);
  assert.equal(mapped.engagement, 'employee');
  assert.equal(mapped.weeklyMinutes, 2400);
  assert.ok(source.issues.some(i => i.code === 'contract-current-assumption'));
  assert.ok(!source.issues.some(i => i.code === 'habitual-collaborator-availability'));
});
