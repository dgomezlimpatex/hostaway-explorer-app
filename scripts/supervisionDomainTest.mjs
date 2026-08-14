import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const repoRoot = process.cwd();
const outdir = mkdtempSync(join(tmpdir(), 'supervision-domain-'));
const outfile = join(outdir, 'bundle.mjs');
await build({ entryPoints: [join(repoRoot, 'scripts/supervisionDomainTest.entry.ts')], outfile, bundle: true, platform: 'node', format: 'esm', sourcemap: false, logLevel: 'silent', alias: { '@': join(repoRoot, 'src') } });
try {
  const tests = await import(pathToFileURL(outfile).href);
  tests.run(assert);
  console.log('supervision-domain-tests: OK');
} finally {
  rmSync(outdir, { recursive: true, force: true });
}
