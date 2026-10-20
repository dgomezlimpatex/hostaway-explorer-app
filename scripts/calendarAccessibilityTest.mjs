import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Server-renders the real calendar controls with local stubs and checks their
// accessible structure (labels, keyboard focus, no nested buttons). No network.
const stubs = {
  '@/hooks/useClientData': 'export const useClientData=()=>({getClientName:()=>null});',
  '@/hooks/useTaskQuickActions': 'export const useTaskQuickActions=()=>({resizeTask(){},moveTaskToDate(){},addTaskDuration(){}});',
  '@/hooks/use-mobile': 'export const useDeviceType=()=>({isMobile:false,isTablet:false});export const useIsMobile=()=>false;',
};
const built = await build({
  stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
    export { MultiSelectFilter } from './src/components/calendar/MultiSelectFilter';
    export { ResponsiveCalendarHeader } from './src/components/calendar/ResponsiveCalendarHeader';
    export { CleanerDateHeader } from './src/components/calendar/cleaner/CleanerDateHeader';
    export { CleanerTaskCard } from './src/components/calendar/cleaner/CleanerTaskCard';
    export { EnhancedTaskCard } from './src/components/calendar/EnhancedTaskCard';
    export { MemoryRouter } from 'react-router-dom';
    export { createElement } from 'react';
    export { renderToStaticMarkup } from 'react-dom/server';
  ` },
  bundle: true, write: false, platform: 'node', format: 'esm', jsx: 'automatic', logLevel: 'silent', metafile: true,
  external: ['react', 'react-dom', 'react-dom/server', 'react-router-dom', 'lucide-react', 'date-fns', 'date-fns/*', '@radix-ui/*',
    'class-variance-authority', 'clsx', 'tailwind-merge', 'react-day-picker', 'cmdk'],
  plugins: [{ name: 'stubs', setup(plugin) {
    plugin.onResolve({ filter: /^@\/hooks\/(useClientData|useTaskQuickActions|use-mobile)$/ }, args => ({ path: args.path, namespace: 'stub' }));
    plugin.onLoad({ filter: /.*/, namespace: 'stub' }, args => ({ contents: stubs[args.path], loader: 'js' }));
  } }],
});
assert.equal(Object.keys(built.metafile.inputs).some(path => path.includes('integrations/supabase')), false);
const cacheDir = join(process.cwd(), 'node_modules', '.cache', 'calendar-tests');
mkdirSync(cacheDir, { recursive: true });
const bundlePath = join(cacheDir, `a11y-${process.pid}.mjs`);
writeFileSync(bundlePath, built.outputFiles[0].text);
let m;
try { m = await import(pathToFileURL(bundlePath).href); } finally { rmSync(bundlePath, { force: true }); }
const h = m.createElement;
const html = el => m.renderToStaticMarkup(h(m.MemoryRouter, null, el));
const noop = () => {};

// Nested interactive elements cannot be reached with the keyboard.
const nested = markup => /<button[^>]*>(?:(?!<\/button>).)*<button/s.test(markup) || /<a [^>]*>(?:(?!<\/a>).)*<button/s.test(markup);

const filter = html(h(m.MultiSelectFilter, { options: [{ id: 'a', name: 'Cliente A' }], selected: ['a'], onChange: noop, placeholder: 'clientes', allLabel: 'Todos' }));
assert.match(filter, /<button[^>]*aria-label="Quitar filtro de clientes"/, 'clear filter is a labelled button');
assert.equal(nested(filter), false, 'clear button is not inside the trigger');

const header = html(h(m.ResponsiveCalendarHeader, { currentDate: new Date('2026-10-06T12:00:00Z'), currentView: 'day', onNavigateDate: noop, onGoToToday: noop, onViewChange: noop, onNewTask: noop, onNewBatchTask: noop }));
assert.match(header, /<a[^>]*aria-label="Volver al menú"/, 'back link is a labelled link');
assert.equal(nested(header), false, 'no button inside a link');

const dateHeader = html(h(m.CleanerDateHeader, { currentDate: new Date('2026-10-06T12:00:00Z'), onNavigateDate: noop }));
for (const label of ['Ir al inicio', 'Día anterior', 'Día siguiente']) assert.match(dateHeader, new RegExp(`aria-label="${label}"`));

const task = { id: 't', date: '2026-10-06', property: 'Piso Centro', address: '', startTime: '09:00', endTime: '10:00', status: 'pending', cleanerId: 'c1' };
const cleanerCard = html(h(m.CleanerTaskCard, { task, onClick: noop }));
assert.match(cleanerCard, /^<div role="button" tabindex="0"/, 'cleaner card focusable as a button');
const dayCard = html(h(m.EnhancedTaskCard, { task, onClick: noop }));
assert.match(dayCard, /role="button"[^>]*tabindex="0"[^>]*aria-label="Piso Centro, 09:00 a 10:00, sin iniciar, más acciones con la tecla Menú o Mayúsculas\+F10"/, 'day card focusable and labelled (with status and keyboard menu)');
console.log('calendar-accessibility: OK (labelled clear/back/date buttons, no nested controls, focusable task cards; no network)');
