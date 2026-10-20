import assert from 'node:assert/strict';
import { build } from 'esbuild';

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
  assignTaskWithSchedule: async p => { S.calls.push(['assignWithSchedule', p.taskId, p.cleanerId, p.startTime, p.endTime]); },
  reassignTaskKeepingCoworkers: async p => { S.calls.push(['reassignKeeping', p.taskId, p.replacedCleanerId, p.cleanerId, p.startTime, p.endTime, p.nextTeam.map(m => m.id)]); },
});
export const useAllCleanersAvailability = () => ({ data: S.availability, isInitialLoading: false });
export let dropHandler;
export const useDragAndDrop = handler => { dropHandler = handler; return { dragState: {} }; };
export const useToast = () => ({ toast: t => S.calls.push(['toast', t.title, t.description]) });
export const useQueryClient = () => ({ invalidateQueries: async () => {} });
export const materializeRecurringTaskInstance = async () => { S.calls.push(['materialize']); };
const query = (table) => {
  const q = { filters: [] };
  const chain = (name) => (...args) => { q.filters.push([name, ...args]); return q; };
  q.select = chain('select'); q.eq = chain('eq'); q.lte = chain('lte'); q.gte = chain('gte'); q.contains = chain('contains');
  q.maybeSingle = chain('maybeSingle');
  q.update = (patch) => { S.calls.push(['update', table, patch]); return q; };
  q.then = (resolve) => {
    S.reads.push([table, q.filters]);
    if (table === 'tasks') return resolve({ data: S.tasksRows ?? [{ id: 'x' }], error: null });
    if (table === 'worker_absences') return resolve({ data: S.absences || [] });
    return resolve({ data: table === 'worker_fixed_days_off' ? null : [] });
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

// CAL-01: same row, other time → the whole team keeps the task.
reset([shared]);
await m.dropHandler('A', 'ana', cleaners, '12:00', 'ana');
assert.deepEqual(writes(), [['reassignKeeping', 'A', 'ana', 'ana', '12:00', '14:00', ['ana', 'carmen']]]);
// CAL-01: from Ana's row to Berta → only Ana is replaced, Carmen stays.
reset([shared]);
await m.dropHandler('A', 'berta', cleaners, '12:00', 'ana');
assert.deepEqual(writes(), [['reassignKeeping', 'A', 'ana', 'berta', '12:00', '14:00', ['carmen', 'berta']]]);
// From Ana's row to Carmen (already assigned) → nobody added twice or removed.
reset([shared]);
await m.dropHandler('A', 'carmen', cleaners, '12:00', 'ana');
assert.deepEqual(writes(), [['reassignKeeping', 'A', 'carmen', 'carmen', '12:00', '14:00', ['ana', 'carmen']]]);
// Same people and same time: nothing saved, nobody notified.
reset([shared]);
await m.dropHandler('A', 'carmen', cleaners, undefined, 'ana');
assert.deepEqual(writes(), []);
// An unassigned task keeps the single-assignment path.
reset([{ ...base, id: 'U', property: 'Sin asignar', startTime: '09:00', endTime: '10:00' }]);
await m.dropHandler('U', 'berta', cleaners, '10:00');
assert.deepEqual(writes(), [['assignWithSchedule', 'U', 'berta', '10:00', '11:00']]);

// CAL-20: Monday is asked as day_of_week 1 even on a device in New York.
const fixedDayRead = S.reads.find(([table]) => table === 'worker_fixed_days_off');
assert.ok(fixedDayRead[1].some(f => f[0] === 'eq' && f[1] === 'day_of_week' && f[2] === 1), 'civil weekday');
assert.ok(S.reads.find(([table]) => table === 'worker_absences')[1].some(f => f[0] === 'select' && !String(f[1]).includes('notes') && f[1] !== '*'),
  'absence checks never read notes');

// CAL-03: a drop on occupied time previews the reorganisation before writing.
const occupied = { ...base, id: 'B', property: 'Piso ocupado', startTime: '10:30', endTime: '11:30', cleanerId: 'ana', cleaner: 'Ana', assignments: [{ cleaner_id: 'ana', cleaner_name: 'Ana' }] };
const running = { ...base, id: 'R', property: 'Piso en curso', startTime: '10:15', endTime: '10:45', cleanerId: 'ana', cleaner: 'Ana', status: 'in-progress', assignments: [{ cleaner_id: 'ana', cleaner_name: 'Ana' }] };
const dropped = { ...base, id: 'D', property: 'Nueva', startTime: '08:00', endTime: '09:00' };
reset([dropped, occupied, running]);
let pending = m.dropHandler('D', 'ana', cleaners, '10:00');
await tick();
assert.equal(dialog().props.open, true, 'preview dialog open');
assert.match(dialogText(), /Piso ocupado: 10:30–11:30 → 11:00–12:00/);
assert.match(dialogText(), /No se mueven[\s\S]*Piso en curso 10:15–10:45 \(en curso\)/);
assert.deepEqual(find(dialog(), n => n.type === 'AlertDialogAction').map(n => n.props.children), ['Asignar sin desplazar', 'Desplazar y asignar']);
press('AlertDialogCancel');
await pending;
assert.deepEqual(writes(), [], 'cancel: no writes, no email');

reset([dropped, occupied, running]);
pending = m.dropHandler('D', 'ana', cleaners, '10:00');
await tick();
press('AlertDialogAction', 0); // Asignar sin desplazar
await pending;
assert.deepEqual(writes(), [['assignWithSchedule', 'D', 'ana', '10:00', '11:00']], 'leave the overlap: only the dropped task');

reset([dropped, occupied, running]);
pending = m.dropHandler('D', 'ana', cleaners, '10:00');
await tick();
press('AlertDialogAction', 1); // Desplazar y asignar
await pending;
assert.deepEqual(writes(), [
  ['assignWithSchedule', 'D', 'ana', '10:00', '11:00'],
  ['update', 'tasks', { start_time: '11:00', end_time: '12:00' }],
  ['invoke', 'send-task-reschedule-batch-email', 1],
], 'confirmed: shift saved, then one notice (stubbed)');
// The shift is conditioned on the previewed times and on the task still pending.
const shiftWrite = S.reads.find(([table, filters]) => table === 'tasks' && filters.some(f => f[0] === 'eq' && f[1] === 'start_time'));
assert.deepEqual(shiftWrite[1].filter(f => f[0] === 'eq'), [['eq', 'id', 'B'], ['eq', 'start_time', '10:30'], ['eq', 'end_time', '11:30'], ['eq', 'status', 'pending']]);

// A concurrent change makes the shift write 0 rows: the dropped task stays
// assigned, the failure is reported and no notice is sent.
reset([dropped, occupied, running], { tasksRows: [] });
pending = m.dropHandler('D', 'ana', cleaners, '10:00');
await tick();
press('AlertDialogAction', 1);
await pending;
assert.deepEqual(writes().map(w => w[0]), ['assignWithSchedule', 'update'], 'no notice after a partial failure');
const partial = S.calls.find(c => c[0] === 'toast' && c[1] === 'Reorganización incompleta');
assert.match(partial[2], /no se pudieron mover: Piso ocupado.*No se ha enviado el aviso/);

// CAL-13: no availability configured = unknown: allowed, with a warning.
reset([dropped], { availability: [] });
await m.dropHandler('D', 'berta', cleaners, '10:00');
assert.deepEqual(writes(), [['assignWithSchedule', 'D', 'berta', '10:00', '11:00']]);
assert.match(S.calls.find(c => c[0] === 'toast')[2], /Disponibilidad sin configurar/);
// Configured as not available: blocked with the reason, nothing saved.
reset([dropped], { availability: [{ cleaner_id: 'berta', day_of_week: 1, is_available: false }] });
await m.dropHandler('D', 'berta', cleaners, '10:00');
assert.deepEqual(writes(), []);
assert.deepEqual(S.calls.find(c => c[0] === 'toast').slice(1), ['Trabajador no disponible', 'No disponible este día']);

// CAL-14: quick schedule changes run the same checks before saving.
reset([occupied, { ...occupied, id: 'C', property: 'Piso siguiente', startTime: '12:00', endTime: '13:00' }]);
let validation = render().validateScheduleChange(occupied, { date: '2026-10-05', startTime: '10:30', endTime: '12:30' });
await tick();
assert.match(dialogText(), /Ana: se solapa con Piso siguiente \(12:00–13:00\)/);
press('AlertDialogCancel');
assert.equal(await validation, false, 'cancel keeps the old schedule');
reset([occupied]);
assert.equal(await render().validateScheduleChange(occupied, { date: '2026-10-05', startTime: '10:30', endTime: '12:00' }), true, 'no conflict: saved directly');
// Admin/manager see the absence type; supervision sees a generic absence.
reset([occupied], { absences: [{ absence_type: 'sick', start_time: null, end_time: null }] });
validation = render().validateScheduleChange(occupied, { date: '2026-10-05', startTime: '10:30', endTime: '12:00' });
await tick();
assert.match(dialogText(), /Baja médica/);
press('AlertDialogCancel');
await validation;
reset([occupied], { absences: [{ absence_type: 'sick', start_time: null, end_time: null }], options: { canSeeAbsenceDetails: false } });
validation = render().validateScheduleChange(occupied, { date: '2026-10-05', startTime: '10:30', endTime: '12:00' });
await tick();
assert.match(dialogText(), /ausencia: Ausencia/);
assert.doesNotMatch(dialogText(), /Baja|médica|sick/i, 'no medical detail for supervision');
press('AlertDialogCancel');
await validation;
// Another day not loaded: the warning says overlaps could not be checked.
reset([occupied]);
validation = render().validateScheduleChange(occupied, { date: '2026-10-12', startTime: '10:30', endTime: '11:30' });
await tick();
assert.match(dialogText(), /no se han comprobado solapes/);
press('AlertDialogCancel');
await validation;

console.log('calendar-shared-drop: OK (shared drop keeps coworkers, same-row/team-member keep the team, cascade preview cancel/leave/confirm, unknown vs unavailable availability, quick-action checks, civil weekday in New York; no network)');
