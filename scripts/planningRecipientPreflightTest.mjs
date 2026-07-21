import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = process.cwd();
const outdir = mkdtempSync(join(tmpdir(), 'planning-recipient-preflight-'));
const outfile = join(outdir, 'bundle.mjs');
try {
  await build({ entryPoints: [join(root, 'scripts/planningRecipientPreflightTest.entry.ts')], outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent', alias: { '@': join(root, 'src') } });
  const tests = await import(pathToFileURL(outfile).href);
  tests.run(assert);
  console.log('planning-recipient-preflight-tests: OK');
} finally {
  rmSync(outdir, { recursive: true, force: true });
}
