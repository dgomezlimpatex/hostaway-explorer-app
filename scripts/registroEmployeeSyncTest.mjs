import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  getContractHoursPerWeek,
  getRegistroEmail,
  getRegistroPhone,
} from '../supabase/functions/sync-employees-from-registro/employeeFields.mjs';

assert.equal(getContractHoursPerWeek({ contract_hours_per_week: 30 }), 30);
assert.equal(getContractHoursPerWeek({ contract_hours_per_week: 0 }), 0);
assert.equal(getContractHoursPerWeek({ contracted_weekly_hours: '22,5' }), 22.5);
assert.equal(getContractHoursPerWeek({ contract: { weekly_hours: 18 } }), 18);
assert.equal(getContractHoursPerWeek({ hours_per_week: 81 }), undefined);
assert.equal(getContractHoursPerWeek({}), undefined);

assert.equal(getRegistroEmail({ email: '  Empleada@Example.COM ' }), 'empleada@example.com');
assert.equal(getRegistroPhone({ telefono: '+34 600 123 456' }), '+34 600 123 456');
assert.equal(getRegistroPhone({ mobile_phone: 600123456 }), '600123456');
assert.equal(getRegistroPhone({ contract: { weekly_hours: 30 } }), undefined);

const integration = await readFile(
  new URL('../supabase/functions/sync-employees-from-registro/index.ts', import.meta.url),
  'utf8',
);
const workerBasicInfo = await readFile(
  new URL('../src/components/workers/WorkerBasicInfo.tsx', import.meta.url),
  'utf8',
);
const zeroSafeSources = await Promise.all([
  'src/components/workers/WorkerDetailModal.tsx',
  'src/components/workers/ContractForm.tsx',
  'src/components/workers/WorkerHoursOverview.tsx',
  'src/components/planning/OperationalPlanningPage.tsx',
  'src/hooks/useWorkloadCalculation.ts',
  'src/services/storage/workerContractsStorage.ts',
].map((path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')));

assert.match(integration, /profilePatch\.email = registroEmail/);
assert.match(integration, /profilePatch\.telefono = registroPhone/);
assert.match(integration, /profilePatch\.contract_hours_per_week = contractHours/);
assert.match(integration, /contract_hours_per_week: getContractHoursPerWeek\(e\) \?\? null/);
assert.match(integration, /contract_hours_per_week: contractHours \?\? null/);
assert.match(integration, /const profilePatch/);
assert.match(integration, /const statusPatch/);
assert.match(workerBasicInfo, /contractHoursPerWeek \?\?/);
assert.doesNotMatch(workerBasicInfo, /contractHoursPerWeek \|\| 40/);
for (const source of zeroSafeSources) {
  assert.doesNotMatch(source, /contractHoursPerWeek \|\| 40|contract_hours_per_week \|\| 40/);
}
assert.doesNotMatch(integration, /contractHours !== undefined \? \{ contract_hours_per_week: contractHours \} : \{\}/);
assert.doesNotMatch(integration, /\.from\(['"]tasks['"]\)\.(update|insert|upsert|delete)/);

console.log('registro-worker-sync-tests: OK');
