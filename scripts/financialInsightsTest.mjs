import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
const path = join(tmpdir(), `financial-insights-${process.pid}.cjs`);
const bundle = await build({ stdin: { contents: "export * from './src/features/financial/financialInsights'; export * from './src/features/financial/financialClientSorting'; export * from './src/features/financial/financialModel';", resolveDir: process.cwd() }, bundle: true, write: false, platform: 'node', format: 'cjs' });
writeFileSync(path, bundle.outputFiles[0].text);
try {
  const { comparisonPeriod, financialHistoryRange, financialInsights, kpiChange, sortFinancialClients, analyze, QUANTITY_ITEMS } = await import(pathToFileURL(path).href).then(module => module.default);
  const filters = { start: '2026-09-01', end: '2026-09-30', clients: [], properties: [], workers: [] };
  assert.deepEqual(comparisonPeriod(filters), { start: '2026-08-01', end: '2026-08-31', label: 'vs mes anterior' });
  assert.deepEqual(comparisonPeriod({ start: '2024-03-01', end: '2024-03-31' }), { start: '2024-02-01', end: '2024-02-29', label: 'vs mes anterior' });
  assert.deepEqual(comparisonPeriod({ start: '2026-03-25', end: '2026-03-30' }), { start: '2026-02-25', end: '2026-02-28', label: 'vs mes anterior' });
  assert.deepEqual(comparisonPeriod({ start: '2026-12-29', end: '2027-01-02' }), { start: '2026-12-24', end: '2026-12-28', label: 'vs periodo anterior equivalente' });
  assert.deepEqual(comparisonPeriod({ start: '2026-01-01', end: '2026-12-31' }), { start: '2025-01-01', end: '2025-12-31', label: 'vs año anterior' });
  assert.equal(comparisonPeriod({ start: '2026-02-30', end: '2026-03-01' }), null);
  assert.equal(comparisonPeriod({ start: '2026-03-10', end: '2026-03-01' }), null);
  assert.deepEqual(financialHistoryRange(filters), { start: '2025-10-01', end: '2026-09-30' });
  assert.deepEqual(financialHistoryRange({ ...filters, start: '2026-01-01', end: '2026-12-31' }), { start: '2025-01-01', end: '2026-12-31' });
  assert.deepEqual(financialHistoryRange({ ...filters, start: '2026-09-15', end: '2026-09-20' }), { start: '2025-10-01', end: '2026-09-30' });
  const settings = { version: 1, rates: [], expenses: [], adjustments: {}, incomes: [{ id: 'fixed', label: 'Recepción', mode: 'monthly', start: '2025-01-01', end: '', income: 10000, cost: 2000, weeklyHours: 0, costCategory: 'personal', clientId: 'c', propertyId: 'p', workerId: 'w', notes: '', overrides: { '2026-09': { income: 12000, cost: 3000, weeklyHours: 0 } } }] };
  const service = { id: 's', type: 'limpieza', date: '2026-09-20', clientId: 'c', clientName: 'Cliente', propertyId: 'p', propertyName: 'Piso', revenue: 16000, revenueEstimated: false, workers: [{ id: 'w', name: 'Ana', minutes: 60, actual: true }], quantities: Object.fromEntries(QUANTITY_ITEMS.map(item => [item.id, 0])) };
  const services = [service, { ...service, id: 'old', date: '2026-08-20', revenue: 10000 }];
  for (const selection of [filters, { ...filters, clients: ['c'] }, { ...filters, properties: ['p'] }, { ...filters, workers: ['w'] }]) {
    const insights = financialInsights(services, settings, selection);
    assert.equal(insights.rows.length, 12);
    assert.equal(insights.rows.slice(-6).length, 6);
    assert.deepEqual(insights.previous, analyze(services, settings, { ...selection, start: '2026-08-01', end: '2026-08-31' }).total);
    for (const row of insights.rows) assert.equal(row.result, analyze(services, settings, { ...selection, start: row.start, end: row.end }).total.result);
    assert.equal(insights.rows.at(-1).revenue, analyze(services, settings, selection).total.revenue);
  }
  const total = analyze(services, settings, filters).total;
  assert.deepEqual(kpiChange({ ...total, revenue: 100 }, { ...total, revenue: 0 }, 'revenue'), { delta: 100, relative: null, direction: 'better' });
  assert.equal(kpiChange(total, null, 'revenue'), null);
  assert.equal(kpiChange({ ...total, margin: null }, total, 'margin'), null);
  assert.deepEqual(kpiChange({ ...total, margin: 20 }, { ...total, margin: 15 }, 'margin'), { delta: 5, relative: null, direction: 'better' });
  assert.deepEqual(kpiChange({ ...total, expense: 200 }, { ...total, expense: 100 }, 'expense'), { delta: 100, relative: 100, direction: 'worse' });
  assert.deepEqual(kpiChange({ ...total, result: -50 }, { ...total, result: -100 }, 'result'), { delta: 50, relative: 50, direction: 'better' });
  const rows = [{ ...total, id: 'a', name: 'Cliente 10', revenue: 10, margin: null }, { ...total, id: 'b', name: 'Cliente 2', revenue: 30, margin: 5 }, { ...total, id: 'c', name: 'Ático', revenue: 20, margin: -2 }];
  assert.deepEqual(sortFinancialClients(rows, 'name', false).map(row => row.id), ['c', 'b', 'a']);
  assert.deepEqual(sortFinancialClients(rows, 'revenue', true).map(row => row.id), ['b', 'c', 'a']);
  assert.deepEqual(sortFinancialClients(rows, 'margin', false).map(row => row.id), ['c', 'b', 'a']);
  assert.deepEqual(sortFinancialClients(rows, 'margin', true).map(row => row.id), ['b', 'c', 'a']);
  assert.deepEqual(rows.map(row => row.id), ['a', 'b', 'c'], 'Sorting must preserve the source analysis');
  console.log('financial-insights: equivalent periods, full/partial/leap months, annual/custom history, real-engine reconciliation and filters, zero/negative/missing bases, expense direction, percentage points and stable null-last sorting passed');
} finally { unlinkSync(path); }
