import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Runs the real calendar workload hook with a fake realtime channel and query
// client (no Supabase client, database or network) to count recalculations.
const runtime = `
export const useMemo = f => f(); export const useCallback = f => f;
export const cleanups = [];
export const useEffect = effect => { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); };
export const invalidations = [];
export const useQueryClient = () => ({ invalidateQueries: q => invalidations.push(q.queryKey) });
export const useWorkloadCalculation = () => ({ data: [{ cleanerId: 'c1', totalWorked: 5 }], isLoading: false });
export const handlers = [];
const channel = { on(_event, filter, handler) { handlers.push([filter.table, handler]); return channel; }, subscribe() { return channel; } };
export const removed = [];
export const supabase = { channel: () => channel, removeChannel: c => removed.push(c) };
`;
const built = await build({
  stdin: { resolveDir: process.cwd(), loader: 'ts', contents: `
    export { useCalendarWorkload, WORKLOAD_REFRESH_DELAY_MS } from './src/hooks/useCalendarWorkload';
    export { cleanups, invalidations, handlers, removed } from 'react';
  ` },
  bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'silent', metafile: true,
  plugins: [{ name: 'runtime', setup(plugin) {
    plugin.onResolve({ filter: /^(react|@tanstack\/react-query|@\/integrations\/supabase\/client|\.\/useWorkloadCalculation)$/ }, () => ({ path: 'runtime', namespace: 'fixture' }));
    plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: runtime, loader: 'js' }));
  } }],
});
assert.equal(Object.keys(built.metafile.inputs).some(path => path.includes('node_modules/@supabase')), false);
const m = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const result = m.useCalendarWorkload(new Date('2026-10-07T12:00:00'));
assert.deepEqual(result.workloadMap, { c1: { cleanerId: 'c1', totalWorked: 5 } });
assert.deepEqual(m.handlers.map(([table]) => table), ['tasks', 'task_assignments', 'worker_hour_adjustments']);

// Regression: a batch of 30 row events used to trigger 30 recalculations.
for (let i = 0; i < 30; i++) m.handlers[i % 3][1]();
assert.equal(m.invalidations.length, 0, 'no refresh in the middle of the batch');
await wait(m.WORKLOAD_REFRESH_DELAY_MS + 200);
assert.deepEqual(m.invalidations, [['workload', '2026-10-05', '2026-10-11']], 'one refresh for the whole batch');

// Separate changes still refresh each time.
m.handlers[0][1]();
await wait(m.WORKLOAD_REFRESH_DELAY_MS + 200);
assert.equal(m.invalidations.length, 2);

// Leaving the calendar cancels a pending refresh and closes the channel.
m.handlers[1][1]();
m.cleanups.forEach(cleanup => cleanup());
await wait(m.WORKLOAD_REFRESH_DELAY_MS + 200);
assert.equal(m.invalidations.length, 2, 'no refresh after unmount');
assert.equal(m.removed.length, 1);
console.log('calendar-workload-refresh: OK (one recalculation per batch, separate changes refresh, cleanup cancels; no network)');
