import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const outdir = mkdtempSync(join(tmpdir(), 'multi-worker-schedule-'));
const outfile = join(outdir, 'bundle.mjs');

try {
  await build({
    entryPoints: ['scripts/multiWorkerScheduleTest.entry.ts'],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile,
    logLevel: 'silent',
  });
  await import(pathToFileURL(outfile).href);
} finally {
  rmSync(outdir, { recursive: true, force: true });
}
