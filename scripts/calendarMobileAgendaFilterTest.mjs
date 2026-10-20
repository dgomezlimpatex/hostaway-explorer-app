import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Runs the real mobile manager agenda with a tiny hook runtime that keeps
// state between renders; UI primitives are inert tags. No network.
const runtime = `
let values = [], cursor = 0;
export const reset = () => { cursor = 0; };
export function useState(initial) {
  const i = cursor++;
  if (!(i in values)) values[i] = typeof initial === 'function' ? initial() : initial;
  return [values[i], next => { values[i] = typeof next === 'function' ? next(values[i]) : next; }];
}
export const useMemo = f => f(); export const useCallback = f => f; export const useEffect = () => {};
export const jsx = (type, props) => ({ type, props }); export const jsxs = jsx; export const Fragment = 'fragment';
export const createElement = (type, props, ...children) => ({ type, props: { ...props, children } });
export default { createElement };
export const useNavigate = () => () => {};
export const format = () => 'fecha'; export const es = {};
`;
const tags = ['Badge', 'Button', 'Card', 'CardContent', 'MobileBottomNav', 'TaskStatusBadge',
  'AlertTriangle', 'CalendarDays', 'ChevronLeft', 'ChevronRight', 'Clock', 'MapPin', 'UserRound', 'Users', 'Plus', 'ArrowLeft', 'Home', 'CheckCircle2', 'PlayCircle', 'Menu',
  'Search', 'X', 'Input', 'Popover', 'PopoverContent', 'PopoverTrigger', 'Calendar'];
const built = await build({
  stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
    export { ManagerMobileAgendaCalendar } from './src/components/calendar/ManagerMobileAgendaCalendar';
    export { reset } from 'react';
  ` },
  bundle: true, write: false, platform: 'node', format: 'esm', jsx: 'automatic', logLevel: 'silent', metafile: true,
  plugins: [{ name: 'runtime', setup(plugin) {
    plugin.onResolve({ filter: /^(react(\/jsx-runtime)?|react-router-dom|lucide-react|date-fns(\/locale)?|@\/components\/(ui\/.*|mobile\/MobileBottomNav)|\.\/TaskStatusBadge)$/ }, () => ({ path: 'runtime', namespace: 'fixture' }));
    plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: runtime + tags.map(n => `export const ${n}='${n}';`).join('\n'), loader: 'js' }));
  } }],
});
assert.equal(Object.keys(built.metafile.inputs).some(path => path.includes('integrations/supabase')), false);
const m = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));

// Local function components (task cards) have no hooks: expand them inline.
const expand = node => node && typeof node === 'object' && typeof node.type === 'function' ? expand(node.type(node.props)) : node;
const find = (node, predicate) => !node || typeof node !== 'object' ? [] : Array.isArray(node)
  ? node.flatMap(child => find(child, predicate))
  : (node = expand(node), [...(predicate(node) ? [node] : []), ...find(node?.props?.children, predicate)]);
const text = node => node == null || typeof node === 'boolean' ? '' : typeof node !== 'object' ? String(node)
  : Array.isArray(node) ? node.map(text).join('') : text(expand(node)?.props?.children);
const chip = (tree, label) => find(tree, n => n.type === 'Button' && text(n).startsWith(label))[0];

const cleaners = [{ id: 'c1', name: 'Ana Prueba' }, { id: 'c2', name: 'Berta Prueba' }];
const task = (id, date, cleanerId) => ({ id, date, cleanerId, property: `Piso ${id}`, startTime: '09:00', endTime: '10:00', status: 'pending', address: '', type: 'limpieza', checkIn: '', checkOut: '' });
const tasks = [task('mon-ana', '2026-10-05', 'c1'), task('mon-berta', '2026-10-05', 'c2'), task('tue-berta', '2026-10-06', 'c2')];
const render = day => { m.reset(); return m.ManagerMobileAgendaCalendar({
  currentDate: new Date(`${day}T12:00:00Z`), tasks, cleaners,
  onNavigateDate() {}, onGoToToday() {}, onTaskClick() {}, onNewTask() {}, onNewBatchTask() {},
}); };

let tree = render('2026-10-05');
chip(tree, 'Ana Prueba').props.onClick();
tree = render('2026-10-05');
assert.equal(chip(tree, 'Ana Prueba').props.variant, 'default');
assert.match(text(tree), /Piso mon-ana/);

// Regression: the selected chip vanished on a day without tasks for her.
tree = render('2026-10-06');
const selected = chip(tree, 'Ana Prueba');
assert.ok(selected, 'selected cleaner chip stays visible');
assert.equal(selected.props.variant, 'default');
assert.equal(text(selected), 'Ana Prueba (0)');
assert.match(text(tree), /Ana Prueba no tiene tareas este día/);
assert.doesNotMatch(text(tree), /Piso tue-berta/);

chip(tree, 'Todas').props.onClick();
tree = render('2026-10-06');
assert.equal(chip(tree, 'Ana Prueba'), undefined, 'unselected cleaners without tasks stay hidden');
assert.match(text(tree), /Piso tue-berta/);
console.log('calendar-mobile-agenda-filter: OK (selected cleaner visible on empty days, clear message, back to all; no network)');
