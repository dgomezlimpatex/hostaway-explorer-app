import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(
  join(process.cwd(), 'src/services/planning/operationalPlanningService.ts'),
  'utf8',
);

assert.match(source, /getPlanningBatchClientFlags/);
assert.match(source, /applyPlanningBatch/);
const approveBlock = source.slice(
  source.indexOf('async approveRun('),
  source.indexOf('async discardRun('),
);
const v2Start = approveBlock.indexOf('getPlanningBatchClientFlags().writeEnabled');
const legacyStart = approveBlock.indexOf('const userId =');
assert.ok(v2Start >= 0 && legacyStart > v2Start, 'v2 debe decidirse antes de cualquier writer legacy');
const v2Block = approveBlock.slice(v2Start, legacyStart);
assert.match(v2Block, /batchId:\s*preview\.run\.id/);
assert.match(v2Block, /idempotencyKey:\s*`planning-run:\$\{preview\.run\.id\}:v\$\{preview\.run\.version\}`/);
assert.match(v2Block, /sourceRunId:\s*preview\.run\.id/);
assert.match(v2Block, /sourceRunVersion:\s*preview\.run\.version/);
for (const expectedField of [
  'expected_planning_version',
  'expected_status',
  'expected_start_time',
  'expected_end_time',
  'expected_cleaner_ids',
]) {
  assert.match(v2Block, new RegExp(`${expectedField}:`));
}
assert.match(v2Block, /const result = await applyPlanningBatch/);
assert.match(v2Block, /if \(result\.status !== 'applied'\)/);
assert.doesNotMatch(v2Block, /set_task_assignments/);
assert.match(v2Block, /const confirmed = await this\.getPreview\(runId\)/);

console.log('planning-batch-approval-client-tests: OK');
