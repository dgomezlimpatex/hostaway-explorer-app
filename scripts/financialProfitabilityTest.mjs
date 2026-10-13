import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const temp = mkdtempSync(join(tmpdir(), 'financial-profitability-'));
try {
  await build({ entryPoints: ['src/features/financial/financialProfitabilityRows.ts'], outfile: join(temp, 'rows.mjs'), bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
  const { quickCounts, filterProfitability, isLoss, isLow, LOW_MARGIN } = await import(pathToFileURL(join(temp, 'rows.mjs')));
  const row = (id, name, revenue, result, pending = 0) => ({ id, name, revenue, result, expense: revenue - result, margin: revenue ? result / revenue * 100 : null, pending });
  const rows = [row('a', 'Atlántico Apartamentos', 100000, 30000), row('b', 'Casa Herrero', 50000, -2000, 3), row('c', 'Orzán Rooms', 100000, 9999, 1), row('d', 'Sin ingresos', 0, 0), row('e', 'Límite exacto', 100000, 10000)];

  assert.equal(LOW_MARGIN, 10);
  assert.deepEqual(quickCounts(rows), { all: 5, loss: 1, low: 2, pending: 2 }, 'Loss, low margin (strictly below 10 %, with revenue) and pending are counted separately');
  assert.ok(isLoss(rows[1]) && !isLoss(rows[3]), 'Zero result is not a loss');
  assert.ok(isLow(rows[1]) && isLow(rows[2]) && !isLow(rows[4]), 'Exactly 10 % is not low');
  assert.ok(!isLow(rows[3]), 'A row without revenue has no margin to judge');

  assert.deepEqual(filterProfitability(rows, 'all', '').map(item => item.id), ['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(filterProfitability(rows, 'loss', '').map(item => item.id), ['b']);
  assert.deepEqual(filterProfitability(rows, 'low', '').map(item => item.id), ['b', 'c']);
  assert.deepEqual(filterProfitability(rows, 'pending', '').map(item => item.id), ['b', 'c']);
  assert.deepEqual(filterProfitability(rows, 'all', 'atlantico').map(item => item.id), ['a'], 'Search ignores accents and case');
  assert.deepEqual(filterProfitability(rows, 'all', '  ORZAN ').map(item => item.id), ['c'], 'Search trims spaces');
  assert.deepEqual(filterProfitability(rows, 'low', 'casa').map(item => item.id), ['b'], 'Quick filter and search combine');
  assert.deepEqual(filterProfitability(rows, 'loss', 'orzan'), [], 'Empty result is an empty list, not an error');
  assert.deepEqual(quickCounts([]), { all: 0, loss: 0, low: 0, pending: 0 });
  console.log('financial-profitability: loss/low-margin/pending counts, boundaries, accent-insensitive search and combined filters passed');
} finally { rmSync(temp, { recursive: true, force: true }); }
