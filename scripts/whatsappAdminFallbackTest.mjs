import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const tempDir = mkdtempSync(path.join(tmpdir(), 'whatsapp-admin-fallback-test-'));
const outfile = path.join(tempDir, 'bundle.mjs');

try {
  await build({
    entryPoints: ['scripts/whatsappAdminFallbackTest.entry.ts'],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    logLevel: 'silent',
  });
  const module = await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`);
  await module.run(assert);
  console.log('whatsapp-admin-fallback-tests: OK');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
