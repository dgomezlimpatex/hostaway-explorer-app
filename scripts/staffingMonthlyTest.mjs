import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const outdir = mkdtempSync(join(tmpdir(), 'staffing-monthly-'));
try {
  const outfile = join(outdir, 'bundle.mjs');
  await build({ entryPoints: ['scripts/staffingMonthlyTest.entry.ts'], outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
  await import(pathToFileURL(outfile).href);
} finally {
  rmSync(outdir, { recursive: true, force: true });
}
