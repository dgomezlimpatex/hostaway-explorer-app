import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Renders the real day grid with local fixtures. Hooks that read the query
// cache are replaced by inert stubs. No database, session or network.
const stubs = {
  '@/hooks/useClientData': 'export const useClientData=()=>({getClientName:()=>null});',
  '@/hooks/useTaskQuickActions': 'export const useTaskQuickActions=()=>({resizeTask(){},moveTaskToDate(){},addTaskDuration(){}});',
};
const built = await build({
  stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
    export { CalendarGrid } from './src/components/calendar/CalendarGrid';
    export { createElement } from 'react';
    export { renderToStaticMarkup } from 'react-dom/server';
  ` },
  bundle: true, write: false, platform: 'node', format: 'esm', jsx: 'automatic', logLevel: 'silent', metafile: true,
  external: ['react', 'react-dom', 'react-dom/server', 'lucide-react', 'date-fns', 'date-fns/*', '@radix-ui/*', 'class-variance-authority', 'clsx', 'tailwind-merge'],
  plugins: [{ name: 'stubs', setup(plugin) {
    plugin.onResolve({ filter: /^@\/hooks\/(useClientData|useTaskQuickActions)$/ }, args => ({ path: args.path, namespace: 'stub' }));
    plugin.onLoad({ filter: /.*/, namespace: 'stub' }, args => ({ contents: stubs[args.path], loader: 'js' }));
  } }],
});
assert.equal(Object.keys(built.metafile.inputs).some(path => path.includes('integrations/supabase')), false);
const cacheDir = join(process.cwd(), 'node_modules', '.cache', 'calendar-tests');
mkdirSync(cacheDir, { recursive: true });
const bundlePath = join(cacheDir, `shared-resize-${process.pid}.mjs`);
writeFileSync(bundlePath, built.outputFiles[0].text);
let m;
try { m = await import(pathToFileURL(bundlePath).href); } finally { rmSync(bundlePath, { force: true }); }

const base = { date: '2026-10-06', status: 'pending', address: '', type: 'limpieza', checkIn: '', checkOut: '' };
const single = { ...base, id: 'single', property: 'Piso individual', startTime: '09:00', endTime: '10:00', cleanerId: 'c1' };
const shared = { ...base, id: 'shared', property: 'Piso compartido', startTime: '11:00', endTime: '15:00', cleanerId: 'c1', propertyDurationMinutes: 240 };
const noop = () => {};
const html = m.renderToStaticMarkup(m.createElement(m.CalendarGrid, {
  cleaners: [{ id: 'c1', name: 'Ana Prueba' }, { id: 'c2', name: 'Berta Prueba' }],
  timeSlots: ['09:00', '09:30', '10:00'], assignedTasks: [single, shared], availability: [],
  currentDate: new Date('2026-10-06T12:00:00Z'),
  dragState: { draggedTask: null, isDragging: false, dragOffset: { x: 0, y: 0 } },
  onScroll: noop, onDragOver: noop, onDrop: noop, onDragStart: noop, onDragEnd: noop, onTaskClick: noop,
  getTaskPosition: () => ({ left: '0%', width: '10%' }), isTimeSlotOccupied: () => false,
  assignmentsMap: { shared: ['c1', 'c2'], single: ['c1'] },
}));

const cards = html.split('draggable="true"').slice(1);
const cardFor = name => cards.find(card => card.includes(name));
assert.ok(cardFor('Piso individual').includes('Redimensionar tarea'), 'single task keeps its resize handle');
// Regression: resizing the per-person block saved a shorter total end time.
assert.equal(cards.filter(card => card.includes('Piso compartido')).length, 2, 'shared task drawn in both rows');
for (const card of cards.filter(c => c.includes('Piso compartido'))) {
  assert.doesNotMatch(card.split('Piso individual')[0], /Redimensionar tarea/, 'shared task has no resize handle');
}
assert.match(html, /÷2/);
assert.match(html, /11:00 – 13:00/, 'per-person share still shown');
console.log('calendar-shared-task-resize: OK (single task resizable, shared task per-person block without resize; no network)');
