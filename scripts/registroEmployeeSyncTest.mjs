import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  getContractHoursPerWeek,
  getRegistroEmail,
  getRegistroPhone,
} from '../supabase/functions/sync-employees-from-registro/employeeFields.mjs';

assert.equal(getContractHoursPerWeek({ contract_hours_per_week: 30 }), 30);
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

assert.match(integration, /patch\.email = registroEmail/);
assert.match(integration, /patch\.telefono = registroPhone/);
assert.match(integration, /patch\.contract_hours_per_week = contractHours/);
assert.match(integration, /contract_hours_per_week: getContractHoursPerWeek\(e\) \?\? null/);
assert.doesNotMatch(integration, /\.from\(['"]tasks['"]\)\.(update|insert|upsert|delete)/);

console.log('registro-worker-sync-tests: OK');
