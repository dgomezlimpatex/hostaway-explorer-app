import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { read, walk } from './planningBatchTestSupport.mjs';

const sql = walk('supabase/migrations', (path) => path.endsWith('.sql')).map(read).join('\n');
const functionSources = walk('supabase/functions', (path) => path.endsWith('.ts'))
  .map((path) => ({ path, source: read(path) }));
const allFunctions = functionSources.map(({ source }) => source).join('\n');

for (const mode of ['shadow', 'test', 'live']) {
  assert.match(allFunctions, new RegExp(`['"]${mode}['"]`), `falta adapter/mode ${mode}`);
}
assert.match(allFunctions, /PLANNING_NOTIFICATIONS_LIVE|PLANNING_NOTIFICATION_MODE/);
assert.match(allFunctions, /PLANNING_PROVIDER_SINK_URL|providerSink/i);
assert.match(allFunctions, /WHATSAPP_BATCH_DISPATCH_ENABLED/);
assert.match(allFunctions, /RESEND|EMAIL[\s\S]{0,120}ENABLED|EMAIL[\s\S]{0,120}KILL/i, 'Resend necesita kill switch independiente');
assert.doesNotMatch(sql, /(?:net\.)?http_post\s*\(|graph\.facebook\.com|api\.resend\.com/i);

const child = spawn(process.execPath, [
  'scripts/planningProviderSink.mjs',
  '--',
  process.execPath,
  '-e',
  "if (process.env.PLANNING_NOTIFICATION_MODE !== 'test') process.exit(9)",
], { cwd: process.cwd(), stdio: 'inherit' });
const exitCode = await new Promise((resolve, reject) => {
  child.once('error', reject);
  child.once('exit', resolve);
});
assert.equal(exitCode, 0);

console.log('planning-provider-safety-tests: OK (sink requests=0)');
