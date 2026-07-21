import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'planning-batch-client-'));
const outfile = join(dir, 'test.mjs');
try {
  await build({
    entryPoints: ['scripts/planningBatchClientTest.entry.ts'],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    tsconfig: 'tsconfig.json',
  });
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
    key: () => null,
    length: 0,
  };
  const { run } = await import(`${pathToFileURL(outfile).href}?v=${Date.now()}`);
  await run(assert);
  console.log('planning-batch-client-tests: OK');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
