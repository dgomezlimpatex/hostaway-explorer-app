import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const repoRoot = process.cwd();
const outdir = mkdtempSync(join(tmpdir(), 'avantio-timeout-resilience-'));
const outfile = join(outdir, 'bundle.mjs');

await build({
  entryPoints: [join(repoRoot, 'scripts/avantioTimeoutResilienceTest.entry.ts')],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  sourcemap: false,
  logLevel: 'silent',
});

try {
  const tests = await import(pathToFileURL(outfile).href);
  await tests.run(assert);

  const apiSource = readFileSync(
    join(repoRoot, 'supabase/functions/avantio-sync/avantio-api.ts'),
    'utf8',
  );
  const orchestratorSource = readFileSync(
    join(repoRoot, 'supabase/functions/avantio-sync/sync-orchestrator.ts'),
    'utf8',
  );
  assert.match(apiSource, /httpGet\(nextUrl,[\s\S]*deadlineAt: options\.deadlineAt/);
  assert.match(apiSource, /getBookingDetail\(token, sampleBookingId, options\)/);
  assert.match(apiSource, /err instanceof AvantioSourceBudgetExceededError\) throw err/);
  assert.match(orchestratorSource, /const SYNC_WORK_BUDGET_MS = 110000/);
  assert.match(orchestratorSource, /const SOURCE_FETCH_BUDGET_MS = 70000/);
  assert.match(orchestratorSource, /fetchAllAvantioReservations\(token, \{ deadlineAt: sourceDeadlineAt \}\)/);
  assert.match(orchestratorSource, /assertWithinSyncBudget\(`process reservation/);

  console.log('avantio-timeout-resilience-tests: OK');
} finally {
  rmSync(outdir, { recursive: true, force: true });
}
