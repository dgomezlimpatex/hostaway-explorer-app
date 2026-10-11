import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Renders the real day grid twice with a tiny runtime and checks that each
// task card receives identical props, so React.memo can skip re-rendering.
// The card itself is an inert tag. No database, session or network.
const runtime = `
export const useMemo = f => f(); export const useCallback = f => f; export const useEffect = () => {};
export const memo = c => c; export const forwardRef = render => props => render(props, null);
export const jsx = (type, props) => ({ type, props }); export const jsxs = jsx; export const Fragment = 'fragment';
export default { memo, forwardRef };
export const EnhancedTaskCard = 'EnhancedTaskCard'; export const TimeSlot = 'TimeSlot';
`;
const built = await build({
  stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `export { CalendarGrid } from './src/components/calendar/CalendarGrid';` },
  bundle: true, write: false, platform: 'node', format: 'esm', jsx: 'automatic', logLevel: 'silent', metafile: true,
  plugins: [{ name: 'runtime', setup(plugin) {
    plugin.onResolve({ filter: /^(react(\/jsx-runtime)?|\.\/EnhancedTaskCard|\.\/TimeSlot)$/ }, () => ({ path: 'runtime', namespace: 'fixture' }));
    plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: runtime, loader: 'js' }));
  } }],
});
assert.equal(Object.keys(built.metafile.inputs).some(path => path.includes('integrations/supabase')), false);
const m = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));

const expand = node => node && typeof node === 'object' && typeof node.type === 'function' ? expand(node.type(node.props)) : node;
const find = (node, predicate) => !node || typeof node !== 'object' ? [] : Array.isArray(node)
  ? node.flatMap(child => find(child, predicate))
  : (node = expand(node), [...(predicate(node) ? [node] : []), ...find(node?.props?.children, predicate)]);

const base = { date: '2026-10-06', status: 'pending', address: '', type: 'limpieza', checkIn: '', checkOut: '' };
const tasks = [
  { ...base, id: 'a', property: 'Piso A', startTime: '09:00', endTime: '10:00', cleanerId: 'c1' },
  { ...base, id: 'b', property: 'Piso B', startTime: '09:30', endTime: '11:00', cleanerId: 'c1' },
  { ...base, id: 's', property: 'Piso compartido', startTime: '12:00', endTime: '16:00', cleanerId: 'c1', propertyDurationMinutes: 240 },
];
const noop = () => {};
const props = {
  cleaners: [{ id: 'c1', name: 'Ana' }, { id: 'c2', name: 'Berta' }], timeSlots: ['09:00', '09:30'], assignedTasks: tasks, availability: [],
  currentDate: new Date('2026-10-06T12:00:00Z'), dragState: { draggedTask: null, isDragging: false, dragOffset: { x: 0, y: 0 } },
  onScroll: noop, onDragOver: noop, onDrop: noop, onDragStart: noop, onDragEnd: noop, onTaskClick: noop,
  getTaskPosition: () => ({ left: '0%', width: '10%' }), isTimeSlotOccupied: () => false, assignmentsMap: { s: ['c1', 'c2'] },
};
const cards = () => find(m.CalendarGrid(props), n => n.type === 'EnhancedTaskCard').map(n => n.props);
const first = cards(), second = cards();
assert.equal(first.length, 4, 'two single tasks, shared task in both rows');
// Regression: new arrow functions and style objects on every render.
first.forEach((card, i) => {
  for (const key of ['onClick', 'onDragStart', 'onDragEnd', 'style', 'originalTask']) {
    assert.equal(second[i][key], card[key], `${card.task.property}: ${key} stable`);
  }
});
assert.equal(first[0].onClick, props.onTaskClick, 'the grid passes its own callback');
const shared = first.find(card => card.task.id === 's');
assert.equal(shared.originalTask, tasks[2], 'shared card acts on the full task');
assert.notEqual(shared.task.endTime, '16:00', 'while showing the per-person block');
assert.equal(first.find(c => c.task.id === 'a').style.backgroundColor, 'rgba(239, 68, 68, 0.1)', 'overlap style kept');
console.log('calendar-stable-card-props: OK (card callbacks/style stable between renders, shared cards act on the full task; no network)');
