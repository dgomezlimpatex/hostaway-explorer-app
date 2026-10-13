import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const temp = mkdtempSync(join(tmpdir(), 'financial-review-'));
try {
  await build({ entryPoints: ['src/features/financial/financialReviewRows.ts'], outfile: join(temp, 'review.mjs'), bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
  const { reviewLists, firstReviewKind } = await import(pathToFileURL(join(temp, 'review.mjs')));
  const service = (id, date, revenue, result, pending = []) => ({ id, date, revenue, result, pending, propertyName: id, clientName: 'C' });
  const result = {
    services: [service('healthy', '2026-09-01', 10000, 5000), service('thin', '2026-09-02', 10000, 999, ['Cantidad pendiente']), service('limit', '2026-09-03', 10000, 1000), service('loss', '2026-09-04', 10000, -500), service('recent', '2026-10-12', 10000, 4000, ['Horas pendientes'])],
    incomes: [{ id: 'external', date: '2026-08-01', revenue: 5000, pending: ['Coste externo'], propertyName: 'Recepción' }, { id: 'clean-income', date: '2026-08-01', revenue: 100, pending: [], propertyName: 'Otro' }],
    excludedIncomeServices: [service('free', '2026-09-05', 0, null), service('unpriced', '2026-09-06', null, null)],
    clients: [{ id: 'k1', name: 'Margen justo', margin: 10 }, { id: 'k2', name: 'Margen flojo', margin: 4.5 }, { id: 'k3', name: 'Sin base', margin: null }],
  };
  const rules = { margin: 10, days: 7, zero: true };
  const lists = reviewLists(result, rules, '2026-10-13');

  assert.deepEqual(lists.low.map(row => row.id), ['thin', 'loss'], 'Low margin is strictly below 10 % and negative results count');
  assert.deepEqual(lists.pendingServices.map(row => [row.service.id, row.age]), [['thin', 41], ['recent', null]], 'Only pending older than the limit carry an age (in days)');
  assert.deepEqual(lists.pendingIncomes.map(row => [row.income.id, row.age]), [['external', 73]], 'External incomes with pending costs are listed too');
  assert.equal(lists.old, 2, 'Only pending older than the configured days are "old"');
  assert.deepEqual(lists.clients.map(row => row.id), ['k2'], 'Client threshold is strict and ignores clients without a margin');
  assert.deepEqual([lists.zero, lists.unpriced], [1, 1]);
  assert.deepEqual(lists.counts, { low: 2, pending: 3, excluded: 2, clients: 1 });
  assert.equal(firstReviewKind(lists.counts), 'low');

  // Rules change what is listed: a higher client threshold, a longer age, zero-revenue warning off.
  const strict = reviewLists(result, { margin: 11, days: 60, zero: false }, '2026-10-13');
  assert.deepEqual(strict.clients.map(row => row.id), ['k1', 'k2']);
  assert.equal(strict.old, 1, 'Only the 73-day external income is older than 60 days');
  assert.deepEqual(strict.excluded.map(row => row.id), ['unpriced'], 'Zero-revenue services disappear with their warning; unknown prices never do');
  assert.deepEqual([strict.zero, strict.unpriced, strict.counts.excluded], [0, 1, 1]);
  const none = reviewLists({ services: [service('ok', '2026-10-01', 10000, 6000)], incomes: [], excludedIncomeServices: [], clients: [] }, rules, '2026-10-13');
  assert.deepEqual(none.counts, { low: 0, pending: 0, excluded: 0, clients: 0 });
  assert.equal(firstReviewKind(none.counts), 'low', 'Opens on the first list when everything is clean');
  assert.equal(firstReviewKind({ low: 0, pending: 0, excluded: 3, clients: 1 }), 'excluded');
  assert.equal(firstReviewKind({ low: 0, pending: 0, excluded: 0, clients: 2 }), 'clients');
  console.log('financial-review: low-margin/pending/excluded/client lists, ages, rule changes and default list passed');
} finally { rmSync(temp, { recursive: true, force: true }); }
