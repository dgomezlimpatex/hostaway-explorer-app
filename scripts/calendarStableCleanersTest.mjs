import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Runs the real calendar data hooks with a hook runtime whose useMemo honours
// dependencies, so we can check referential stability between renders. Query
// and auth hooks are local stubs: no database, session or network.
const runtime = `
let values = [], cursor = 0;
export const reset = () => { cursor = 0; };
export function useState(initial) {
  const i = cursor++;
  if (!(i in values)) values[i] = typeof initial === 'function' ? initial() : initial;
  return [values[i], next => { values[i] = typeof next === 'function' ? next(values[i]) : next; }];
}
export function useMemo(factory, deps) {
  const i = cursor++;
  const previous = values[i];
  if (previous && deps && deps.every((d, k) => d === previous.deps[k])) return previous.value;
  values[i] = { deps, value: factory() };
  return values[i].value;
}
export const useCallback = (fn, deps) => useMemo(() => fn, deps);
export const useRef = initial => { const i = cursor++; if (!(i in values)) values[i] = { current: initial }; return values[i]; };
export const useEffect = () => {};
export default { useMemo, useState, useCallback, useRef, useEffect };
export const fixture = { data: undefined, isLoading: true, fetchStatus: 'fetching' };
export const useQuery = () => fixture;
export const useMutation = () => ({ mutate() {}, mutateAsync: async () => {} });
export const useQueryClient = () => ({});
export const useAuth = () => ({ userRole: 'manager', user: { id: 'u1' } });
export const useSede = () => ({ activeSede: { id: 's1' }, isInitialized: true, loading: false });
export const useTasks = () => ({ tasks: globalThis.realTasks, isLoading: false, isInitialLoading: false });
export const useRecurringTaskInstances = () => ({ virtualTasks: [] });
export const useCacheInvalidation = () => ({});
export const toast = () => {};
export const cleanerStorage = {};
export const supabase = new Proxy({}, { get() { throw new Error('No Supabase in tests'); } });
`;
const built = await build({
  stdin: { resolveDir: process.cwd(), loader: 'ts', contents: `
    export { useCalendarData } from './src/hooks/useCalendarData';
    export { reset, fixture } from 'react';
  ` },
  bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'silent', metafile: true,
  plugins: [{ name: 'runtime', setup(plugin) {
    plugin.onResolve({ filter: /^(react|@tanstack\/react-query|@\/hooks\/use-toast|@\/hooks\/useAuth|\.\/useAuth|@\/contexts\/SedeContext|\.\/useTasks|\.\/useRecurringTaskInstances|\.\/useCacheInvalidation|@\/services\/storage\/cleanerStorage|@\/integrations\/supabase\/client)$/ }, () => ({ path: 'runtime', namespace: 'fixture' }));
    plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: runtime, loader: 'js' }));
  } }],
});
assert.equal(Object.keys(built.metafile.inputs).some(path => path.includes('node_modules/@supabase')), false, 'the Supabase client is never bundled');
const m = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));
globalThis.realTasks = [];
const render = () => { m.reset(); return m.useCalendarData(); };

// While the query loads, the empty list is stable too.
let first = render(), second = render();
assert.equal(first.cleaners, second.cleaners, 'loading: same empty array between renders');

const data = [{ id: 'c1', name: 'Ana', isActive: true }, { id: 'c2', name: 'Berta', isActive: false }, { id: 'c3', name: 'Carmen' }];
Object.assign(m.fixture, { data, isLoading: false, fetchStatus: 'idle' });
first = render(); second = render();
assert.deepEqual(first.cleaners.map(c => c.id), ['c1', 'c3'], 'inactive cleaners stay hidden');
// Regression: a new array on every render invalidated every downstream memo.
assert.equal(first.cleaners, second.cleaners, 'same array while the query data does not change');
m.fixture.data = [...data, { id: 'c4', name: 'Dora' }];
assert.notEqual(render().cleaners, second.cleaners, 'new data, new list');
console.log('calendar-stable-cleaners: OK (stable active-cleaner list while loading and between renders; no network)');
