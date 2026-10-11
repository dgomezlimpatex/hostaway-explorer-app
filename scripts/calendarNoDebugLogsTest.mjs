import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

// The manager calendar must not print debug logs in production (some ran on
// every render, once per cleaner). Builds the real route graph and checks
// every calendar source in it; console.error/warn stay allowed. No network.
const graph = await build({
  entryPoints: ['src/components/CleaningCalendar.tsx'], bundle: true, write: false, outdir: 'out', platform: 'browser', format: 'esm',
  jsx: 'automatic', logLevel: 'silent', metafile: true, loader: { '.css': 'empty', '.svg': 'empty', '.png': 'empty' },
  plugins: [{ name: 'external-packages', setup(plugin) {
    plugin.onResolve({ filter: /^[^./]/ }, args => args.path.startsWith('@/') ? null : { path: args.path, external: true });
  } }],
});
const calendarSources = Object.keys(graph.metafile.inputs).filter(path =>
  /^src\/(components\/CleaningCalendar|components\/calendar\/|hooks\/(useCalendar|useDragAndDrop))/.test(path));
assert.ok(calendarSources.length >= 15, `calendar graph found (${calendarSources.length} files)`);
const offenders = calendarSources.filter(path => /^\s*console\.log\(/m.test(readFileSync(path, 'utf8')));
assert.deepEqual(offenders, [], 'no console.log in calendar sources');

// Removing the logs must not change drag-and-drop behaviour.
const hook = await build({
  entryPoints: ['src/hooks/useDragAndDrop.ts'], bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'silent',
  plugins: [{ name: 'react', setup(plugin) {
    plugin.onResolve({ filter: /^react$/ }, () => ({ path: 'react', namespace: 'fixture' }));
    plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const useRef=v=>({current:v});export const useState=v=>[v,()=>{}];export const useCallback=f=>f;export const useMemo=f=>f();' }));
  } }],
});
const { useDragAndDrop } = await import('data:text/javascript;base64,' + Buffer.from(hook.outputFiles[0].text).toString('base64'));
const calls = [];
const printed = [];
const original = console.log;
console.log = (...args) => printed.push(args);
try {
  const drag = useDragAndDrop((...args) => calls.push(args));
  const event = { preventDefault() {}, stopPropagation() {}, clientX: 0, clientY: 0,
    currentTarget: { getBoundingClientRect: () => ({ left: 0, top: 0 }) },
    dataTransfer: { data: {}, setData(k, v) { this.data[k] = v; }, getData(k) { return this.data[k] || ''; } } };
  drag.handleDragStart(event, { id: 't1', property: 'Piso' });
  drag.handleDrop(event, 'c1', [], '10:00');
} finally { console.log = original; }
assert.deepEqual(calls.map(c => [c[0], c[1], c[3]]), [['t1', 'c1', '10:00']]);
assert.deepEqual(printed, [], 'drag and drop prints nothing');
console.log(`calendar-no-debug-logs: OK (${calendarSources.length} calendar sources without console.log; drag still assigns; no network)`);
