import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Real batch creation helper with a fake createTask; no database or network.
const built = await build({
  entryPoints: ['src/utils/batchTaskCreation.ts'], bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'silent',
});
const m = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));
const task = (property, startTime = '09:00') => ({ property, date: '2026-10-06', startTime, endTime: '10:00', status: 'pending' });

const created = [];
const createTask = async data => { if (data.property.startsWith('Falla')) throw new Error('rechazada'); created.push(data.property); };

// Regression: a failure in the middle stopped the batch and only said "No se
// pudieron crear todas las tareas", without saying which ones were created.
const result = await m.createTasksOneByOne([task('Piso 1'), task('Falla A', '11:00'), task('Piso 2'), task('Falla B', '12:00')], createTask);
assert.deepEqual(created, ['Piso 1', 'Piso 2'], 'keeps creating after a failure, in order');
assert.equal(result.created, 2);
assert.deepEqual(result.failed.map(t => t.property), ['Falla A', 'Falla B']);
assert.equal(m.describeBatchFailure(result), 'Se crearon 2 de 4 tareas. Faltan: Falla A (2026-10-06 11:00), Falla B (2026-10-06 12:00).');

const none = await m.createTasksOneByOne([task('Falla 1'), task('Falla 2')], createTask);
assert.equal(m.describeBatchFailure(none), 'No se pudo crear ninguna de las 2 tareas.');
const many = { created: 1, failed: Array.from({ length: 7 }, (_, i) => task(`Falla ${i}`)) };
assert.match(m.describeBatchFailure(many), /y 2 más\.$/);
assert.deepEqual(await m.createTasksOneByOne([task('Piso 3')], createTask), { created: 1, failed: [] });

// Regression: the calendar received mutate (fire and forget), so "Se han
// creado N tareas" appeared even when the creation failed. It must receive the
// awaitable mutateAsync from useTasks.
const runtime = `
export const useMemo = f => f(); export const useCallback = f => f; export const useEffect = () => {};
export const useState = initial => [typeof initial === 'function' ? initial() : initial, () => {}];
export const mutate = () => undefined;
export const mutateAsync = async () => ({ id: 'nuevo' });
export const useTasks = () => ({ tasks: [], isLoading: false, isInitialLoading: false, createTask: mutate, createTaskAsync: mutateAsync });
export const useCleaners = () => ({ cleaners: [], isInitialLoading: false });
export const useAuth = () => ({ userRole: 'manager', user: { id: 'u1' } });
export const useRecurringTaskInstances = () => ({ virtualTasks: [] });
`;
const hookBuild = await build({
  stdin: { resolveDir: process.cwd(), loader: 'ts', contents: `
    export { useCalendarData } from './src/hooks/useCalendarData';
    export { mutate, mutateAsync } from 'react';
  ` },
  bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'silent', metafile: true,
  plugins: [{ name: 'runtime', setup(plugin) {
    plugin.onResolve({ filter: /^(react|\.\/useTasks|\.\/useCleaners|\.\/useAuth|\.\/useRecurringTaskInstances)$/ }, () => ({ path: 'runtime', namespace: 'fixture' }));
    plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: runtime, loader: 'js' }));
  } }],
});
assert.equal(Object.keys(hookBuild.metafile.inputs).some(path => path.includes('node_modules/@supabase')), false);
const hooks = await import('data:text/javascript;base64,' + Buffer.from(hookBuild.outputFiles[0].text).toString('base64'));
const calendar = hooks.useCalendarData();
assert.equal(calendar.createTask, hooks.mutateAsync, 'calendar creation is awaitable');
assert.notEqual(calendar.createTask, hooks.mutate);
assert.deepEqual(await calendar.createTask({}), { id: 'nuevo' });
console.log('calendar-batch-creation: OK (awaitable creation, continues after failures, exact report of missing tasks; no network)');
