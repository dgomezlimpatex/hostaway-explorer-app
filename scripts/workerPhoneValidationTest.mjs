import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const repoRoot = process.cwd();
const outdir = mkdtempSync(join(tmpdir(), 'worker-phone-validation-'));
const outfile = join(outdir, 'bundle.mjs');
try {
  await build({
    entryPoints: [join(repoRoot, 'scripts/workerPhoneValidationTest.entry.ts')],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    logLevel: 'silent',
    alias: { '@': join(repoRoot, 'src') },
  });
  const tests = await import(pathToFileURL(outfile).href);
  tests.run(assert);
  console.log('worker-phone-validation-tests: OK');
} finally {
  rmSync(outdir, { recursive: true, force: true });
}
