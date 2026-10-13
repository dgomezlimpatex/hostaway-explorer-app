import assert from 'node:assert/strict';
import { ESLint } from 'eslint';
const eslint = new ESLint();
const [baseline, candidate] = await eslint.lintFiles([
  'scripts/fixtures/laundryRouteWorkflowDeployed20261013.ts',
  'supabase/functions/laundry-route-workflow/index.ts',
]);
const signatures = result => result.messages.map(({ruleId,message,severity}) => JSON.stringify({ruleId,message,severity})).sort();
assert.deepEqual(signatures(candidate), signatures(baseline), 'No lint diagnostics beyond the exact deployed handler');
console.log(`PASS focalized lint: ${candidate.errorCount} inherited errors, ${candidate.warningCount} warnings, no new diagnostics.`);
