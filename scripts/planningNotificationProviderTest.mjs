import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root = process.cwd();
const outdir = mkdtempSync(join(tmpdir(), 'planning-provider-'));
const outfile = join(outdir, 'bundle.mjs');
try {
  await build({ entryPoints: [join(root, 'scripts/planningNotificationProviderTest.entry.ts')], outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
  const tests = await import(pathToFileURL(outfile).href);
  await tests.run(assert);
  console.log('planning-notification-provider-tests: OK');
} finally { rmSync(outdir, { recursive: true, force: true }); }
