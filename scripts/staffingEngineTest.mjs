import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outdir = mkdtempSync(join(tmpdir(), 'staffing-engine-'));
try {
  const outfile = join(outdir, 'bundle.mjs');
  await build({ entryPoints: ['scripts/staffingEngineTest.entry.ts'], outfile,
    bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
  await import(pathToFileURL(outfile).href);
} finally {
  rmSync(outdir, { recursive: true, force: true });
}
