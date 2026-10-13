import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const temp = mkdtempSync(join(tmpdir(), 'financial-service-filter-'));
try {
  await build({ entryPoints: ['src/features/financial/financialServiceFilter.ts'], outfile: join(temp, 'filter.mjs'), bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
  const { matchesProfit } = await import(pathToFileURL(join(temp, 'filter.mjs')));
  const service = (revenue, result) => ({ revenue, result });
  const rows = { healthy: service(10000, 5000), thin: service(10000, 999), edge: service(10000, 1000), loss: service(10000, -1), zeroResult: service(10000, 0), unpriced: service(null, null), free: service(0, 0) };
  const ids = filter => Object.entries(rows).filter(([, row]) => matchesProfit(row, filter)).map(([id]) => id);

  assert.deepEqual(ids('all'), Object.keys(rows), 'Everything is listed without a filter');
  assert.deepEqual(ids('negative'), ['loss'], 'Only a result below zero is negative; zero and unknown are not');
  assert.deepEqual(ids('low'), ['thin', 'loss', 'zeroResult'], 'Low margin is strictly below 10 % of a positive billing, losses included');
  assert.ok(!matchesProfit(rows.edge, 'low'), 'Exactly 10 % is not low');
  assert.ok(!matchesProfit(rows.unpriced, 'low') && !matchesProfit(rows.free, 'low'), 'No billing means no margin to judge');
  console.log('financial-service-filter: negative and low-margin boundaries, zero/unknown billing and the unfiltered list passed');
} finally { rmSync(temp, { recursive: true, force: true }); }
