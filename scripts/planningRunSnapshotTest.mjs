import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (path) => readFileSync(join(process.cwd(), path), 'utf8');
const types = read('src/types/operationalPlanning.ts');
const service = read('src/services/planning/operationalPlanningService.ts');

for (const field of [
  'expectedPlanningVersion',
  'expectedStatus',
  'expectedStartTime',
  'expectedEndTime',
  'expectedCleanerIds',
]) {
  assert.match(types, new RegExp(`\\b${field}\\??:`), `PlanningRunItemProposal debe tipar ${field}`);
}
assert.match(service, /planning_version\?:\s*number/);
assert.match(service, /id, property, address, date, start_time, end_time,[\s\S]{0,160}planning_version/);
assert.ok(
  (service.match(/expectedPlanningVersion:\s*Number\(task\.planning_version/g) || []).length >= 2,
  'todos los generadores de propuestas deben capturar planning_version',
);
assert.ok(
  (service.match(/expectedCleanerIds:\s*getTaskCleanerIds\(task\)/g) || []).length >= 2,
  'todos los generadores deben capturar el conjunto canónico original',
);

console.log('planning-run-snapshot-tests: OK');
