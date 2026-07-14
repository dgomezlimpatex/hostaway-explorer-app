import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const repoRoot = process.cwd();
const outdir = mkdtempSync(join(tmpdir(), 'whatsapp-webhook-approval-'));
const outfile = join(outdir, 'bundle.mjs');

try {
  await build({
    entryPoints: [join(repoRoot, 'scripts/whatsappWebhookApprovalTest.entry.ts')],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    sourcemap: false,
    logLevel: 'silent',
  });
  const tests = await import(pathToFileURL(outfile).href);
  await tests.run(assert);
  console.log('whatsapp-webhook-approval-tests: OK');
} finally {
  rmSync(outdir, { recursive: true, force: true });
}
