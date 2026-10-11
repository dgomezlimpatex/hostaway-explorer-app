import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Runs the real multi-day helpers and grid with local fixtures only: no
// database, session or network.
const built = await build({
  stdin: {
    resolveDir: process.cwd(), loader: 'tsx', contents: `
      export * from './src/components/calendar/utils/multiDayCalendar';
      export { MultiDayCalendarGrid } from './src/components/calendar/MultiDayCalendarGrid';
      export { createElement } from 'react';
      export { renderToStaticMarkup } from 'react-dom/server';
    `,
  },
  bundle: true, write: false, platform: 'node', format: 'esm', jsx: 'automatic', logLevel: 'silent',
  external: ['react', 'react-dom', 'react-dom/server', 'date-fns', 'date-fns/*', 'lucide-react'],
  metafile: true,
});
assert.equal(Object.keys(built.metafile.inputs).some((path) => path.includes('integrations/supabase')), false);
// Write inside node_modules so the external packages resolve from the repo.
const cacheDir = join(process.cwd(), 'node_modules', '.cache', 'calendar-tests');
mkdirSync(cacheDir, { recursive: true });
const bundlePath = join(cacheDir, `multi-day-${process.pid}.mjs`);
writeFileSync(bundlePath, built.outputFiles[0].text);
let m;
try { m = await import(pathToFileURL(bundlePath).href); } finally { rmSync(bundlePath, { force: true }); }

// Visible days follow the query range: week Monday-Sunday, three days from the anchor.
assert.deepEqual(m.getVisibleDays(new Date('2026-10-07T12:00:00Z'), 'week'),
  ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']);
assert.deepEqual(m.getVisibleDays(new Date('2026-10-11T12:00:00Z'), 'week')[0], '2026-10-05', 'Sunday belongs to the week that started on Monday');
assert.deepEqual(m.getVisibleDays(new Date('2026-10-30T12:00:00Z'), 'three-day'), ['2026-10-30', '2026-10-31', '2026-11-01']);
assert.deepEqual(m.getVisibleDays(new Date('2026-10-25T12:00:00Z'), 'week').length, 7, 'DST change keeps 7 days');
assert.deepEqual(m.getVisibleDays(new Date('2026-10-07T12:00:00Z'), 'day'), ['2026-10-07']);
// 23:30 UTC on the 6th is already the 7th in Madrid.
assert.deepEqual(m.getVisibleDays(new Date('2026-10-06T23:30:00Z'), 'day'), ['2026-10-07']);
assert.equal(m.isMultiDayView('day'), false);
assert.equal(m.isMultiDayView('week'), true);
const local = m.civilDateToLocalDate('2026-10-25');
assert.deepEqual([local.getFullYear(), local.getMonth(), local.getDate(), local.getHours()], [2026, 9, 25, 12]);

const cleaners = [{ id: 'c1', name: 'Ana Prueba' }, { id: 'c2', name: 'Berta Prueba' }];
const task = (id, date, startTime, endTime, extra = {}) => ({
  id, date, startTime, endTime, property: `Piso ${id}`, address: '', status: 'pending', type: 'limpieza',
  checkIn: '', checkOut: '', clienteId: 'cliente-local', cleanerId: 'c1', cleaner: 'Ana Prueba', ...extra,
});
const days = ['2026-10-05', '2026-10-06', '2026-10-07'];
const tasks = [
  task('mon-late', '2026-10-05', '12:00', '13:00'),
  task('mon-early', '2026-10-05', '09:00', '11:00'),
  task('tue-same-hours', '2026-10-06', '09:00', '11:00'),
  task('wed-a', '2026-10-07', '10:00', '12:00'),
  task('wed-b', '2026-10-07', '11:30', '12:30'),
  task('out-of-range', '2026-10-09', '09:00', '10:00'),
  task('berta-list', '2026-10-06', '09:00', '10:00', { cleanerId: undefined, cleaner: undefined, assignments: [{ cleaner_id: 'c2' }] }),
];

const cells = m.buildCleanerDayCells(tasks, cleaners, days);
assert.deepEqual(cells.c1['2026-10-05'].map((e) => e.task.id), ['mon-early', 'mon-late'], 'sorted by start time');
assert.deepEqual(cells.c1['2026-10-05'].map((e) => e.hasOverlap), [false, false]);
assert.equal(cells.c1['2026-10-06'][0].hasOverlap, false, 'same hours on another day are not a conflict');
assert.deepEqual(cells.c1['2026-10-07'].map((e) => e.hasOverlap), [true, true]);
assert.equal(Object.values(cells.c1).flat().some((e) => e.task.id === 'out-of-range'), false);
assert.deepEqual(cells.c2['2026-10-06'].map((e) => e.task.id), ['berta-list'], 'assignment list places the task');
assert.deepEqual(cells.c2['2026-10-05'], []);

// Shared tasks show and compare the per-worker window.
const shared = task('shared', '2026-10-05', '09:00', '13:00', { propertyDurationMinutes: 240, assignments: [{ cleaner_id: 'c1' }, { cleaner_id: 'c2' }] });
const sharedCells = m.buildCleanerDayCells([shared, task('after', '2026-10-05', '11:30', '12:00')], cleaners, days);
assert.equal(sharedCells.c1['2026-10-05'][0].displayEndTime, '11:00', 'four hours split between two people');
assert.equal(sharedCells.c2['2026-10-05'][0].task.id, 'shared');

// Regression: the banner used to flag Monday and Tuesday tasks at the same hour.
const overlaps = m.getOverlapsByCleaner(tasks, cleaners);
assert.deepEqual(Object.keys(overlaps), ['c1']);
assert.deepEqual(overlaps.c1.map((t) => t.id).sort(), ['wed-a', 'wed-b']);
assert.deepEqual(m.getOverlapsByCleaner([tasks[1], tasks[2]], cleaners), {});

assert.equal(m.canDropOnDay({ date: '2026-10-06' }, '2026-10-06'), true);
assert.equal(m.canDropOnDay({ date: '2026-10-06' }, '2026-10-07'), false, 'drag never moves the date');
assert.equal(m.canDropOnDay(null, '2026-10-06'), false);

const noop = () => {};
const html = m.renderToStaticMarkup(m.createElement(m.MultiDayCalendarGrid, {
  cleaners, days, cells, todayStr: '2026-10-06',
  dragState: { draggedTask: null, isDragging: false, dragOffset: { x: 0, y: 0 } },
  onDragOver: noop, onDrop: noop, onDragStart: noop, onDragEnd: noop, onTaskClick: noop, onSelectDay: noop,
  assignmentsMap: { 'berta-list': ['c2'] },
}));
assert.equal((html.match(/data-day="/g) || []).length, cleaners.length * days.length, 'one cell per cleaner and day');
assert.equal((html.match(/data-task-id="/g) || []).length, 6);
assert.match(html, /lun 5/);
assert.match(html, /mar 6/);
assert.equal((html.match(/>2 servicios</g) || []).length, 3, 'per-day service counters');
assert.match(html, /Ana Prueba/);
assert.equal((html.match(/aria-label="Conflicto de horario"/g) || []).length, 2);
const tuesdayAna = html.split('data-cleaner-row="c1"')[1].split('data-day="2026-10-06"')[1].split('data-day=')[0];
assert.match(tuesdayAna, /Piso tue-same-hours/);
assert.doesNotMatch(tuesdayAna, /Piso mon-early/);

console.log('calendar-multi-day: OK (week/three-day ranges, per-day cells and conflicts, drop rule, grid render; no network)');
