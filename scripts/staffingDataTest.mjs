import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const out = mkdtempSync(join(tmpdir(), 'staffing-data-test-'));
try {
  const outfile = join(out, 'test.mjs');
  const result = await build({ entryPoints: ['scripts/staffingDataTest.entry.ts'], outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent', metafile: true,
    plugins: [{ name: 'offline-staffing-reader', setup(build) {
      build.onResolve({ filter: /integrations\/supabase\/client$/ }, () => ({ path: 'offline-client', namespace: 'staffing-test' }));
      build.onLoad({ filter: /.*/, namespace: 'staffing-test' }, () => ({ contents: `
        export const supabase = { from() {
          const query = {
            select() { return query; }, eq() { return query; }, in() { return query; },
            gte() { return query; }, lte() { return query; },
            order(column, options) { if (column !== 'id' || options.ascending !== true) throw Error('unstable ordering'); return query; },
            range() { return Promise.resolve({ data: [], error: null }); }
          };
          return query;
        }};
      `, loader: 'js' }));
    } }],
  });
  assert.ok(!Object.keys(result.metafile.inputs).some(path => path.endsWith('integrations/supabase/client.ts')), 'production client must never enter the offline test bundle');
  // Fail any accidental network attempt, even if a future import escapes the bundle guard.
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('Network forbidden in staffing data tests'); };
  try { await (await import(pathToFileURL(outfile).href)).run(process.argv[2]); }
  finally { globalThis.fetch = originalFetch; }
  console.log('staffing-data-tests: OK (offline adapter + real readClient spec validation)');
} finally { rmSync(out, { recursive: true, force: true }); }
