import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outdir = mkdtempSync(join(tmpdir(), 'staffing-collaborators-'));
try {
  const outfile = join(outdir, 'bundle.mjs');
  const result = await build({ entryPoints: ['scripts/staffingCollaboratorsTest.entry.ts'], outfile,
    bundle: true, platform: 'node', format: 'esm', logLevel: 'silent', metafile: true });
  assert.ok(Object.keys(result.metafile.inputs).every(path => !/supabase|readClient|\/data\.ts$/.test(path)), 'Pure adapter/engine only: no database client or reader');
  globalThis.fetch = () => { throw new Error('Network forbidden in collaborator tests'); };
  await import(pathToFileURL(outfile).href);
} finally {
  rmSync(outdir, { recursive: true, force: true });
}
