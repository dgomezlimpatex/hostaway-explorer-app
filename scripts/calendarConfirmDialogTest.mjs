import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Runs the real useCalendarLogic drop handler and useConfirmDialog with a hook
// runtime and local stubs (no Supabase client, database or network).
// window.confirm throws: the calendar must use its own dialog.
const runtime = `
let values = [], cursor = 0;
export const reset = () => { cursor = 0; };
export function useState(initial) {
  const i = cursor++;
  if (!(i in values)) values[i] = typeof initial === 'function' ? initial() : initial;
  return [values[i], next => { values[i] = typeof next === 'function' ? next(values[i]) : next; }];
}
export function useRef(initial) { const i = cursor++; if (!(i in values)) values[i] = { current: initial }; return values[i]; }
export const useMemo = f => f(); export const useCallback = f => f; export const useEffect = () => {};
export const jsx = (type, props) => ({ type, props }); export const jsxs = jsx; export const Fragment = 'fragment';
export default {};
export const calls = [];
const task = { id: 't1', date: '2026-10-06', startTime: '09:00', endTime: '10:00', property: 'Piso', status: 'pending' };
export const useCalendarData = () => ({ tasks: [task], cleaners: [], currentDate: new Date(), currentView: 'day', isLoading: false,
  assignTaskWithSchedule: async p => calls.push(['assign', p.taskId, p.cleanerId]) });
export const useAllCleanersAvailability = () => ({ data: [], isInitialLoading: false });
export let dropHandler;
export const useDragAndDrop = handler => { dropHandler = handler; return { dragState: {} }; };
export const useToast = () => ({ toast: t => calls.push(['toast', t.title]) });
export const useQueryClient = () => ({ invalidateQueries: async () => {} });
export const isCleanerAvailableAtTime = () => ({ available: true });
export const materializeRecurringTaskInstance = async () => {};
export const ABSENCE_TYPE_LABELS = {};
const result = data => { const q = { eq: () => q, lte: () => q, gte: () => q, contains: () => q, select: () => q, maybeSingle: () => q, then: r => r({ data }) }; return q; };
export const supabase = { from: table => result(table === 'worker_fixed_days_off' ? { id: 'libre' } : []) };
export const format = () => '2026-10-06';
export const cn = (...c) => c.filter(Boolean).join(' ');
`;
const tags = ['AlertDialog', 'AlertDialogAction', 'AlertDialogCancel', 'AlertDialogContent', 'AlertDialogDescription', 'AlertDialogFooter', 'AlertDialogHeader', 'AlertDialogTitle'];
const built = await build({
  stdin: { resolveDir: process.cwd(), loader: 'ts', contents: `
    export { useCalendarLogic } from './src/hooks/useCalendarLogic';
    export { reset, calls, dropHandler } from 'react';
  ` },
  bundle: true, write: false, platform: 'node', format: 'esm', jsx: 'automatic', logLevel: 'silent', metafile: true,
  plugins: [{ name: 'runtime', setup(plugin) {
    plugin.onResolve({ filter: /^(react(\/jsx-runtime)?|@tanstack\/react-query|@\/hooks\/(useCalendarData|useDragAndDrop|useAllCleanersAvailability|use-toast)|@\/utils\/availabilityUtils|@\/integrations\/supabase\/client|date-fns|@\/types\/workerAbsence|@\/services\/recurringTaskInstanceService|@\/components\/ui\/alert-dialog|@\/lib\/utils)$/ }, () => ({ path: 'runtime', namespace: 'fixture' }));
    plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: runtime + tags.map(n => `export const ${n}='${n}';`).join('\n'), loader: 'js' }));
  } }],
});
assert.equal(Object.keys(built.metafile.inputs).some(path => path.includes('node_modules/@supabase')), false);
globalThis.window = { confirm() { throw new Error('window.confirm used'); } };
const m = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));

const find = (node, predicate) => !node || typeof node !== 'object' ? [] : Array.isArray(node)
  ? node.flatMap(child => find(child, predicate))
  : [...(predicate(node) ? [node] : []), ...find(node.props?.children, predicate)];
const render = () => { m.reset(); return m.useCalendarLogic(); };
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const cleaners = [{ id: 'c1', name: 'Ana' }];

// The worker has a fixed day off: the drop asks in the app dialog.
let logic = render();
const firstDrop = m.dropHandler('t1', 'c1', cleaners, '10:00');
await tick();
logic = render();
assert.equal(logic.confirmDialog.props.open, true, 'dialog open');
assert.equal(find(logic.confirmDialog, n => n.type === 'AlertDialogTitle')[0].props.children, 'Día libre fijo');
find(logic.confirmDialog, n => n.type === 'AlertDialogCancel')[0].props.onClick();
await firstDrop;
assert.equal(m.calls.some(c => c[0] === 'assign'), false, 'cancel keeps the task unassigned');
logic = render();
assert.equal(logic.confirmDialog.props.open, false, 'dialog closed');

const secondDrop = m.dropHandler('t1', 'c1', cleaners, '10:00');
await tick();
logic = render();
find(logic.confirmDialog, n => n.type === 'AlertDialogAction')[0].props.onClick();
await secondDrop;
assert.deepEqual(m.calls.filter(c => c[0] === 'assign'), [['assign', 't1', 'c1']], 'confirm assigns');
console.log('calendar-confirm-dialog: OK (drop asks in the app dialog; cancel and confirm respected; window.confirm never used; no network)');
