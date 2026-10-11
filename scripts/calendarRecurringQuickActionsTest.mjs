import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Renders the real EnhancedTaskCard with a tiny hook runtime; UI primitives
// are inert tags. No database, session or network.
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
export const memo = c => c;
export const jsx = (type, props) => ({ type, props }); export const jsxs = jsx; export const Fragment = 'fragment';
export const createElement = (type, props, ...children) => ({ type, props: { ...props, children } });
export default { createElement, memo };
export const useClientData = () => ({ getClientName: () => null });
export const useTaskQuickActions = () => ({ resizeTask() {}, moveTaskToDate() {}, addTaskDuration() {} });
`;
const tags = ['Clock', 'ListTodo', 'GripVertical', 'GripHorizontal', 'Pencil', 'Copy', 'Trash2', 'UserMinus', 'CalendarDays', 'Timer',
  'Tooltip', 'TooltipContent', 'TooltipProvider', 'TooltipTrigger', 'ContextMenu', 'ContextMenuContent', 'ContextMenuItem',
  'ContextMenuSeparator', 'ContextMenuSub', 'ContextMenuSubContent', 'ContextMenuSubTrigger', 'ContextMenuTrigger', 'TaskStatusBadge'];
const built = await build({
  stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
    export { EnhancedTaskCard } from './src/components/calendar/EnhancedTaskCard';
    export { reset } from 'react';
  ` },
  bundle: true, write: false, platform: 'node', format: 'esm', jsx: 'automatic', logLevel: 'silent', metafile: true,
  plugins: [{ name: 'runtime', setup(plugin) {
    plugin.onResolve({ filter: /^(react(\/jsx-runtime)?|lucide-react|@\/components\/ui\/(tooltip|context-menu)|@\/hooks\/(useClientData|useTaskQuickActions)|\.\/TaskStatusBadge)$/ }, () => ({ path: 'runtime', namespace: 'fixture' }));
    plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: runtime + tags.map(n => `export const ${n}='${n}';`).join('\n'), loader: 'js' }));
  } }],
});
assert.equal(Object.keys(built.metafile.inputs).some(path => path.includes('integrations/supabase')), false);
const m = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));

const text = node => node == null || typeof node === 'boolean' ? '' : typeof node !== 'object' ? String(node)
  : Array.isArray(node) ? node.map(text).join(' ') : text(node.props?.children) + ' ' + (node.props?.['aria-label'] || '');
const base = { id: 't1', property: 'Piso de prueba', date: '2026-10-06', status: 'pending', startTime: '09:00', endTime: '10:00', cleanerId: 'c1' };
const render = task => { m.reset(); return text(m.EnhancedTaskCard({ task, onClick() {} })); };

const normal = render(base);
for (const label of ['Redimensionar tarea', 'Mover a', 'Duración', 'Duplicar tarea', 'Eliminar', 'Editar detalles', 'Desasignar']) {
  assert.ok(normal.includes(label), `normal task offers ${label}`);
}

// Regression: on a virtual recurring occurrence these actions found no task
// row and silently did nothing.
const recurring = render({ ...base, id: 'recurring_tpl_2026-10-06', isRecurringInstance: true, recurringTaskId: 'tpl' });
for (const label of ['Redimensionar tarea', 'Mover a', 'Duración', 'Duplicar tarea', 'Eliminar']) {
  assert.ok(!recurring.includes(label), `recurring occurrence hides ${label}`);
}
assert.ok(recurring.includes('Editar detalles'), 'details remain available');
assert.ok(recurring.includes('Desasignar'), 'unassign (handled for recurring) remains');
assert.ok(recurring.includes('Ocurrencia recurrente'), 'explains where to edit it');
console.log('calendar-recurring-quick-actions: OK (recurring occurrences only offer actions that work; normal tasks unchanged; no network)');
