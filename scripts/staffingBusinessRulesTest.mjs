import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle = await build({ entryPoints: ['src/features/staffing/businessRules.ts'], bundle: true, write: false, platform: 'node', format: 'esm', metafile: true, logLevel: 'silent' });
assert.ok(!Object.keys(bundle.metafile.inputs).some(path => path.includes('supabase/client')), 'rules must not load a production client');
const { staffingRulesForSede } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const sede = '1e0759ec-5e63-4edd-9dad-e493c715bbba';
const property = 'e0c82e3d-f702-4842-8c34-c987a6fd9c2e';
assert.deepEqual(staffingRulesForSede(sede), { shiftPropertyIds: [property], useHabitualCollaborators: true, allowCrossCenterMobility: true }, 'explicit confirmed site rules use canonical scoped identity');
for (const other of ['', 'another-sede', 'A Coruña', ` ${sede}`]) {
  assert.deepEqual(staffingRulesForSede(other), { shiftPropertyIds: [], useHabitualCollaborators: false, allowCrossCenterMobility: false }, 'never apply business rules by a similar name or normalize malformed IDs');
}
const changed = staffingRulesForSede(sede);
changed.shiftPropertyIds.push('untrusted-property');
changed.useHabitualCollaborators = false;
assert.deepEqual(staffingRulesForSede(sede), { shiftPropertyIds: [property], useHabitualCollaborators: true, allowCrossCenterMobility: true }, 'consumer cannot mutate shared configuration');
console.log('PASS scoped canonical hotel and habitual collaborator rules, isolation and fresh copies');
