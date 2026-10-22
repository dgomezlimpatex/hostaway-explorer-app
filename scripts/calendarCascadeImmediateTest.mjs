import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Bundled data: URLs make expected error stacks enormous; retain the message.
const logError = console.error;
console.error = (...args) => logError(...args.map(arg => arg instanceof Error ? arg.message : arg));

// Runs the real useCalendarLogic drop handler and quick-action validation
// with a hook runtime and local stubs: no Supabase client, database, email
// or network. Writes and function calls are only recorded.
process.env.TZ = 'America/New_York'; // CAL-20: weekdays must not depend on the device timezone.

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
const S = globalThis.__dropTest;
export const useCalendarData = () => ({
  tasks: S.tasks, cleaners: S.cleaners, currentDate: new Date(2026, 9, 5, 12), currentView: 'day', isLoading: false,
  assignTaskWithSchedule: async p => { await S.assign(p); },
  reassignTaskKeepingCoworkers: async p => { await S.assign(p); },
});
export const useAllCleanersAvailability = () => ({ data: S.availability, isInitialLoading: false });
export let dropHandler;
export const useDragAndDrop = handler => { dropHandler = handler; return { dragState: {} }; };
export const useToast = () => ({ toast: t => S.calls.push(['toast', t.title, t.description]) });
export const useQueryClient = () => ({ invalidateQueries: async () => { await S.invalidate(); } });
export const materializeRecurringTaskInstance = async (t, patch) => { return await S.materialize(t, patch); };
const query = (table) => {
  const q = { filters: [] };
  const chain = (name) => (...args) => { q.filters.push([name, ...args]); return q; };
  q.select = chain('select'); q.eq = chain('eq'); q.lte = chain('lte'); q.gte = chain('gte'); q.contains = chain('contains');
  q.maybeSingle = chain('maybeSingle');
  q.update = (patch) => { q.patch = patch; return q; };
  q.then = async (resolve, reject) => { try {
    S.reads.push([table, q.filters]);
    if (table === 'tasks') return resolve(await S.update(q));
    await S.read();
    if (table === 'worker_absences') return resolve({ data: S.absences || [] });
    return resolve({ data: table === 'worker_fixed_days_off' ? null : [] }); } catch (e) { return reject(e); }
  };
  return q;
};
export const supabase = {
  from: query,
  functions: { invoke: async (name, payload) => { S.calls.push(['invoke', name, payload.body.changes.length]); return {}; } },
};
export const cn = (...c) => c.filter(Boolean).join(' ');
`;
const tags = ['AlertDialog', 'AlertDialogAction', 'AlertDialogCancel', 'AlertDialogContent', 'AlertDialogDescription', 'AlertDialogFooter', 'AlertDialogHeader', 'AlertDialogTitle'];
const built = await build({
  stdin: { resolveDir: process.cwd(), loader: 'ts', contents: `
    export { useCalendarLogic } from './src/hooks/useCalendarLogic';
    export { reset, dropHandler } from 'react';
  ` },
  bundle: true, write: false, platform: 'node', format: 'esm', jsx: 'automatic', logLevel: 'silent', metafile: true,
  plugins: [{ name: 'runtime', setup(plugin) {
    plugin.onResolve({ filter: /^(react(\/jsx-runtime)?|@tanstack\/react-query|@\/hooks\/(useCalendarData|useDragAndDrop|useAllCleanersAvailability|use-toast)|@\/integrations\/supabase\/client|@\/services\/recurringTaskInstanceService|@\/components\/ui\/alert-dialog|@\/lib\/utils)$/ }, () => ({ path: 'runtime', namespace: 'fixture' }));
    plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: runtime + tags.map(n => `export const ${n}='${n}';`).join('\n'), loader: 'js' }));
  } }],
});
const inputs = Object.keys(built.metafile.inputs);
assert.equal(inputs.some(path => path.includes('node_modules/@supabase') || path.includes('integrations/supabase')), false, 'no Supabase client in the bundle');

const S = globalThis.__dropTest = { calls: [], reads: [], tasks: [], cleaners: [], availability: [] };
const m = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));

const find = (node, predicate) => !node || typeof node !== 'object' ? [] : Array.isArray(node)
  ? node.flatMap(child => find(child, predicate))
  : [...(predicate(node) ? [node] : []), ...find(node.props?.children, predicate)];
const render = () => { m.reset(); return m.useCalendarLogic(S.options); };
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const dialog = () => render().confirmDialog;
const dialogText = () => find(dialog(), n => n.type === 'AlertDialogDescription')[0]?.props.children ?? '';
const press = (type, index = 0) => find(dialog(), n => n.type === type)[index].props.onClick();
const writes = () => S.calls.filter(c => ['assignWithSchedule', 'reassignKeeping', 'update', 'invoke', 'materialize'].includes(c[0]));

const cleaners = [
  { id: 'ana', name: 'Ana', email: 'ana@example.test' },
  { id: 'berta', name: 'Berta' },
  { id: 'carmen', name: 'Carmen' },
];
// Monday 05/10/2026, all three available 08:00-20:00.
const availability = cleaners.map(c => ({ cleaner_id: c.id, day_of_week: 1, is_available: true, start_time: '08:00', end_time: '20:00' }));
const base = { date: '2026-10-05', address: '', type: 'limpieza', checkIn: '', checkOut: '', status: 'pending' };
const shared = { ...base, id: 'A', property: 'Piso compartido', startTime: '09:00', endTime: '11:00', cleanerId: 'ana', cleaner: 'Ana, Carmen',
  assignments: [{ cleaner_id: 'ana', cleaner_name: 'Ana' }, { cleaner_id: 'carmen', cleaner_name: 'Carmen' }], assignmentCount: 2 };
const reset = (tasks, extra = {}) => { Object.assign(S, { calls: [], reads: [], tasks, cleaners, availability, absences: [], options: undefined, tasksRows: undefined }, extra); render(); };


const sleep = ms => new Promise(r => setTimeout(r, ms));
const until = async predicate => { const start = performance.now(); while (!predicate()) { assert.ok(performance.now() - start < 8000, 'fixture timed out'); await sleep(2); } };
const dropped = { ...base, id: 'D', property: 'Nueva', startTime: '08:00', endTime: '09:00' };
const occupied = { ...base, id: 'B', property: 'Ocupada', startTime: '10:30', endTime: '11:30', cleanerId: 'ana', cleaner: 'Ana' };
const next = { ...occupied, id: 'C', property: 'Siguiente', startTime: '11:30', endTime: '12:00' };
const initial = [dropped, occupied, next];
const clone = x => structuredClone(x);
const setup = ({ latency = 0, failAssign = false, failId, concurrentRevert = false } = {}) => {
  reset(clone(initial)); S.db = clone(initial); S.failId = failId; S.writeCalls = []; S.done = false;
  S.read = () => sleep(latency);
  S.materialize = async (t, patch) => { S.writeCalls.push(['materialize', t.id, patch]); await sleep(latency); const created = { ...t, ...patch, id: 'real-' + t.id, isRecurringInstance: false }; S.db = S.db.map(row => row.id === t.id ? created : row); return created; };
  S.failAssignRemaining = failAssign ? 1 : 0;
  S.assign = async p => {
    S.writeCalls.push(['assign', p]); await sleep(latency);
    if (S.failAssignRemaining-- > 0) throw Error('assignment fixture failed');
    S.db = S.db.map(t => t.id === p.taskId ? { ...t, cleanerId: p.cleanerId, cleaner: p.cleanerName, ...(p.nextTeam ? { assignments: p.nextTeam.map(m => ({ cleaner_id: m.id, cleaner_name: m.name })) } : {}), startTime: p.startTime || t.startTime, endTime: p.endTime || t.endTime } : t);
  };
  S.invalidate = async () => { await sleep(latency); S.tasks = clone(S.db); render(); };
  S.update = async q => {
    const expected = Object.fromEntries(q.filters.filter(f => f[0] === 'eq').map(f => [f[1], f[2]]));
    S.writeCalls.push(['update', expected, q.patch]); await sleep(latency);
    if (expected.id === S.failId) return { data: [], error: null };
    const reverting = q.patch.start_time === occupied.startTime;
    if (concurrentRevert && reverting) S.db = S.db.map(t => t.id === expected.id ? { ...t, startTime: '15:00', endTime: '16:00' } : t);
    const t = S.db.find(t => t.id === expected.id && t.startTime === expected.start_time && t.endTime === expected.end_time && t.status === expected.status);
    if (!t) return { data: [], error: null };
    Object.assign(t, { startTime: q.patch.start_time, endTime: q.patch.end_time });
    return { data: [{ id: t.id }], error: null };
  };
};
const startDrop = () => m.dropHandler('D', 'ana', cleaners, '10:00');
setup({ latency: 350 });
let start = performance.now();
let pending = startDrop();
await until(() => dialog().props.open);
const previewMs = performance.now() - start;
assert.deepEqual(S.writeCalls, []);
start = performance.now(); press('AlertDialogAction', 1);
await until(() => render().tasks.find(t => t.id === 'B').startTime === '11:00');
const cascadeVisibleMs = performance.now() - start;
await pending;
const persistenceMs = performance.now() - start;
console.log(JSON.stringify({ previewMs, cascadeVisibleMs, persistenceMs, simulatedRoundTripMs: 350 }));
if (process.env.CASCADE_BASELINE) process.exit(0);
assert.ok(previewMs <= 100, 'preview must not wait for network');
assert.ok(cascadeVisibleMs <= 100, 'whole cascade must be visible before network');
assert.ok(persistenceMs >= 700, 'UI timing is separate from persistence');
console.log('calendar-cascade-immediate: initial timing OK');

const accept = async () => { await until(() => dialog().props.open); press('AlertDialogAction', 1); await tick(); };
const shown = id => render().tasks.find(t => t.id === id);
const noticeCalls = () => S.calls.filter(c => c[0] === 'invoke');
const successCalls = () => S.calls.filter(c => c[0] === 'toast' && ['Tarea asignada', 'Horario actualizado'].includes(c[1]));
// Cancel the immediate proposal: no checks, writes, preview rows or notices.
setup(); pending = startDrop(); await until(() => dialog().props.open); press('AlertDialogCancel'); await pending;
assert.deepEqual(S.writeCalls, []); assert.equal(shown('B').startTime, '10:30'); assert.equal(render().pendingCalendarMove, null);
// Confirm without shifting retains the overlapping tasks.
setup(); pending = startDrop(); await until(() => dialog().props.open); press('AlertDialogAction', 0); await pending;
assert.deepEqual(S.writeCalls.map(c => c[0]), ['assign']); assert.equal(shown('B').startTime, '10:30'); assert.equal(noticeCalls().length, 0);
// Fresh absence warning still allows cancellation and removes the local preview.
setup({ latency: 20 }); S.absences = [{ absence_type: 'holiday', start_time: null, end_time: null }];
pending = startDrop(); await accept(); assert.equal(shown('B').startTime, '11:00');
await until(() => dialog().props.open); press('AlertDialogCancel'); await pending;
assert.deepEqual(S.writeCalls, []); assert.equal(shown('B').startTime, '10:30');
// First assignment fails: no cascade persistence or success notice, preview gone.
setup({ latency: 20, failAssign: true }); pending = startDrop(); await accept();
assert.equal(shown('C').startTime, '12:00'); assert.match(render().pendingCalendarMove, /no se ha guardado|pendientes/);
assert.equal(successCalls().length, 0); await pending;
assert.deepEqual(S.writeCalls.map(c => c[0]), ['assign']); assert.equal(shown('D').startTime, '08:00'); assert.equal(shown('B').startTime, '10:30'); assert.equal(noticeCalls().length, 0);
// Partial cascade failure compensates only its successful shifts; assignment stays.
setup({ failId: 'C' }); pending = startDrop(); await accept(); await pending;
assert.equal(shown('D').startTime, '10:00'); assert.equal(shown('B').startTime, '10:30'); assert.equal(shown('C').startTime, '11:30');
assert.equal(S.writeCalls.filter(c => c[0] === 'update').length, 3); assert.equal(noticeCalls().length, 0); assert.equal(successCalls().length, 0);
// A newer external change during compensation is kept, not overwritten.
setup({ failId: 'C', concurrentRevert: true }); pending = startDrop(); await accept(); await pending;
assert.equal(shown('B').startTime, '15:00'); assert.match(S.calls.find(c => c[1] === 'Reorganización incompleta')[2], /Revisa a mano/);
// A new cache/realtime state during the fresh checks invalidates the proposal.
setup({ latency: 30 }); pending = startDrop(); await accept();
S.tasks = S.tasks.map(t => t.id === 'B' ? { ...t, startTime: '14:00', endTime: '15:00' } : t); render();
await pending; assert.deepEqual(S.writeCalls, []); assert.equal(shown('B').startTime, '14:00'); assert.ok(S.calls.some(c => c[1] === 'El día ha cambiado'));
// Old refetch result while persisting never flashes old positions through preview.
setup({ latency: 30 }); pending = startDrop(); await accept();
await until(() => S.writeCalls.some(c => c[0] === 'assign'));
S.tasks = clone(initial); render(); assert.equal(shown('B').startTime, '11:00'); await pending;
assert.equal(shown('B').startTime, '11:00'); assert.equal(noticeCalls().length, 1);
// A second fast gesture is queued and evaluated after failure/reconciliation.
setup({ latency: 20, failId: 'C' }); pending = startDrop(); await accept();
const second = m.dropHandler('D', 'ana', cleaners, '14:00', 'ana');
assert.match(render().pendingCalendarMove, /1 movimiento.*en cola/);
await pending; await second;
assert.equal(shown('D').startTime, '14:00'); assert.equal(shown('D').endTime, '15:00');
assert.equal(shown('B').startTime, '10:30'); assert.equal(S.writeCalls.filter(c => c[0] === 'assign').length, 2);
// An initial assignment failure also releases the next intent, with fresh rows.
setup({ latency: 10, failAssign: true }); pending = startDrop(); await accept();
const afterFailure = m.dropHandler('D', 'ana', cleaners, '14:00');
await pending; await afterFailure; assert.equal(shown('D').startTime, '14:00');
assert.equal(S.writeCalls.filter(c => c[0] === 'assign').length, 2);
// Shared displaced work preserves its full service duration and all coworkers.
setup({ latency: 10 }); S.tasks = S.db = clone([dropped, { ...occupied, endTime: '12:30', assignments: [{ cleaner_id: 'ana' }, { cleaner_id: 'carmen' }] }]); render();
pending = startDrop(); await accept(); assert.equal(shown('B').endTime, '13:00'); assert.equal(shown('B').assignments.length, 2); await pending;
// Virtual recurring displaced task uses the existing materializer, once.
setup(); S.tasks = S.db = clone([dropped, { ...occupied, isRecurringInstance: true, recurringTaskId: 'template' }]); render();
pending = startDrop(); await accept(); await pending; assert.equal(S.writeCalls.filter(c => c[0] === 'materialize').length, 1); assert.equal(noticeCalls().length, 1);
// A queued move still using a displaced virtual ID resolves the writer's real ID.
setup({ latency: 10 }); S.tasks = S.db = clone([dropped, { ...occupied, id: 'virtual-B', isRecurringInstance: true, recurringTaskId: 'template' }]); render();
pending = startDrop(); await accept();
const queuedRecurring = m.dropHandler('virtual-B', 'ana', cleaners, '16:00', 'ana');
await pending; await queuedRecurring;
assert.equal(shown('real-virtual-B').startTime, '16:00'); assert.equal(S.writeCalls.filter(c => c[0] === 'materialize').length, 1);
// Started/finished fixed tasks stay fixed; no write or fake displacement.
for (const status of ['in-progress', 'completed']) {
 setup(); S.tasks = S.db = clone([dropped, { ...occupied, status }]); render();
 pending = startDrop(); await until(() => dialog().props.open); press('AlertDialogAction'); await pending;
 assert.equal(shown('B').startTime, '10:30'); assert.deepEqual(S.writeCalls.map(c => c[0]), ['assign']);
}
// End-of-day rejection is local, without any persistence.
setup(); S.availability = []; S.tasks = S.db = clone([{ ...dropped, startTime: '20:00', endTime: '21:00' }, { ...occupied, startTime: '22:30', endTime: '23:30' }]); render();
await m.dropHandler('D', 'ana', cleaners, '22:00'); assert.deepEqual(S.writeCalls, []); assert.ok(S.calls.some(c => c[1] === 'No se puede reorganizar'));
console.log('calendar-cascade-immediate: OK (real hook, delayed reads/writes, chain, pending UI, cancel/secondary, assignment failure, partial compensation, concurrent compensation, changed day, stale refetch, queued rapid gestures, shared, recurring, fixed statuses, 23:59; all effects stubbed)');
