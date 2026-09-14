import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Exercise the real hook and calculation with empty task data and controlled profiles/contracts.
const state = { cleaners: [], contracts: [] };
globalThis.__workloadContractTest = state;
const result = await build({
  entryPoints: ['src/hooks/useWorkloadCalculation.ts'],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  plugins: [{
    name: 'workload-data',
    setup(builder) {
      builder.onResolve({ filter: /^(\@tanstack\/react-query|\@\/integrations\/supabase\/client|\.\/useCleaners|\.\/useWorkerContracts)$/ }, args => ({ path: args.path, namespace: 'mock' }));
      builder.onLoad({ filter: /.*/, namespace: 'mock' }, ({ path }) => ({ contents:
        path.includes('react-query') ? 'export const useQuery = options => options;' :
        path.endsWith('useCleaners') ? 'export const useCleaners = () => globalThis.__workloadContractTest;' :
        path.endsWith('useWorkerContracts') ? 'export const useWorkerContracts = () => ({data: globalThis.__workloadContractTest.contracts, isLoading: false});' :
        'const query = new Proxy({}, {get: (_, key) => key === "then" ? resolve => resolve({data: [], error: null}) : () => query}); export const supabase = {from: () => query};',
      }));
    },
  }],
});
const { useWorkloadCalculation } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const options = { startDate: '2026-09-07', endDate: '2026-09-13' };
const query = () => useWorkloadCalculation(options);
const hours = async () => (await query().queryFn())[0].contractHoursPerWeek;

try {
  state.cleaners = [{ id: 'worker', name: 'Worker', isActive: true, contractHoursPerWeek: 32.25 }];
  state.contracts = [{ cleanerId: 'worker', isActive: true, contractHoursPerWeek: 0 }];
  assert.equal(await hours(), 32.25, 'A zero-hour legacy contract must not hide profile hours');
  state.contracts[0].contractHoursPerWeek = 40;
  assert.equal(await hours(), 32.25, 'The edited profile takes precedence');
  const previousKey = JSON.stringify(query().queryKey);
  state.cleaners[0].contractHoursPerWeek = 36;
  assert.notEqual(JSON.stringify(query().queryKey), previousKey, 'Editing profile hours refreshes workload');
  assert.equal(await hours(), 36);
  state.cleaners[0].contractHoursPerWeek = null;
  assert.equal(await hours(), 40, 'An active contract remains the fallback');
  state.cleaners[0].contractHoursPerWeek = 0;
  assert.equal(await hours(), 40, 'Existing contract-only workers keep their hours');
  const contractKey = JSON.stringify(query().queryKey);
  state.contracts[0].contractHoursPerWeek = 20;
  assert.notEqual(JSON.stringify(query().queryKey), contractKey, 'Editing a contract without adding one refreshes workload');
  assert.equal(await hours(), 20);
  state.contracts[0].isActive = false;
  assert.equal(await hours(), 0, 'Inactive contracts do not supply hours');
  state.contracts = [];
  assert.equal(await hours(), 0, 'Workers with no hours remain without contract');
  state.cleaners[0].contractHoursPerWeek = 25;
  assert.equal(await hours(), 25, 'Profile hours work without a contract record');
  console.log('workload-contract-hours: OK');
} finally {
  delete globalThis.__workloadContractTest;
}
