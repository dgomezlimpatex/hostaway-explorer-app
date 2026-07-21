import assert from 'node:assert/strict';
import { read } from './planningBatchTestSupport.mjs';

const guardedPaths = [
  'supabase/functions/apply-ai-actions/index.ts',
  'supabase/functions/auto-assign-tasks/index.ts',
  'supabase/functions/batch-create-tasks/index.ts',
  'src/services/autoAssignment/databaseService.ts',
  'src/services/planning/operationalPlanningService.ts',
  'src/services/storage/multipleTaskAssignmentService.ts',
];

const directTaskProjectionWrite = /\.from\(\s*['"]tasks['"]\s*\)[\s\S]{0,1200}?\.(?:update|insert|upsert)\s*\(\s*\{[\s\S]{0,900}?\b(?:cleaner_id|cleaner)\s*:/g;
const allowedRpcNames = /(?:set_task_assignments|create_tasks_with_assignments|apply_planning_batch)/;
const violations = [];

for (const path of guardedPaths) {
  const source = read(path);
  for (const match of source.matchAll(directTaskProjectionWrite)) {
    const context = source.slice(Math.max(0, match.index - 300), match.index + match[0].length + 300);
    if (!allowedRpcNames.test(context)) violations.push(`${path}:${source.slice(0, match.index).split('\n').length}`);
  }

  if (/apply-ai-actions|auto-assign-tasks|batch-create-tasks|databaseService|operationalPlanningService/.test(path)) {
    assert.match(
      source,
      /\.rpc\(\s*['"](?:set_task_assignments|create_tasks_with_assignments|apply_planning_batch)['"]/,
      `${path} debe delegar asignaciones a un writer canónico`,
    );
  }
}

assert.deepEqual(
  violations,
  [],
  `writers directos a tasks.cleaner/cleaner_id detectados:\n${violations.join('\n')}`,
);

console.log('legacy-assignment-writer-guard-tests: OK');
