import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const temp = mkdtempSync(join(tmpdir(), 'financial-months-'));
try {
  await build({ entryPoints: ['src/features/financial/financialMonths.ts'], outfile: join(temp, 'months.mjs'), bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
  const { monthsCovering, monthBounds, olderMonths, monthStaleTime, MAX_MONTHS, MONTH_STALE_MS, OPEN_MONTH_STALE_MS } = await import(pathToFileURL(join(temp, 'months.mjs')));

  // Month bounds: exact calendar edges, leap years included.
  assert.deepEqual(monthBounds('2026-10'), { start: '2026-10-01', end: '2026-10-31' });
  assert.deepEqual(monthBounds('2026-02'), { start: '2026-02-01', end: '2026-02-28' });
  assert.deepEqual(monthBounds('2028-02'), { start: '2028-02-01', end: '2028-02-29' });
  assert.deepEqual(monthBounds('2026-12'), { start: '2026-12-01', end: '2026-12-31' });

  // Covering months: every touched month once, oldest first, across year boundaries.
  assert.deepEqual(monthsCovering('2026-10-13', '2026-10-13'), ['2026-10']);
  assert.deepEqual(monthsCovering('2026-10-01', '2026-10-31'), ['2026-10']);
  assert.deepEqual(monthsCovering('2025-11-01', '2026-10-31').length, 12);
  assert.deepEqual(monthsCovering('2025-11-20', '2026-02-03'), ['2025-11', '2025-12', '2026-01', '2026-02']);
  assert.deepEqual(monthsCovering('2026-01-01', '2026-12-31').at(-1), '2026-12');
  assert.deepEqual(monthsCovering('2026-10-14', '2026-10-13'), [], 'A reversed range reads nothing');
  assert.deepEqual(monthsCovering('', '2026-10-13'), []);
  assert.deepEqual(monthsCovering('2026-13-01', '2026-13-28'), [], 'An impossible month reads nothing');
  assert.equal(monthsCovering('2021-10-01', '2026-09-30').length, MAX_MONTHS, 'Five years is still allowed');
  assert.throws(() => monthsCovering('2000-01-01', '2026-10-31'), /demasiados registros/, 'A huge range is refused instead of reading everything');

  // Older months: what stepping back reaches, nearest first.
  assert.deepEqual(olderMonths(['2026-09', '2026-10'], 3), ['2026-08', '2026-07', '2026-06']);
  assert.deepEqual(olderMonths(['2026-02'], 3), ['2026-01', '2025-12', '2025-11'], 'Crosses the year');
  assert.deepEqual(olderMonths([], 3), []);

  // Cache lifetime: closed months stay fresh longer than the current or future ones.
  assert.equal(monthStaleTime('2026-09', '2026-10-13'), MONTH_STALE_MS);
  assert.equal(monthStaleTime('2026-10', '2026-10-13'), OPEN_MONTH_STALE_MS);
  assert.equal(monthStaleTime('2026-11', '2026-10-13'), OPEN_MONTH_STALE_MS);
  assert.ok(OPEN_MONTH_STALE_MS < MONTH_STALE_MS);
  console.log('financial-months: calendar bounds, covering months across years, invalid/huge ranges, older-month warming and cache lifetimes passed');
} finally { rmSync(temp, { recursive: true, force: true }); }
