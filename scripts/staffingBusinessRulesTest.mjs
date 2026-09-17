import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle = await build({ entryPoints: ['src/features/staffing/businessRules.ts'], bundle: true, write: false, platform: 'node', format: 'esm', metafile: true, logLevel: 'silent' });
assert.ok(!Object.keys(bundle.metafile.inputs).some(path => path.includes('supabase/client')), 'rules must not load a production client');
const { staffingRulesForSede } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const sede = '1e0759ec-5e63-4edd-9dad-e493c715bbba';
const property = 'e0c82e3d-f702-4842-8c34-c987a6fd9c2e';
// Confirmado por Dani: fuera de la previsión general de limpieza.
const outOfForecast = [
  '3da6d3e9-9e0b-4863-aab2-d371a20d2bb7', // DANIEL GOMEZ HERMIDA
  'acffe4d5-05c2-4ff7-82b9-c6c4db85ee34', // AZZEDDINE CHAMSSI
  'fed80a4e-1c18-4f8e-a85d-4ff94d119064', // VICENTE MORENO LOUREDA
];
const expected = { shiftPropertyIds: [property], useHabitualCollaborators: true, allowCrossCenterMobility: true, excludedWorkerIds: outOfForecast };
assert.deepEqual(staffingRulesForSede(sede), expected, 'explicit confirmed site rules use canonical scoped identity');
for (const other of ['', 'another-sede', 'A Coruña', ` ${sede}`]) {
  assert.deepEqual(staffingRulesForSede(other), { shiftPropertyIds: [], useHabitualCollaborators: false, allowCrossCenterMobility: false, excludedWorkerIds: [] }, 'never apply business rules by a similar name or normalize malformed IDs');
}
const changed = staffingRulesForSede(sede);
changed.shiftPropertyIds.push('untrusted-property');
changed.excludedWorkerIds.push('untrusted-worker');
changed.useHabitualCollaborators = false;
assert.deepEqual(staffingRulesForSede(sede), expected, 'consumer cannot mutate shared configuration');
// La regla se aplica al leer: las personas de la lista no aportan horas, pero su
// trabajo SÍ cuenta como carga (solo NOT COUNT sale también de la carga).
const reader = (await import('node:fs')).readFileSync('src/features/staffing/data.ts', 'utf8');
assert.match(reader, /const staffingWorkers = rawWorkers\.filter\(row => !internalWorkerIds\.has\(text\(row\.id\)\) && !ruleExcludedIds\.has\(text\(row\.id\)\)\)/, 'las personas de la regla salen del equipo');
assert.match(reader, /const tasks = rawTasks\.filter\(task => !internalWorkerIds\.has\(text\(task\.cleaner_id\)\)\)/, 'solo NOT COUNT sale de la carga');
assert.doesNotMatch(reader, /rawTasks\.filter\(task => !outOfForecastIds/, 'el trabajo de las personas fuera de previsión sí suma como carga');
console.log('PASS scoped canonical hotel, collaborator and out-of-forecast worker rules, isolation and fresh copies');
