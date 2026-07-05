import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const repoRoot = process.cwd();
const outdir = mkdtempSync(join(tmpdir(), 'cleaning-planning-domain-safety-'));
const outfile = join(outdir, 'bundle.mjs');

await build({
  entryPoints: [join(repoRoot, 'scripts/cleaningPlanningDomainSafetyTest.entry.ts')],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  sourcemap: false,
  logLevel: 'silent',
  alias: { '@': join(repoRoot, 'src') },
});

try {
  const tests = await import(pathToFileURL(outfile).href);
  await tests.run(assert);
  console.log('cleaning-planning-domain-safety-tests: OK');
} finally {
  rmSync(outdir, { recursive: true, force: true });
}
