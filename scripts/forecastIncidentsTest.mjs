import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = mkdtempSync(join(tmpdir(), 'forecast-incidents-'));
try {
  const file = join(dir, 'test.mjs');
  await build({ entryPoints: ['scripts/forecastIncidentsTest.entry.ts'], bundle: true, platform: 'node', format: 'esm', outfile: file, logLevel: 'silent' });
  await import(pathToFileURL(file).href);
} finally { rmSync(dir, { recursive: true, force: true }); }
