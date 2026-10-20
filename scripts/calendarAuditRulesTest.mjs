import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Real calendar helpers behind the audit fixes (CAL-07..CAL-15), with local
// fixtures only: no database, session or network.
const built = await build({
  stdin: { resolveDir: process.cwd(), loader: 'ts', contents: `
    export * as status from './src/utils/calendarTaskStatus';
    export * as shared from './src/utils/calendarSharedMove';
    export * as scale from './src/components/calendar/utils/timelineScale';
    export * as url from './src/components/calendar/utils/calendarUrlState';
    export * as search from './src/components/calendar/utils/calendarSearch';
    export * as display from './src/components/calendar/utils/calendarDisplay';
    export * as privacy from './src/components/calendar/utils/absencePrivacy';
    export * as availability from './src/utils/availabilityUtils';
    export * as positioning from './src/utils/taskPositioning';
    export * as resize from './src/components/calendar/utils/taskResize';
  ` },
  bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'silent', metafile: true,
});
assert.equal(Object.keys(built.metafile.inputs).some((path) => path.includes('integrations/supabase')), false);
const m = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));

const base = { date: '2026-10-05', address: '', type: 'limpieza', checkIn: '', checkOut: '', status: 'pending' };

// CAL-07: one displayed status, reports first; stored status otherwise.
assert.equal(m.status.getDisplayStatus({ status: 'completed', calendarStatus: 'pending' }), 'pending');
assert.equal(m.status.getDisplayStatus({ status: 'pending', calendarStatus: 'in_progress' }), 'in-progress');
assert.equal(m.status.getDisplayStatus({ status: 'completed' }), 'completed');

// CAL-01: who stays assigned after a drop.
assert.deepEqual(m.shared.resolveDropAssignment(['ana', 'carmen'], 'ana', 'ana'), { kind: 'keep-team', replacedCleanerId: 'ana', nextCleanerIds: ['ana', 'carmen'] });
assert.deepEqual(m.shared.resolveDropAssignment(['ana', 'carmen'], 'ana', 'berta'), { kind: 'replace-origin', replacedCleanerId: 'ana', nextCleanerIds: ['carmen', 'berta'] });
assert.deepEqual(m.shared.resolveDropAssignment(['ana', 'carmen'], 'ana', 'carmen'), { kind: 'keep-team', replacedCleanerId: 'carmen', nextCleanerIds: ['ana', 'carmen'] });
assert.deepEqual(m.shared.resolveDropAssignment(['ana'], 'ana', 'berta').nextCleanerIds, ['berta']);
assert.deepEqual(m.shared.resolveDropAssignment([], undefined, 'berta'), { kind: 'assign', nextCleanerIds: ['berta'] });
assert.deepEqual(m.shared.resolveDropAssignment(['ana', 'ana', null], 'zoe', 'berta'), { kind: 'assign', nextCleanerIds: ['berta'] }, 'unknown origin: single assignee');
// CAL-19: removing one person keeps the rest.
assert.deepEqual(m.shared.withoutCleaner(['ana', 'carmen'], 'carmen'), ['ana']);

// CAL-08: default 06:00–22:30, widened for early/late tasks.
assert.deepEqual(m.scale.getTimelineBounds([{ startTime: '09:00', endTime: '10:00' }]), { startMinutes: 360, endMinutes: 1350 });
assert.deepEqual(m.scale.getTimelineBounds([{ startTime: '05:30', endTime: '07:00' }, { startTime: '22:00', endTime: '23:30' }]), { startMinutes: 300, endMinutes: 1410 });
assert.deepEqual(m.scale.getTimelineBounds([{ startTime: '23:00', endTime: '01:00' }]).endMinutes, 1440, 'crossing midnight drawn to 24:00');
const wide = { startMinutes: 300, endMinutes: 1410, slotWidth: 50 };
assert.equal(m.scale.buildTimeSlots(wide)[0], '05:00');
assert.equal(m.scale.buildTimeSlots(wide).at(-1), '23:00');
assert.equal(m.scale.buildTimeSlots(m.scale.DEFAULT_SCALE).length, 33, 'same 33 default slots as before');
// The 05:30 task now starts inside the grid (left >= 0) and the 23:30 end fits.
const early = m.positioning.getTaskPositionWithOverlap('05:30', '07:00', { id: 'e' }, [], 'c1', [{ id: 'c1' }], undefined, wide);
assert.equal(early.left, '50px', '05:30 is one 30-min column after 05:00');
const late = m.positioning.getTaskPositionWithOverlap('22:00', '23:30', { id: 'l' }, [], 'c1', [{ id: 'c1' }], undefined, wide);
assert.ok(parseFloat(late.left) + late.widthPx <= m.scale.timelineWidthPx(wide));
// CAL-09: real width, so contiguous 30 min tasks never overlap in pixels.
const a = m.positioning.getTaskPositionWithOverlap('09:00', '09:30', { id: 'a' }, [], 'c1', [{ id: 'c1' }]);
const b = m.positioning.getTaskPositionWithOverlap('09:30', '10:30', { id: 'b' }, [], 'c1', [{ id: 'c1' }]);
assert.equal(parseFloat(a.left) + a.widthPx, parseFloat(b.left), 'no fake overlap');
assert.ok(a.widthPx < m.scale.COMPACT_CARD_PX, '30 min card uses the compact layout');
// Zoom keeps the resize gesture in step with the column width.
assert.equal(m.resize.getResizedEndTime('09:00', '10:00', 80, 80 / 30), '10:30');
assert.equal(m.resize.getResizedEndTime('09:00', '10:00', 50), '10:30', 'default scale unchanged');
// CAL-18: the initial scroll shows the target with one hour of context.
assert.equal(m.scale.getInitialScrollLeft(15 * 60, m.scale.DEFAULT_SCALE), (14 * 60 - 360) * (50 / 30));

// CAL-10: date, view, filters, search and zoom survive a reload.
const written = m.url.writeCalendarUrlState(new URLSearchParams('task=t1&other=x'), {
  date: '2026-11-02', view: 'week', clients: ['c1', 'c2'], cleaners: [], q: ' Ático ', zoom: 'wide',
});
assert.equal(written.toString(), 'task=t1&other=x&date=2026-11-02&view=week&clients=c1%2Cc2&q=%C3%81tico&zoom=wide');
assert.deepEqual(m.url.parseCalendarUrlState(written), {
  date: '2026-11-02', view: 'week', clients: ['c1', 'c2'], cleaners: [], q: 'Ático', zoom: 'wide', task: 't1',
});
const defaults = m.url.writeCalendarUrlState(new URLSearchParams(), { date: '2026-11-02', view: 'day', clients: [], cleaners: [], q: '', zoom: 'normal' });
assert.equal(defaults.toString(), 'date=2026-11-02', 'defaults stay out of the link');
const bad = m.url.parseCalendarUrlState(new URLSearchParams('date=2026-02-30&view=month&zoom=x'));
assert.deepEqual([bad.date, bad.view, bad.zoom], [undefined, undefined, undefined], 'invalid values ignored');

// CAL-11 (hypothesis confirmed in code): the search now applies to unassigned
// tasks; the cleaner filter keeps them (they have nobody) and the panel says so.
const tasks = [
  { ...base, id: 'u1', property: 'Ático Centro', startTime: '10:00', endTime: '11:00', clienteId: 'k1' },
  { ...base, id: 'u2', property: 'Bajo Playa', startTime: '09:00', endTime: '10:00', clienteId: 'k2' },
  { ...base, id: 'a1', property: 'Piso Norte', startTime: '09:00', endTime: '10:00', cleanerId: 'ana', clienteId: 'k1' },
];
const ids = (list) => list.map((t) => t.id);
assert.deepEqual(ids(m.search.filterCalendarTasks(tasks, { term: 'ático' })), ['u1']);
assert.deepEqual(ids(m.search.filterCalendarTasks(tasks, { term: 'ana', matchingCleanerIds: new Set(['ana']) })), ['a1']);
assert.deepEqual(ids(m.search.filterCalendarTasks(tasks, { cleanerIds: new Set(['berta']) })), ['u1', 'u2']);
assert.deepEqual(ids(m.search.filterCalendarTasks(tasks, { clientIds: new Set(['k1']) })), ['u1', 'a1']);

// CAL-12: unassigned queue by date and time (Zeta 08:00 before Alfa 16:00).
const queue = m.display.sortUnassignedTasks([
  { ...base, property: 'Alfa', startTime: '16:00' }, { ...base, property: 'Zeta', startTime: '08:00' },
  { ...base, date: '2026-10-04', property: 'Ayer', startTime: '18:00' }, { ...base, property: 'Beta', startTime: '08:00' },
]);
assert.deepEqual(queue.map((t) => t.property), ['Ayer', 'Beta', 'Zeta', 'Alfa']);

// CAL-14: the duplicate has nobody assigned and starts pending.
const copy = m.display.buildUnassignedDuplicate({
  ...base, id: 'orig', property: 'Piso', startTime: '09:00', endTime: '10:00', status: 'completed', calendarStatus: 'completed',
  cleaner: 'Ana, Carmen', cleanerId: 'ana', assignments: [{ cleaner_id: 'ana' }], assignmentCount: 2, created_at: 'x', updated_at: 'y',
});
for (const key of ['id', 'cleaner', 'cleanerId', 'assignments', 'assignmentCount', 'calendarStatus', 'created_at', 'updated_at']) {
  assert.equal(key in copy, false, `duplicate drops ${key}`);
}
assert.deepEqual([copy.property, copy.date, copy.startTime, copy.endTime, copy.status], ['Piso', '2026-10-05', '09:00', '10:00', 'pending']);

// CAL-15: "hoy" only for today; another day says which one.
const noon = (y, mo, d) => new Date(y, mo - 1, d, 12);
assert.equal(m.display.getFooterPeriodLabel(noon(2026, 10, 5), false, '2026-10-05'), 'hoy');
assert.equal(m.display.getFooterPeriodLabel(noon(2026, 10, 6), false, '2026-10-05'), 'el mar 6/10');
assert.equal(m.display.getFooterPeriodLabel(noon(2026, 10, 6), true, '2026-10-05'), 'en el periodo');

// CAL-13: unknown is not free and not blocked; configured rules still block.
const monday = noon(2026, 10, 5);
assert.equal(m.availability.getCleanerAvailabilityState('c1', monday, '10:00', '11:00', []).state, 'unknown');
assert.equal(m.availability.getCleanerAvailabilityState('c1', monday, '10:00', '11:00', [{ cleaner_id: 'c1', day_of_week: 1, is_available: true, start_time: null, end_time: null }]).state, 'unknown');
assert.equal(m.availability.getCleanerAvailabilityState('c1', monday, '10:00', '11:00', [{ cleaner_id: 'c1', day_of_week: 1, is_available: false }]).state, 'unavailable');
assert.equal(m.availability.getCleanerAvailabilityState('c1', monday, '07:00', '08:00', [{ cleaner_id: 'c1', day_of_week: 1, is_available: true, start_time: '08:00', end_time: '16:00' }]).state, 'unavailable');
assert.equal(m.availability.getCleanerAvailabilityState('c1', monday, '09:00', '10:00', [{ cleaner_id: 'c1', day_of_week: 1, is_available: true, start_time: '08:00', end_time: '16:00' }]).state, 'available');
// The old per-slot console.log is gone (33 lines per worker and render).
const logs = [];
const original = console.log;
console.log = (...args) => logs.push(args);
m.availability.isCleanerAvailableAtTime('c1', monday, '10:00', '10:00', []);
console.log = original;
assert.deepEqual(logs, []);
// CAL-20: civil weekday.
assert.equal(m.availability.civilDayOfWeek('2026-10-05'), 1);
assert.equal(m.availability.civilDayOfWeek('2026-10-04'), 0);

// Supervision privacy: medical leave shown as a generic absence; columns
// read never include notes unless allowed.
assert.equal(m.privacy.maskAbsenceType('sick', false), 'unspecified');
assert.equal(m.privacy.maskAbsenceType('sick', true), 'sick');
assert.equal(m.privacy.maskAbsenceType('vacation', false), 'vacation');
assert.equal(m.privacy.getAbsenceLabel('unspecified'), 'Ausencia');
assert.equal(m.privacy.getAbsenceLabel('sick'), 'Baja médica');
assert.equal(m.privacy.ABSENCE_COLUMNS.includes('notes'), false);

console.log('calendar-audit-rules: OK (display status, shared drop rule, timeline range/zoom/width, URL context, search on unassigned, unassigned order, unassigned duplicate, footer label, unknown availability, civil weekday, absence privacy; no network)');
