import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Execute the real hook with a small hook runtime, including callbacks retained
// from before the drag-start render. No database, session or network is used.
const built = await build({
  entryPoints: ['src/hooks/useDragAndDrop.ts'], bundle: true, write: false,
  platform: 'node', format: 'esm', logLevel: 'silent',
  plugins: [{ name: 'hook-runtime', setup(plugin) {
    plugin.onResolve({ filter: /^react$/ }, () => ({ path: 'react', namespace: 'fixture' }));
    plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `
      export const useRef = value => ({current:value});
      export const useState = value => [value, next => globalThis.dragTestState=next];
      export const useCallback = fn => fn;
      export const useMemo = fn => fn();
    ` }));
  } }],
});
const { useDragAndDrop } = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));
const task = { id: 'task-local', property: 'Prueba local', startTime: '09:00', endTime: '10:00' };
const cleaners = [{ id: 'cleaner-local', name: 'Trabajadora local' }];
const calls = [];
const hook = useDragAndDrop((...args) => calls.push(args));
const event = (data = {}) => ({
  preventDefault() {}, stopPropagation() {}, clientX: 12, clientY: 15,
  target: { getBoundingClientRect() { throw Error('Use the draggable card, not its child'); } },
  currentTarget: { getBoundingClientRect: () => ({ left: 2, top: 5 }) },
  dataTransfer: { setData: (key, value) => { data[key] = value; }, getData: key => data[key] || '' },
});
const drop = e => hook.handleDrop(e, cleaners[0].id, cleaners, '10:15');

const start = event();
hook.handleDragStart(start, task);
assert.equal(start.dataTransfer.getData('text/plain'), task.id);
assert.equal(JSON.parse(start.dataTransfer.getData('application/json')).taskId, task.id);
assert.deepEqual(globalThis.dragTestState.dragOffset, { x: 10, y: 10 });
drop(event()); // empty browser payload + callback with pre-render state
assert.deepEqual(calls, [[task.id, cleaners[0].id, cleaners, '10:15']]);
assert.equal(globalThis.dragTestState.isDragging, false);
drop(start); // duplicate drop must not assign twice
assert.equal(calls.length, 1);

hook.handleDragStart(event(), task);
drop(event({ 'application/json': JSON.stringify({ taskId: task.id }) }));
assert.equal(calls.length, 2);
hook.handleDragStart(event(), task);
drop(event({ 'text/plain': task.id }));
assert.equal(calls.length, 3);
hook.handleDragStart(event(), { ...task, cleaner: cleaners[0].name, cleanerId: cleaners[0].id });
drop(event({ 'application/json': '{invalid' }));
assert.equal(calls.length, 4);

hook.handleDragStart(event(), task);
hook.handleDragEnd(event());
drop(event({ 'text/plain': task.id }));
assert.equal(calls.length, 4, 'Cancelled drag cannot assign a stale task');
drop(event({ 'text/plain': 'external-task' }));
assert.equal(calls.length, 4, 'External drag cannot assign');
hook.handleDragStart(event(), task);
drop(event({ 'text/plain': 'different-task' }));
assert.equal(calls.length, 4, 'Mismatched payload cannot assign another task');
console.log('calendar-drag-tests: OK (empty payload, stale render, JSON, assigned task, cancellation, duplicate and external drops)');
