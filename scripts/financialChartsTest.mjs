import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const folder = mkdtempSync(join(tmpdir(), 'financial-charts-'));
try {
  await build({ stdin: { contents: "export * from './src/features/financial/financialCharts';export * from './src/features/financial/financialModel';", resolveDir: process.cwd(), loader: 'ts' }, outfile: join(folder, 'model.mjs'), bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
  const { analyze, dashboardSeries, monthlyTrend, trendPeriods, adjacentMonth, QUANTITY_ITEMS } = await import(pathToFileURL(join(folder, 'model.mjs')));
  const quantities = Object.fromEntries(QUANTITY_ITEMS.map(item => [item.id, 0]));
  const service = { id: 'cleaning', type: 'cleaning', date: '2026-09-08', clientId: 'c', clientName: 'Cliente', propertyId: 'p', propertyName: 'Propiedad', revenue: 10000, revenueEstimated: true, workers: [{ id: 'w', name: 'Trabajador', minutes: 120, actual: false }], quantities: { ...quantities, kitchenCloth: 2 } };
  const income = { id: 'reception', label: 'Recepción', mode: 'monthly', start: '2026-08-01', end: '', income: 31000, cost: 10000, weeklyHours: 16, costCategory: 'other', clientId: 'external', propertyId: '', workerId: '', notes: '', overrides: {} };
  const settings = { version: 1, rates: [{ item: 'tourismSalary', date: '2000-01-01', mills: 0 }], adjustments: {}, expenses: [{ id: 'general', date: '2026-09-02', label: 'General', cents: 750, category: 'other', clientId: '', propertyId: '', workerId: '' }], policies: [{ clientId: 'c', propertyId: '', kitchenClothIncome: true }], incomes: [income, { ...income, id: 'laundry', label: 'Lavandería externa', mode: 'manual', start: '2026-09-30', income: 50000, cost: null, weeklyHours: 0, costCategory: 'laundry' }, { ...income, id: 'supplement', label: 'Recepción virtual', mode: 'perCleaning', clientId: 'c', income: 275, cost: 0, weeklyHours: 0 }] };
  const filters = { start: '2026-09-01', end: '2026-09-30', clients: [], properties: [], workers: [] };
  const services = [service, { ...service, id: 'free', revenue: 0 }, { ...service, id: 'missing', revenue: null }, { ...service, id: 'check', type: 'check-in', revenue: 2000 }];
  const snapshot = JSON.stringify({ settings, services });
  for (const selection of [filters, { ...filters, clients: ['external'] }, { ...filters, clients: ['c'] }, { ...filters, properties: ['p'] }, { ...filters, workers: ['w'] }, { ...filters, clients: ['none'] }]) {
    const result = analyze(services, settings, selection), series = dashboardSeries(result);
    assert.equal(series.incomes.reduce((sum, row) => sum + row.value, 0), result.total.revenue, 'Income sources reconcile including external-only and empty filters');
    assert.equal(series.costs.reduce((sum, row) => sum + row.value, 0), result.total.expense);
    assert.equal(series.waterfall.at(-1).value, result.total.result);
    assert.equal(series.waterfall.slice(0, -1).reduce((sum, row) => sum + row.value, 0), result.total.result);
  }
  const result = analyze(services, settings, filters), series = dashboardSeries(result);
  assert.equal(series.incomes.find(row => row.id === 'cloth').value, 25, 'One charge per cleaning, not per cloth');
  assert.equal(series.incomes.find(row => row.id === 'supplements').value, 275);
  assert.equal(series.incomes.find(row => row.id === 'cleaning').value, 10000);
  assert.equal(series.incomes.find(row => row.id === 'services').value, 2000);
  assert.equal(result.excludedIncomeServices.length, 2);
  assert.equal(result.general.expense, 750);
  const negative = analyze([{ ...service, revenue: 100 }], settings, { ...filters, clients: ['c'] });
  const loss = dashboardSeries(negative).waterfall.at(-1);
  assert.ok(loss.value < 0); assert.deepEqual(loss.range, [loss.value, 0]);
  assert.deepEqual(adjacentMonth('2026-01-31', -1), { start: '2025-12-01', end: '2025-12-31' });
  assert.deepEqual(adjacentMonth('2024-01-31', 1), { start: '2024-02-01', end: '2024-02-29' });
  assert.equal(adjacentMonth('invalid', 1), null);
  assert.equal(trendPeriods('2026-03-31', true).at(-2).end, '2026-02-28');
  assert.equal(trendPeriods('2024-03-31', true).at(-2).end, '2024-02-29');
  assert.equal(trendPeriods('2026-09-08', true).at(-2).end, '2026-08-08');
  assert.equal(trendPeriods('2026-09-08', false).at(-2).end, '2026-08-31');
  for (const matching of [true, false]) {
    const rows = monthlyTrend(services, settings, filters, matching);
    assert.equal(rows.length, 6);
    for (const row of rows) {
      const expected = analyze(services, settings, { ...filters, start: row.start, end: row.end });
      assert.equal(row.revenue, expected.total.revenue); assert.equal(row.expense, expected.total.expense); assert.equal(row.result, expected.total.result);
    }
    assert.equal(rows.at(-1).manualCount, 1); assert.equal(rows.at(-2).manualCount, 0);
    assert.equal(rows.at(-1).pending, 1); assert.equal(rows.at(-1).excludedPrices, 1);
  }
  const partial = monthlyTrend(services, settings, { ...filters, start: '2026-09-05', end: '2026-09-08', clients: ['external'] }, true).at(-1);
  assert.equal(partial.start, '2026-09-01'); assert.equal(partial.revenue, Math.round(31000 * 8 / 30)); assert.equal(partial.manualCount, 0);
  assert.equal(JSON.stringify({ settings, services }), snapshot, 'Charts must never mutate settings or source services');
  console.log('financial-charts: reconciled income/cost/waterfall, filtered/external-only/empty/loss, supplements, month boundaries, comparable periods and monthly proration passed');
} finally { rmSync(folder, { recursive: true, force: true }); }
