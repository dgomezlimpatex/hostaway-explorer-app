import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Renders the real cleaner desktop calendar and summary with local fixtures;
// the header and task cards are replaced by inert stubs. No network.
const stubs = {
  './cleaner/CleanerDateHeader': 'export const CleanerDateHeader=()=>null;',
  './cleaner/CleanerTaskCard': 'export const CleanerTaskCard=({task})=>task.property;',
};
const built = await build({
  stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
    export { CleanerDesktopCalendar } from './src/components/calendar/CleanerDesktopCalendar';
    export { formatMadridDate } from './src/utils/date';
    export { createElement } from 'react';
    export { renderToStaticMarkup } from 'react-dom/server';
  ` },
  bundle: true, write: false, platform: 'node', format: 'esm', jsx: 'automatic', logLevel: 'silent', metafile: true,
  external: ['react', 'react-dom', 'react-dom/server', 'lucide-react'],
  plugins: [{ name: 'stubs', setup(plugin) {
    plugin.onResolve({ filter: /CleanerDateHeader|CleanerTaskCard$/ }, args => Object.hasOwn(stubs, args.path) ? { path: args.path, namespace: 'stub' } : null);
    plugin.onLoad({ filter: /.*/, namespace: 'stub' }, args => ({ contents: stubs[args.path], loader: 'js' }));
  } }],
});
assert.equal(Object.keys(built.metafile.inputs).some(path => path.includes('integrations/supabase')), false);
const cacheDir = join(process.cwd(), 'node_modules', '.cache', 'calendar-tests');
mkdirSync(cacheDir, { recursive: true });
const bundlePath = join(cacheDir, `cleaner-titles-${process.pid}.mjs`);
writeFileSync(bundlePath, built.outputFiles[0].text);
let m;
try { m = await import(pathToFileURL(bundlePath).href); } finally { rmSync(bundlePath, { force: true }); }

const task = (id, date) => ({ id, date, property: `Piso ${id}`, startTime: '09:00', endTime: '10:00', status: 'pending' });
const render = (currentDate, todayTasks, tomorrowTasks) => m.renderToStaticMarkup(m.createElement(m.CleanerDesktopCalendar, {
  currentDate, onNavigateDate() {}, handleTaskClick() {}, todayTasks, tomorrowTasks,
}));

const today = new Date(`${m.formatMadridDate(new Date())}T12:00:00Z`);
let html = render(today, [], [task('t', '2099-01-01')]);
assert.match(html, /Tareas de Hoy/);
assert.match(html, /No tienes tareas para hoy/);
assert.match(html, /Tareas de Mañana/);
assert.match(html, /Mañana:/);

const other = new Date(today); other.setUTCDate(other.getUTCDate() + 3);
html = render(other, [], [task('t', '2099-01-01')]);
assert.doesNotMatch(html, /de Hoy|para hoy|de Mañana|Mañana:/);
assert.match(html, /Tareas del día/);
assert.match(html, /No tienes tareas para este día/);
assert.match(html, /Tareas del día siguiente/);
assert.match(html, /Día siguiente:/);

html = render(other, [task('a', '2099-01-01')], []);
assert.match(html, /Total del día/);
assert.match(html, /Piso a/);
// Dates are labelled in Madrid: 2026-10-25 12:00 UTC is Sunday the 25th.
html = render(new Date('2026-10-25T12:00:00Z'), [], [task('t', '2026-10-26')]);
assert.match(html, /domingo, 25 de octubre de 2026/);
assert.match(html, /lunes, 26 de octubre/);
console.log('cleaner-calendar-day-titles: OK (today vs other day titles, empty state, summary, Madrid dates)');
