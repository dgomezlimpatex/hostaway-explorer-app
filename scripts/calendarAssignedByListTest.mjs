import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Real assignment helper and mobile manager agenda with local fixtures; the
// router and bottom navigation are inert stubs. No network.
const stubs = {
  'react-router-dom': 'export const useNavigate=()=>()=>{};',
  '@/components/mobile/MobileBottomNav': 'export const MobileBottomNav=()=>null;',
};
const built = await build({
  stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
    export { isTaskAssigned } from './src/utils/taskAssignments';
    export { ManagerMobileAgendaCalendar } from './src/components/calendar/ManagerMobileAgendaCalendar';
    export { createElement } from 'react';
    export { renderToStaticMarkup } from 'react-dom/server';
  ` },
  bundle: true, write: false, platform: 'node', format: 'esm', jsx: 'automatic', logLevel: 'silent', metafile: true,
  external: ['react', 'react-dom', 'react-dom/server', 'lucide-react', 'date-fns', 'date-fns/*', '@radix-ui/*', 'class-variance-authority', 'clsx', 'tailwind-merge'],
  plugins: [{ name: 'stubs', setup(plugin) {
    plugin.onResolve({ filter: /^(react-router-dom|@\/components\/mobile\/MobileBottomNav)$/ }, args => ({ path: args.path, namespace: 'stub' }));
    plugin.onLoad({ filter: /.*/, namespace: 'stub' }, args => ({ contents: stubs[args.path], loader: 'js' }));
  } }],
});
assert.equal(Object.keys(built.metafile.inputs).some(path => path.includes('integrations/supabase')), false);
const cacheDir = join(process.cwd(), 'node_modules', '.cache', 'calendar-tests');
mkdirSync(cacheDir, { recursive: true });
const bundlePath = join(cacheDir, `assigned-by-list-${process.pid}.mjs`);
writeFileSync(bundlePath, built.outputFiles[0].text);
let m;
try { m = await import(pathToFileURL(bundlePath).href); } finally { rmSync(bundlePath, { force: true }); }

const base = { date: '2026-10-06', startTime: '09:00', endTime: '10:00', status: 'pending', address: '', type: 'limpieza', checkIn: '', checkOut: '' };
const byList = { ...base, id: 'list', property: 'Piso lista', assignments: [{ cleaner_id: 'c1', cleaner_name: 'Ana Prueba' }] };
const byId = { ...base, id: 'id', property: 'Piso id', cleanerId: 'c1' };
const byName = { ...base, id: 'name', property: 'Piso nombre', cleaner: 'Ana Prueba' };
const free = { ...base, id: 'free', property: 'Piso libre' };
const blankName = { ...base, id: 'blank', property: 'Piso vacío', cleaner: '  ', assignments: [] };

// Regression: tasks assigned only through task_assignments counted as unassigned.
assert.equal(m.isTaskAssigned(byList), true);
assert.equal(m.isTaskAssigned(byId), true);
assert.equal(m.isTaskAssigned(byName), true);
assert.equal(m.isTaskAssigned(free), false);
assert.equal(m.isTaskAssigned(blankName), false);
assert.equal(m.isTaskAssigned({ ...free, assignments: [{ cleaner_id: null }] }), false);

const html = m.renderToStaticMarkup(m.createElement(m.ManagerMobileAgendaCalendar, {
  currentDate: new Date('2026-10-06T12:00:00Z'), tasks: [byList, byId, byName, free, blankName],
  cleaners: [{ id: 'c1', name: 'Ana Prueba' }], onNavigateDate() {}, onGoToToday() {}, onTaskClick() {}, onNewTask() {}, onNewBatchTask() {},
}));
assert.match(html, /Sin asignar \(2\)</, 'only the two really free tasks are unassigned');
const listCard = html.split('Piso lista')[1].split('</button>')[0];
assert.match(listCard, /Ana Prueba/, 'shows the assigned person from the list');
assert.doesNotMatch(listCard, /Sin asignar/);
console.log('calendar-assigned-by-list: OK (canonical list, legacy id/name, blanks; mobile agenda counters and labels; no network)');
