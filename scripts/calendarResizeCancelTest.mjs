import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Runs the real EnhancedTaskCard with a tiny hook runtime (state, refs and
// effects with cleanups) and a local window event target. No network.
const runtime = `
let values = [], cursor = 0, effects = [], pending = [];
export const reset = () => { cursor = 0; };
export function useState(initial) {
  const i = cursor++;
  if (!(i in values)) values[i] = typeof initial === 'function' ? initial() : initial;
  return [values[i], next => { values[i] = typeof next === 'function' ? next(values[i]) : next; }];
}
export function useRef(initial) { const i = cursor++; if (!(i in values)) values[i] = { current: initial }; return values[i]; }
export const useMemo = f => f(); export const useCallback = f => f;
export function useEffect(effect, deps) {
  const i = cursor++;
  const previous = effects[i];
  if (!previous || !deps || deps.some((d, k) => d !== previous.deps[k])) pending.push([i, effect, deps]);
}
export function flushEffects() {
  for (const [i, effect, deps] of pending.splice(0)) { effects[i]?.cleanup?.(); effects[i] = { deps, cleanup: effect() }; }
}
export const memo = c => c;
export const jsx = (type, props) => ({ type, props }); export const jsxs = jsx; export const Fragment = 'fragment';
export const createElement = (type, props, ...children) => ({ type, props: { ...props, children } });
export default { createElement, memo };
export const useClientData = () => ({ getClientName: () => null });
export const useTaskQuickActions = () => ({ resizeTask: (...a) => globalThis.resizes.push(a), moveTaskToDate() {}, addTaskDuration() {} });
`;
const tags = ['Clock', 'ListTodo', 'GripVertical', 'GripHorizontal', 'Pencil', 'Copy', 'Trash2', 'UserMinus', 'CalendarDays', 'Timer',
  'Tooltip', 'TooltipContent', 'TooltipProvider', 'TooltipTrigger', 'ContextMenu', 'ContextMenuContent', 'ContextMenuItem',
  'ContextMenuSeparator', 'ContextMenuSub', 'ContextMenuSubContent', 'ContextMenuSubTrigger', 'ContextMenuTrigger', 'TaskStatusBadge'];
const built = await build({
  stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
    export { EnhancedTaskCard } from './src/components/calendar/EnhancedTaskCard';
    export { reset, flushEffects } from 'react';
  ` },
  bundle: true, write: false, platform: 'node', format: 'esm', jsx: 'automatic', logLevel: 'silent', metafile: true,
  plugins: [{ name: 'runtime', setup(plugin) {
    plugin.onResolve({ filter: /^(react(\/jsx-runtime)?|lucide-react|@\/components\/ui\/(tooltip|context-menu)|@\/hooks\/(useClientData|useTaskQuickActions)|\.\/TaskStatusBadge)$/ }, () => ({ path: 'runtime', namespace: 'fixture' }));
    plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: runtime + tags.map(n => `export const ${n}='${n}';`).join('\n'), loader: 'js' }));
  } }],
});
assert.equal(Object.keys(built.metafile.inputs).some(path => path.includes('integrations/supabase')), false);
globalThis.window = new EventTarget();
globalThis.resizes = [];
const m = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));

const find = (node, predicate) => !node || typeof node !== 'object' ? [] : Array.isArray(node)
  ? node.flatMap(child => find(child, predicate))
  : [...(predicate(node) ? [node] : []), ...find(node.props?.children, predicate)];
const task = { id: 't1', property: 'Piso de prueba', date: '2026-10-06', status: 'pending', startTime: '09:00', endTime: '10:00', cleanerId: 'c1' };
const render = () => { m.reset(); const tree = m.EnhancedTaskCard({ task, onClick() {} }); m.flushEffects(); return tree; };
const card = tree => find(tree, n => n.type === 'div' && 'draggable' in n.props)[0];
const handle = tree => find(tree, n => n.props?.['aria-label'] === 'Redimensionar tarea')[0];
const pointer = (type, clientX) => Object.assign(new Event(type), { clientX });
const startResize = () => {
  let tree = render();
  handle(tree).props.onPointerDown({ stopPropagation() {}, preventDefault() {}, clientX: 100, pointerId: 1, target: { setPointerCapture() {} } });
  tree = render();
  assert.equal(card(tree).props.draggable, false, 'resize mode blocks dragging');
  window.dispatchEvent(pointer('pointermove', 150));
  tree = render();
  return tree;
};

// Regression: a cancelled gesture left the card stuck in resize mode.
for (const cancel of [() => window.dispatchEvent(new Event('pointercancel')), () => window.dispatchEvent(new Event('blur')),
  () => window.dispatchEvent(Object.assign(new Event('keydown'), { key: 'Escape' }))]) {
  startResize();
  cancel();
  const tree = render();
  assert.equal(card(tree).props.draggable, true, 'card draggable again');
  assert.equal(typeof card(tree).props.onClick, 'function', 'card clickable again');
  window.dispatchEvent(new Event('pointerup'));
  render();
  assert.deepEqual(globalThis.resizes, [], 'cancel never saves');
}

startResize();
window.dispatchEvent(new Event('pointerup'));
render();
assert.deepEqual(globalThis.resizes, [['t1', '10:30']], 'a normal release still saves');
console.log('calendar-resize-cancel: OK (pointercancel, blur and Escape exit without saving; release saves; no network)');
