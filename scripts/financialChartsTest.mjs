import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const folder = mkdtempSync(join(tmpdir(), 'financial-charts-'));
try {
  await build({ stdin: { contents: "export * from './src/features/financial/financialCharts';export * from './src/features/financial/financialModel';", resolveDir: process.cwd(), loader: 'ts' }, outfile: join(folder, 'model.mjs'), bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
  const { analyze, dashboardSeries, monthlyTrend, trendPeriods, adjacentMonth, monthlyColumns, periodColumns, incomeColor, QUANTITY_ITEMS } = await import(pathToFileURL(join(folder, 'model.mjs')));
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
    assert.ok(series.costs.every(row => row.value >= 0), 'Expense columns represent full category amounts, not waterfall deductions');
    assert.equal(result.total.revenue - series.costs.reduce((sum, row) => sum + row.value, 0), result.total.result);
    const columns = periodColumns(result.total);
    assert.deepEqual(columns.series.slice(0, 5).map(column => column.name), ['Ingresos', 'Personal', 'Lavandería', 'Amenities y consumibles', 'Productos']);
    assert.equal(columns.values.personal, result.total.costs.personal + result.total.costs.salary);
    assert.equal(columns.series.slice(1).reduce((sum, column) => sum + columns.values[column.id], 0), result.total.expense);
    assert.equal(new Set(columns.series.map(column => column.color)).size, columns.series.length, 'Each income/expense concept has its own stable color');
  }
  const result = analyze(services, settings, filters), series = dashboardSeries(result);
  assert.equal(series.incomes.find(row => row.id === 'cloth').value, 25, 'One charge per cleaning, not per cloth');
  assert.equal(series.incomes.find(row => row.id === 'supplements').value, 275);
  assert.equal(series.incomes.find(row => row.id === 'cleaning').value, 10000);
  assert.equal(series.incomes.find(row => row.id === 'services').value, 2000);
  assert.equal(result.excludedIncomeServices.length, 2);
  assert.equal(result.general.expense, 750);
  const structureSettings = { ...settings, incomes: [], rates: [{ item: 'tourismSalary', date: '2000-01-01', mills: 2317000 }], expenses: [settings.expenses[0],
    { ...settings.expenses[0], id: 'structure', label: 'Personal de estructura', category: 'personal', cents: 10000 },
    { ...settings.expenses[0], id: 'direction', label: 'Otro coste de dirección', category: 'salary', cents: 5000 }] };
  const withStructure = analyze([service], structureSettings, filters);
  assert.equal(withStructure.total.costs.personal, 12900);
  assert.equal(withStructure.total.costs.salary, 236700);
  assert.equal(periodColumns(withStructure.total).values.personal, 249600, 'Operational staff, structure and direction are included once in Personal');
  assert.equal(dashboardSeries(withStructure).costs.find(row => row.id === 'personal').value, 249600);
  assert.ok(!dashboardSeries(withStructure).costs.some(row => row.id === 'salary'), 'Direction has no second expense column');
  assert.equal(periodColumns(withStructure.total).series.at(-1).id, 'other', 'Additional expenses remain visible and reconcile');
  const withoutOther = analyze([service], { ...structureSettings, expenses: structureSettings.expenses.slice(1) }, filters);
  assert.equal(periodColumns(withoutOther.total).series.length, 5, 'Exactly five columns when no other expenses are included');
  for (const selection of [{ ...filters, clients: ['c'] }, { ...filters, properties: ['p'] }, { ...filters, workers: ['w'] }]) {
    const filtered = analyze([service], structureSettings, selection);
    assert.equal(filtered.total.costs.salary, 0, 'General direction costs are not arbitrarily allocated to filtered activity');
    assert.equal(periodColumns(filtered.total).values.personal, 2900);
    assert.equal(periodColumns(filtered.total).series.length, 5);
  }
  const partialStructure = analyze([service], structureSettings, { ...filters, end: '2026-09-15' });
  assert.equal(periodColumns(partialStructure.total).values.personal, 133750, 'Partial periods retain the existing direction salary proration');
  const structureMonths = monthlyTrend([service], structureSettings, filters, false);
  for (const view of ['balance', 'costs']) {
    const columns = monthlyColumns(structureMonths, view);
    assert.equal(columns.groups.at(-1).values.personal, 249600);
    assert.equal(columns.groups.at(-2).values.personal, 231700, 'Monthly direction salary is included in each applicable month');
    assert.ok(!columns.series.some(column => column.id === 'salary'));
    for (const [index, group] of columns.groups.entries()) {
      assert.equal(columns.series.filter(column => column.id !== 'revenue').reduce((sum, column) => sum + group.values[column.id], 0), structureMonths[index].expense);
      for (const column of columns.series) assert.equal(column.color, periodColumns(withStructure.total).series.find(current => current.id === column.id).color);
    }
  }
  const negative = analyze([{ ...service, revenue: 100 }], settings, { ...filters, clients: ['c'] });
  assert.ok(negative.total.result < 0);
  assert.ok(dashboardSeries(negative).costs.every(row => row.value >= 0));
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
    for (const view of ['balance', 'costs', 'incomes']) {
      const columns=monthlyColumns(rows,view);
      assert.equal(columns.groups.length,6);
      assert.equal(new Set(columns.series.map(column=>column.id)).size,columns.series.length);
      for (const [index,group] of columns.groups.entries()) {
        const values=columns.series.map(column=>group.values[column.id]??0);
        if(view==='balance') {
          assert.equal(values[0],rows[index].revenue);
          assert.equal(values.slice(1).reduce((sum,value)=>sum+value,0),rows[index].expense);
          assert.equal(group.values.personal,rows[index].costs.personal+rows[index].costs.salary);
        }
        else assert.equal(values.reduce((sum,value)=>sum+value,0),view==='costs'?rows[index].expense:rows[index].revenue);
      }
      if(view==='incomes')for(const column of columns.series)assert.equal(column.color,incomeColor(column.id),'Same concept keeps its color across periods');
    }
    assert.equal(monthlyColumns(rows,'costs').series.length,5);
    assert.equal(monthlyColumns(rows,'incomes').groups.at(-2).values['external:Lavandería externa']??0,0,'Absent manual income remains absent in that month');
    assert.equal(rows.at(-1).manualCount, 1); assert.equal(rows.at(-2).manualCount, 0);
    assert.equal(rows.at(-1).pending, 1); assert.equal(rows.at(-1).excludedPrices, 1);
  }
  const partial = monthlyTrend(services, settings, { ...filters, start: '2026-09-05', end: '2026-09-08', clients: ['external'] }, true).at(-1);
  assert.equal(partial.start, '2026-09-01'); assert.equal(partial.revenue, Math.round(31000 * 8 / 30)); assert.equal(partial.manualCount, 0);
  assert.equal(JSON.stringify({ settings, services }), snapshot, 'Charts must never mutate settings or source services');
  console.log('financial-charts: five ordered concepts, personnel including direction/structure once, other expenses, filtered/external-only/empty/loss, supplements, monthly reconciliation and proration passed');
} finally { rmSync(folder, { recursive: true, force: true }); }
