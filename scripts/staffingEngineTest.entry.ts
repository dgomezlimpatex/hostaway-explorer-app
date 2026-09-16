import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildStaffingForecast } from '../src/features/staffing/engine';
import type { StaffingDataset, StaffingOptions, StaffingService, StaffingWorker } from '../src/features/staffing/types';
const options: StaffingOptions = { dateFrom: '2026-09-14', weeks: 1, asOf: '2026-09-14', lateReservePercent: 0, travelMinutes: 15, seasonalPercent: 0 };
const worker = (id = 'w1', patch: Partial<StaffingWorker> = {}): StaffingWorker => ({ id, name: id, weeklyMinutes: 2400, homeCenterIds: ['a'], availability: Array.from({ length: 7 }, (_, day) => ({ day, startMinute: 480, endMinute: 1080 })), restDay: 0, flexibleRest: false, canMove: true, unavailableDates: [], confirmedRestDates: [], ...patch });
const service = (id = 's1', patch: Partial<StaffingService> = {}): StaffingService => ({ id, centerId: 'a', date: '2026-09-14', personMinutes: 60, startMinute: 600, endMinute: 660, requiredWorkers: 1, source: 'task', kind: 'checkout', ...patch });
const dataset = (services: StaffingService[] = [], workers: StaffingWorker[] = []): StaffingDataset => ({ centers: [{ id: 'a', name: 'A', startMinute: 480, endMinute: 1080 }, { id: 'b', name: 'B', startMinute: 480, endMinute: 1080 }], workers, services, issues: [], inventory: [], fetchedAt: '2026-09-14T10:00:00Z' });
test('assigns a known service inside its date window with habitual preference', () => {
    const result = buildStaffingForecast(dataset([service()], [worker('z-home'), worker('a-support', { homeCenterIds: ['b'] })]), options);
    assert.deepEqual(result.days[0].assignments, [{ serviceId: 's1', workerId: 'z-home', centerId: 'a', date: '2026-09-14', startMinute: 600, endMinute: 660, personMinutes: 60, support: false, estimated: false }]);
    assert.equal(result.weeks[0].knownMinutes, 60);
    assert.equal(result.centers[0].status, 'covered');
});
test('shared worker cannot overlap services between centers', () => {
    const result = buildStaffingForecast(dataset([service(), service('s2', { centerId: 'b' })], [worker()]), options);
    assert.equal(result.days[0].assignments.length, 1);
    assert.equal(result.days[0].uncoveredMinutes, 60);
    assert.match(result.days[0].reasons.join(' '), /heurística/);
});
test('weekly contract limits cumulative assignments across dates', () => {
    const result = buildStaffingForecast(dataset([service(), service('s2', { date: '2026-09-15' })], [worker('w1', { weeklyMinutes: 90 })]), options);
    assert.equal(result.weeks[0].uncoveredMinutes, 60);
    assert.equal(result.weeks[0].contractedMinutes, 90);
    assert.equal(result.weeks[0].capacityMinutes, 90);
});
test('team effort requires simultaneous workers inside the same window', () => {
    const s = service('team', { requiredWorkers: 2, personMinutes: 120 });
    const ok = buildStaffingForecast(dataset([s], [worker('w1'), worker('w2')]), options);
    assert.equal(ok.days[0].assignments.length, 2);
    assert.equal(new Set(ok.days[0].assignments.map(a => a.workerId)).size, s.requiredWorkers);
    assert.ok(ok.days[0].assignments.every(a => a.startMinute === 600 && a.endMinute === 660 && a.personMinutes === 60));
    const fail = buildStaffingForecast(dataset([s], [worker()]), options);
    assert.equal(fail.days[0].assignments.length, 0);
    assert.equal(fail.days[0].uncoveredMinutes, 120);
});
test('duplicate identities are quarantined without doubling teams, demand or centers', () => {
    for (const conflicting of [false, true]) {
        const w = worker('duplicate', { weeklyMinutes: 60 });
        const ds = dataset([service('team', { requiredWorkers: 2, personMinutes: 120 })], [w, { ...w, weeklyMinutes: conflicting ? 120 : 60 }]);
        const result = buildStaffingForecast(ds, options);
        assert.equal(result.days[0].assignments.length, 0);
        assert.equal(result.centers[0].status, 'unknown');
        assert.equal(result.weeks[0].capacityMinutes, 0);
        assert.equal(result.weeks[0].contractedMinutes, 0);
        assert.ok(result.issues.some(i => i.code === 'duplicate-worker'));
        const ss = dataset([service('duplicate'), service('duplicate', { centerId: conflicting ? 'b' : 'a', startMinute: 660, endMinute: 720 })], [worker()]);
        const services = buildStaffingForecast(ss, options);
        assert.equal(services.days[0].assignments.length, 0);
        assert.equal(services.weeks[0].knownMinutes, 0);
        assert.ok(services.centers.filter(c => c.centerId === 'a' || conflicting).every(c => c.status === 'unknown'));
        assert.ok(services.issues.some(i => i.code === 'duplicate-service'));
        const cs = dataset([service()], [worker('w', { canMove: false })]);
        cs.centers.push({ ...cs.centers[0], endMinute: conflicting ? 650 : 1080 });
        const centers = buildStaffingForecast(cs, options);
        assert.equal(centers.days[0].assignments.length, 0);
        assert.equal(centers.centers.filter(c => c.centerId === 'a').length, 1);
        assert.equal(centers.centers[0].status, 'unknown');
        assert.equal(centers.weeks[0].capacityMinutes, 0);
        assert.ok(centers.issues.some(i => i.code === 'duplicate-center'));
    }
});
test('invalid windows and missing duration never produce confident coverage', () => {
    for (const s of [service('bad', { endMinute: 630 }), service('bad', { personMinutes: 0 }), service('bad', { startMinute: NaN })]) {
        const result = buildStaffingForecast(dataset([s], [worker()]), options);
        assert.equal(result.days[0].assignments.length, 0);
        assert.equal(result.centers[0].status, 'unknown');
        assert.ok(result.issues.some(i => i.code === 'invalid-service'));
        assert.ok(Number.isFinite(result.weeks[0].knownMinutes));
    }
});
test('original service and center windows are validated before intersection', () => {
    const invalid = [{ startMinute: null as unknown as number }, { startMinute: -50 }, { endMinute: Infinity }, { endMinute: 1500 }];
    for (const patch of invalid) for (const target of ['service', 'center']) {
        const ds = dataset([service('bad', target === 'service' ? patch : {})], [worker()]);
        if (target === 'center') Object.assign(ds.centers[0], patch);
        const result = buildStaffingForecast(ds, options);
        assert.equal(result.days[0].assignments.length, 0, `${target}: ${JSON.stringify(patch)}`);
        assert.equal(result.centers[0].status, 'unknown');
        assert.ok(result.issues.some(i => i.code === 'invalid-service'));
        assert.ok(Number.isFinite(result.weeks[0].capacityMinutes));
    }
});
test('availability and fixed or confirmed rest block assignments', () => {
    for (const patch of [{ restDay: 1 }, { confirmedRestDates: ['2026-09-14'] }, { unavailableDates: ['2026-09-14'] }, { availability: [{ day: 1, startMinute: 660, endMinute: 800 }] }, { activeFrom: '2026-09-15' }, { activeTo: '2026-09-13' }]) {
        const result = buildStaffingForecast(dataset([service()], [worker('w', patch)]), options);
        assert.equal(result.days[0].assignments.length, 0);
    }
    const rest = buildStaffingForecast(dataset([service()], [worker('w', { restDay: 1 })]), options);
    assert.deepEqual(rest.days[0].rests, [{ workerId: 'w', proposed: false }]);
});
test('missing worker availability or invalid budget leaves coverage unknown; missing rest retains potential capacity', () => {
    for (const patch of [{ availability: [] }, { weeklyMinutes: NaN }]) {
        const result = buildStaffingForecast(dataset([service()], [worker('missing', patch), worker('valid')]), options);
        assert.equal(result.centers[0].status, 'unknown');
        assert.ok(result.issues.some(i => i.code === 'incomplete-worker'));
        assert.ok(Number.isFinite(result.weeks[0].capacityMinutes));
    }
    const missingRest = buildStaffingForecast(dataset([service()], [worker('missing', { restDay: null }), worker('valid')]), options);
    assert.equal(missingRest.centers[0].status, 'covered');
    assert.ok(!missingRest.issues.some(i => i.code === 'incomplete-worker'));
});
test('flexible rest selects a low-load date but never moves confirmed rest', () => {
    const services = Array.from({ length: 7 }, (_, i) => service(`s${i}`, { date: `2026-09-${14 + i}`, personMinutes: i === 2 ? 15 : 60 }));
    const result = buildStaffingForecast(dataset(services, [worker('flex', { restDay: 1, flexibleRest: true })]), options);
    assert.deepEqual(result.days[2].rests, [{ workerId: 'flex', proposed: true }]);
    assert.equal(result.days[0].assignments.length, 1);
    assert.equal(result.weeks[0].uncoveredMinutes, 15);
    const confirmed = buildStaffingForecast(dataset(services, [worker('flex', { flexibleRest: true, confirmedRestDates: ['2026-09-14'] })]), options);
    assert.equal(confirmed.days[0].assignments.length, 0);
    assert.deepEqual(confirmed.days[0].rests, [{ workerId: 'flex', proposed: false }]);
});
test('rest continuity prevents seven working days across week boundaries', () => {
    const dates = Array.from({ length: 14 }, (_, i) => `2026-09-${14 + i}`);
    const services = dates.map((date, i) => service(`s${i}`, { date, personMinutes: i === 0 || i === 13 ? 15 : 60 }));
    const result = buildStaffingForecast(dataset(services, [worker('flex', { flexibleRest: true })]), { ...options, weeks: 2 });
    for (let i = 0; i <= 7; i++)
        assert.ok(result.days.slice(i, i + 7).some(d => d.assignments.length === 0));
    assert.ok(result.days.some(d => d.reasons.some(r => /seis|6/.test(r))));
});
test('travel requires a gap and consumes weekly contract', () => {
    const first = service('first');
    const next = service('next', { centerId: 'b', startMinute: 660, endMinute: 735 });
    const result = buildStaffingForecast(dataset([first, next], [worker()]), options);
    assert.equal(result.days[0].assignments[1]?.startMinute, 675);
    assert.equal(result.days[0].assignments[1]?.endMinute, 735);
    const tight = buildStaffingForecast(dataset([first, { ...next, endMinute: 720 }], [worker()]), options);
    assert.equal(tight.days[0].uncoveredMinutes, 60);
    const budget = buildStaffingForecast(dataset([first, next], [worker('w', { weeklyMinutes: 120 })]), options);
    assert.equal(budget.days[0].uncoveredMinutes, 60);
});
test('hard mobility exceptions and simulated absence remove eligibility', () => {
    const ds = dataset([service('b', { centerId: 'b' })], [worker('w', { canMove: false })]);
    assert.equal(buildStaffingForecast(ds, options).days[0].uncoveredMinutes, 60);
    assert.equal(buildStaffingForecast(dataset([service()], [worker()]), { ...options, absenceWorkerId: 'w1' }).days[0].uncoveredMinutes, 60);
});
test('excluded centers and partial absence slots are hard constraints', () => {
    const excluded = buildStaffingForecast(dataset([service()], [worker('w', { excludedCenterIds: ['a'] })]), options);
    assert.equal(excluded.days[0].uncoveredMinutes, 60);
    const blocked = buildStaffingForecast(dataset([service()], [worker('w', { blockedSlots: [{ date: '2026-09-14', startMinute: 600, endMinute: 630, consumesContract: false }] })]), options);
    assert.equal(blocked.days[0].uncoveredMinutes, 60);
});
test('paid maintenance consumes contract once and daily limits include work', () => {
    const slots = [{ day: 1, startMinute: 480, endMinute: 540, consumesContract: true }];
    const paid = buildStaffingForecast(dataset([service()], [worker('w', { weeklyMinutes: 90, blockedSlots: slots })]), options);
    assert.equal(paid.days[0].uncoveredMinutes, 60);
    const duplicate = buildStaffingForecast(dataset([service()], [worker('w', { weeklyMinutes: 120, blockedSlots: [...slots, ...slots] })]), options);
    assert.equal(duplicate.days[0].uncoveredMinutes, 0);
    assert.ok(duplicate.issues.some(i => i.code === 'maintenance-unreconciled'));
    const daily = buildStaffingForecast(dataset([service()], [worker('w', { maxDailyMinutes: 90, blockedSlots: slots })]), options);
    assert.equal(daily.days[0].uncoveredMinutes, 60);
});
test('constrained-first ordering preserves an indispensable home worker', () => {
    const ds = dataset([service('away', { centerId: 'b' }), service('home')], [worker('a-home'), worker('b-away', { homeCenterIds: ['b'], canMove: false })]);
    const result = buildStaffingForecast(ds, options);
    assert.equal(result.days[0].uncoveredMinutes, 0);
    assert.equal(result.days[0].assignments.find(a => a.serviceId === 'home')?.workerId, 'a-home');
    const constrained = dataset([service('away', { centerId: 'b' }), service('home')], [worker('a-home', { homeCenterIds: ['a', 'b'] }), worker('b-away', { homeCenterIds: ['b'], canMove: false })]);
    assert.equal(buildStaffingForecast(constrained, options).days[0].uncoveredMinutes, 0);
});
test('near reserve is provisional expected workload, not synthetic assignments or capacity', () => {
    const ds = dataset([service()], [worker()]);
    const result = buildStaffingForecast(ds, { ...options, lateReservePercent: 20 });
    assert.equal(result.days[0].knownMinutes, 60);
    assert.equal(result.days[0].estimatedMinutes, 12);
    assert.equal(result.days[0].uncoveredMinutes, 12);
    assert.ok(result.issues.some(i => i.code === 'provisional-reserve'));
    const fixed = buildStaffingForecast(dataset([service('f', { kind: 'fixed' })], [worker()]), { ...options, lateReservePercent: 20 });
    assert.equal(fixed.weeks[0].estimatedMinutes, 0);
});
test('fractional reserve and seasonal expectations never prove indivisible service coverage', () => {
    for (const seasonal of [false, true]) {
        const date = seasonal ? '2026-09-22' : options.dateFrom;
        const day = seasonal ? 2 : 1;
        const fragments = Array.from({ length: 5 }, (_, i) => ({ day, startMinute: 600 + i * 100, endMinute: 672 + i * 100 }));
        const ds = dataset(fragments.map((slot, i) => service(`base${i}`, { ...slot, date, receivedDate: '2026-09-01' })), [worker('w', { availability: fragments, weeklyMinutes: 360 })]);
        const result = buildStaffingForecast(ds, { ...options, weeks: 2, lateReservePercent: seasonal ? 0 : 20, seasonalPercent: seasonal ? 20 : 0 });
        const target = result.days.find(d => d.date === date)!;
        assert.equal(target.knownMinutes, 300);
        assert.equal(target.estimatedMinutes, 60);
        assert.equal(result.centers.find(c => c.centerId === 'a' && c.knownMinutes > 0)?.status, 'unknown');
        assert.equal(target.assignments.length, 5);
        assert.ok(target.assignments.every(a => !a.estimated && a.personMinutes === 60));
        assert.equal(target.uncoveredMinutes, 60);
        assert.ok(result.issues.some(i => i.code === 'estimated-coverage-unverified'));
        const actual = buildStaffingForecast({ ...ds, services: [...ds.services, service('whole-extra', { date, startMinute: 480, endMinute: 1080 })] }, { ...options, weeks: 2 });
        assert.equal(actual.days.find(d => d.date === date)?.uncoveredMinutes, 60);
    }
});
test('received dates reconstruct D-7 baseline and additions consume reserve', () => {
    const base = Array.from({ length: 5 }, (_, i) => service(`old${i}`, { date: '2026-09-20', receivedDate: '2026-09-10', startMinute: 480, endMinute: 1080 }));
    const opt = { ...options, lateReservePercent: 20, asOf: '2026-09-17' };
    assert.equal(buildStaffingForecast(dataset(base, [worker('w', { restDay: 1 })]), opt).weeks[0].estimatedMinutes, 60);
    const late = service('late', { date: '2026-09-20', receivedDate: '2026-09-15' });
    const result = buildStaffingForecast(dataset([...base, late], [worker('w', { restDay: 1 })]), opt);
    assert.equal(result.weeks[0].knownMinutes, 360);
    assert.equal(result.weeks[0].estimatedMinutes, 0);
    assert.ok(result.issues.some(i => i.code === 'reserve-baseline'));
});
test('long-horizon seasonal scenario is separate from near-term reserve', () => {
    const ds = dataset([service('near', { date: '2026-09-21' }), service('far', { date: '2026-09-22' }), service('fixed', { date: '2026-09-23', kind: 'fixed' })], [worker()]);
    const result = buildStaffingForecast(ds, { ...options, weeks: 2, lateReservePercent: 20, seasonalPercent: 50 });
    assert.equal(result.days.find(d => d.date === '2026-09-21')?.estimatedMinutes, 12);
    assert.equal(result.days.find(d => d.date === '2026-09-22')?.estimatedMinutes, 30);
    assert.equal(result.days.find(d => d.date === '2026-09-23')?.estimatedMinutes, 0);
    assert.ok(result.issues.some(i => i.code === 'seasonal-scenario'));
    assert.ok(result.centers.filter(c => c.centerId === 'b').every(c => c.status === 'unknown'));
});
test('capacity uses available service windows and contract, missing cost stays null', () => {
    const ds = dataset([service()], [worker('w', { weeklyMinutes: 2400, availability: [{ day: 1, startMinute: 600, endMinute: 720 }], costPerHour: 15 })]);
    const result = buildStaffingForecast(ds, options);
    assert.equal(result.weeks[0].capacityMinutes, 120);
    assert.equal(result.days[0].capacityMinutes, 120);
    assert.equal(result.weeks[0].idleMinutes, 60);
    assert.equal(result.weeks[0].cost, 600);
    ds.workers[0].costPerHour = undefined;
    assert.equal(buildStaffingForecast(ds, options).weeks[0].cost, null);
});
test('input issues prevent false green and forecast is deterministic without mutation', () => {
    const ds = dataset([service('z', { endMinute: 800 }), service('a', { endMinute: 800 })], [worker('z'), worker('a')]);
    ds.issues.push({ code: 'missing-source', centerId: 'a', message: 'Reservas incompletas' });
    const before = JSON.stringify(ds);
    const result = buildStaffingForecast(ds, options);
    assert.equal(result.centers[0].status, 'unknown');
    assert.equal(JSON.stringify(ds), before);
    assert.deepEqual(buildStaffingForecast(ds, options), result);
    const shuffled = { ...ds, services: [...ds.services].reverse(), workers: [...ds.workers].reverse() };
    assert.deepEqual(buildStaffingForecast(shuffled, options).days, result.days);
});
test('paid blocks outside the visible range consume the calendar-week budget', () => {
    const result = buildStaffingForecast(dataset([service('thu', { date: '2026-09-17' })], [worker('w', { weeklyMinutes: 90, blockedSlots: [{ day: 1, startMinute: 480, endMinute: 540, consumesContract: true }] })]), { ...options, dateFrom: '2026-09-17' });
    assert.equal(result.days[0].uncoveredMinutes, 60);
    assert.ok(result.issues.some(i => i.code === 'boundary-history'));
});
test('paid maintenance workdays participate in consecutive-day safety', () => {
    const slots = Array.from({ length: 6 }, (_, day) => ({ date: `2026-09-${String(8 + day).padStart(2, '0')}`, startMinute: 480, endMinute: 540, consumesContract: true }));
    const result = buildStaffingForecast(dataset([service()], [worker('w', { restDay: 2, blockedSlots: slots })]), options);
    assert.equal(result.days[0].uncoveredMinutes, 60);
});
test('a compatible slot starts after a partial unavailability ends', () => {
    const ds = dataset([service('later', { endMinute: 720 })], [worker('w', { blockedSlots: [{ day: 1, startMinute: 590, endMinute: 630, consumesContract: false }] })]);
    const result = buildStaffingForecast(ds, options);
    assert.equal(result.days[0].assignments[0]?.startMinute, 630);
    assert.equal(result.days[0].uncoveredMinutes, 0);
});
test('travel itself cannot cross a blocked availability gap', () => {
    const ds = dataset([service('first'), service('next', { centerId: 'b', startMinute: 675, endMinute: 735 })], [worker('w', { blockedSlots: [{ day: 1, startMinute: 660, endMinute: 675, consumesContract: false }] })]);
    assert.equal(buildStaffingForecast(ds, options).days[0].uncoveredMinutes, 60);
});
test('unknown center or center window conflict cannot be scheduled', () => {
    const ds = dataset([service('outside', { startMinute: 450, endMinute: 510 })], [worker('w', { availability: [{ day: 1, startMinute: 400, endMinute: 800 }] })]);
    assert.equal(buildStaffingForecast(ds, options).days[0].assignments.length, 0);
    ds.services = [service('orphan', { centerId: 'missing' })];
    const result = buildStaffingForecast(ds, options);
    assert.equal(result.days[0].assignments.length, 0);
    assert.ok(result.issues.some(i => i.code === 'invalid-service'));
});
test('malformed options are rejected instead of producing NaN or unbounded horizons', () => {
    for (const patch of [{ weeks: Infinity }, { weeks: -1 }, { weeks: 0.5 }, { travelMinutes: -1 }, { lateReservePercent: NaN }, { seasonalPercent: -1 }, { dateFrom: '2026-02-30' }]) {
        assert.throws(() => buildStaffingForecast(dataset(), { ...options, ...patch }), RangeError);
    }
});
test('malformed worker blocks are excluded rather than creating false capacity', () => {
    for (const patch of [{ maxDailyMinutes: NaN }, { blockedSlots: [{ day: 1, startMinute: NaN, endMinute: 660, consumesContract: false }] }, { activeFrom: '2026-02-30' }]) {
        const result = buildStaffingForecast(dataset([service()], [worker('w', patch)]), options);
        assert.equal(result.days[0].assignments.length, 0);
        assert.equal(result.centers[0].status, 'unknown');
        assert.ok(result.issues.some(i => i.code === 'incomplete-worker'));
    }
});
test('invalid service dates cannot silently disappear behind other covered services', () => {
    const result = buildStaffingForecast(dataset([service('valid'), service('bad', { date: '2026-02-30' })], [worker()]), options);
    assert.equal(result.centers[0].status, 'unknown');
    assert.ok(result.issues.some(i => i.code === 'invalid-service-date'));
});
test('known workload is prioritized before earlier estimated workload in the same week', () => {
    const ds = dataset([service('early', { endMinute: 900 }), service('later', { date: '2026-09-15' })], [worker('w', { weeklyMinutes: 120 })]);
    const result = buildStaffingForecast(ds, { ...options, lateReservePercent: 20 });
    assert.equal(result.days.flatMap(d => d.assignments).filter(a => !a.estimated).length, 2);
    assert.equal(result.days.flatMap(d => d.assignments).filter(a => a.estimated).length, 0);
});
test('multiworker availability requires a common simultaneous interval', () => {
    const ds = dataset([service('team', { requiredWorkers: 2, personMinutes: 120, endMinute: 720 })], [worker('first', { availability: [{ day: 1, startMinute: 600, endMinute: 660 }] }), worker('second', { availability: [{ day: 1, startMinute: 660, endMinute: 720 }] })]);
    assert.equal(buildStaffingForecast(ds, options).days[0].uncoveredMinutes, 120);
});
test('habitual worker is preferred when a later slot still fits the window', () => {
    const ds = dataset([service('flex-window', { endMinute: 780 })], [worker('home', { availability: [{ day: 1, startMinute: 660, endMinute: 780 }] }), worker('support', { homeCenterIds: ['b'] })]);
    const assignment = buildStaffingForecast(ds, options).days[0].assignments[0];
    assert.equal(assignment.workerId, 'home');
    assert.equal(assignment.startMinute, 660);
});
test('unexpected absence removes capacity but does not erase contracted pay', () => {
  const ds = dataset([service()], [worker('w', { costPerHour: 15 })]);
  const result = buildStaffingForecast(ds, { ...options, absenceWorkerId: 'w' });
  assert.equal(result.weeks[0].capacityMinutes, 0);
  assert.equal(result.weeks[0].contractedMinutes, 2400);
  assert.equal(result.weeks[0].cost, 600);
});

test('twelve-week synthetic schedule respects per-worker overlaps and weekly budgets', () => {
  const dates = Array.from({ length: 84 }, (_, i) => new Date(Date.UTC(2026, 8, 14 + i)).toISOString().slice(0, 10));
  const ds = dataset(dates.flatMap((date, i) => Array.from({ length: 4 }, (_, j) => service(`s${i}-${j}`, { date, centerId: j % 2 ? 'a' : 'b', startMinute: 540 + j * 75, endMinute: 720 + j * 75 }))), Array.from({ length: 8 }, (_, i) => worker(`w${i}`, { homeCenterIds: [i % 2 ? 'a' : 'b'] })));
  const started = performance.now();
  const result = buildStaffingForecast(ds, { ...options, weeks: 12, lateReservePercent: 20, seasonalPercent: 25 });
  assert.equal(result.days.length, 84);
  for (const day of result.days) for (const w of ds.workers) {
    const route = day.assignments.filter(a => a.workerId === w.id).sort((a, b) => a.startMinute - b.startMinute);
    for (let i = 1; i < route.length; i++) assert.ok(route[i].startMinute >= route[i - 1].endMinute + (route[i].centerId === route[i - 1].centerId ? 0 : options.travelMinutes));
  }
  for (const week of result.weeks) {
    assert.ok(week.capacityMinutes <= week.contractedMinutes + 1e-6);
    const end = new Date(`${week.week}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 7);
    for (const w of ds.workers) {
      const weekDays = result.days.filter(d => d.date >= week.week && d.date < end.toISOString().slice(0, 10));
      const paid = weekDays.reduce((total, day) => {
        const route = day.assignments.filter(a => a.workerId === w.id).sort((a, b) => a.startMinute - b.startMinute);
        return total + route.reduce((n, a, i) => n + a.personMinutes + (i && route[i - 1].centerId !== a.centerId ? options.travelMinutes : 0), 0);
      }, 0);
      assert.ok(paid <= w.weeklyMinutes + 1e-6);
    }
  }
  assert.ok(performance.now() - started < 500, 'bounded synthetic twelve-week runtime');
});

test('24-week / 20-worker / 2016-service forecast stays within the synchronous compute budget', () => {
    const dates = Array.from({ length: 168 }, (_, i) => new Date(Date.UTC(2026, 8, 14 + i)).toISOString().slice(0, 10));
    const ds = dataset(dates.flatMap((date, i) => Array.from({ length: 12 }, (_, j) => service(`s${i}-${j}`, { date, startMinute: 540 + (j % 4) * 75, endMinute: 720 + (j % 4) * 75 }))), Array.from({ length: 20 }, (_, i) => worker(`w${i}`)));
    ds.centers = ds.centers.slice(0, 1);
    const started = performance.now();
    const result = buildStaffingForecast(ds, { ...options, weeks: 24, lateReservePercent: 20, seasonalPercent: 25 });
    const elapsedMs = performance.now() - started;
    console.log('STAFFING_BENCHMARK', JSON.stringify({ weeks: 24, workers: ds.workers.length, services: ds.services.length, elapsedMs: Math.round(elapsedMs), assignments: result.days.reduce((n, d) => n + d.assignments.length, 0) }));
    assert.equal(result.days.length, 168);
    assert.equal(result.weeks.length, 24);
    assert.equal(result.weeks.reduce((n, w) => n + w.knownMinutes, 0), 120960);
    assert.ok(!result.issues.some(i => i.code === 'workload-limit'), 'representative fixture must finish, not hit a guard');
    assert.equal(result.days.flatMap(d => d.assignments).length, 1728);
    assert.ok(result.weeks.every(w => w.capacityMinutes <= w.contractedMinutes + 1e-6));
    assert.ok(elapsedMs < 500, `single engine call exceeded 500 ms: ${Math.round(elapsedMs)} ms`);
});
test('engine rejects horizons above 28 weeks and declines oversized input without partial totals', () => {
    assert.throws(() => buildStaffingForecast(dataset(), { ...options, weeks: 29 }), RangeError);
  assert.doesNotThrow(() => buildStaffingForecast(dataset(), { ...options, weeks: 28 }));
    const inputs = [
        dataset([], Array.from({ length: 101 }, (_, i) => worker(`w${i}`))),
        dataset(Array.from({ length: 10001 }, (_, i) => service(`s${i}`))),
        { ...dataset(), centers: Array.from({ length: 101 }, (_, i) => ({ id: `c${i}`, name: `C${i}`, startMinute: 480, endMinute: 1080 })) },
        dataset([], [worker('w', { availability: Array.from({ length: 513 }, () => ({ day: 1, startMinute: 480, endMinute: 1080 })) })]),
    ];
    for (const ds of inputs) {
        const result = buildStaffingForecast(ds, options);
        assert.deepEqual(result.days, []);
        assert.deepEqual(result.weeks, []);
        assert.ok(result.issues.some(i => i.code === 'workload-limit' && /incompleto/i.test(i.message)));
        assert.ok(result.centers.every(c => c.status === 'unknown'));
    }
});
test('elapsed-work deadline discards partial results and resets on the next forecast', (t) => {
    const ds = dataset(Array.from({ length: 2016 }, (_, i) => service(`s${i}`, { date: new Date(Date.UTC(2026, 8, 14 + Math.floor(i / 12))).toISOString().slice(0, 10), endMinute: 1080 })), Array.from({ length: 20 }, (_, i) => worker(`w${i}`)));
    const before = JSON.stringify(ds);
    for (const expireAfter of [1, 50, 500, 5000, 10000, 50000]) {
        let calls = 0;
        t.mock.method(performance, 'now', () => calls++ < expireAfter ? 0 : 201);
        try {
            const result = buildStaffingForecast(ds, { ...options, weeks: 24 });
            assert.equal(result.days.length, 0, `deadline after checkpoint ${expireAfter}`);
            assert.deepEqual(result.weeks, []);
            assert.ok(result.issues.some(i => i.code === 'workload-limit'));
            assert.equal(JSON.stringify(ds), before);
        } finally { t.mock.restoreAll(); }
    }
    assert.equal(buildStaffingForecast(dataset([service()], [worker()]), options).centers[0].status, 'covered');
});
test('dense in-limit workload actually stops at the real elapsed-work deadline', () => {
    const ds = dataset(Array.from({ length: 10000 }, (_, i) => service(`s${i}`, { personMinutes: 45, requiredWorkers: 3, startMinute: 480, endMinute: 1080 })), Array.from({ length: 100 }, (_, i) => worker(`w${i}`, { homeCenterIds: ['b'] })));
    const started = performance.now();
    const result = buildStaffingForecast(ds, { ...options, weeks: 24 });
    const elapsedMs = performance.now() - started;
    console.log('STAFFING_DEADLINE', JSON.stringify({ workers: ds.workers.length, services: ds.services.length, elapsedMs: Math.round(elapsedMs), incomplete: result.issues.some(i => i.code === 'workload-limit') }));
    assert.ok(result.issues.some(i => i.code === 'workload-limit'));
    assert.equal(result.days.length, 0);
    assert.equal(result.weeks.length, 0);
    assert.ok(elapsedMs < 350, `cooperative 200 ms deadline exceeded tolerance: ${Math.round(elapsedMs)} ms`);
});
test('empty demand remains unknown across Madrid DST calendar days', () => {
    const result = buildStaffingForecast(dataset(), { ...options, dateFrom: '2026-10-24T22:30:00Z' });
    assert.equal(result.days.length, 7);
    assert.equal(result.days[0].date, '2026-10-25');
    assert.equal(result.days[6].date, '2026-10-31');
    assert.equal(result.days[1].date, '2026-10-26');
    assert.ok(result.centers.every(c => c.status === 'unknown'));
    assert.ok(result.issues.some(i => i.code === 'empty-demand'));
    assert.ok(result.weeks.every(w => w.cost === null));
});