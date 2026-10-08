import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
const path = join(tmpdir(), `financial-analytics-${process.pid}.cjs`);
const bundle = await build({ stdin: { contents: "export * from './src/features/financial/financialAnalytics';export * from './src/features/financial/financialBudget';export * from './src/features/financial/financialInsights';export * from './src/features/financial/financialModel';export * from './src/features/financial/financialDrilldown';export * from './src/features/financial/financialCharts';", resolveDir: process.cwd() }, bundle: true, write: false, platform: 'node', format: 'cjs' });
writeFileSync(path, bundle.outputFiles[0].text);
try {
  const { analyze, analyzeWithAllocation, distributeCents, propertyResults, operationalKpis, financialAlerts, scopeBuildings, compareBudget, readBudgetProjection, budgetPeriodFactor, previousYearPeriod, financialHistoryRange, financialInsights, annualTrend, financialDetail, QUANTITY_ITEMS } = await import(pathToFileURL(path).href).then(module => module.default);
  const filters = { start: '2026-09-01', end: '2026-09-30', clients: [], properties: [], workers: [] };
  const settings = { version: 1, rates: [{ item: 'tourismSalary', date: '2020-01-01', mills: 1000 }], adjustments: {}, expenses: [
    { id: 'pool', date: '2026-09-10', label: 'Lavandería general', cents: 101, category: 'laundry', clientId: '', propertyId: '', workerId: '' },
    { id: 'specific', date: '2026-09-10', label: 'Coste específico', cents: 31, category: 'personal', clientId: 'c1', propertyId: 'p1', workerId: '' },
  ], incomes: [{ id: 'fixed', label: 'Recepción', mode: 'monthly', start: '2026-09-01', end: '2026-09-30', income: 5000, cost: 1000, weeklyHours: 0, costCategory: 'personal', clientId: 'c2', propertyId: '', workerId: '', notes: '', overrides: {} }] };
  const service = (id, clientId, propertyId, revenue, type = 'limpieza') => ({ id, type, date: '2026-09-10', clientId, clientName: clientId, propertyId, propertyName: propertyId, revenue, revenueEstimated: false, workers: [{ id: clientId, name: clientId, minutes: 60, actual: true }], quantities: Object.fromEntries(QUANTITY_ITEMS.map(item => [item.id, 0])) });
  const services = [service('a', 'c1', 'p1', 10000), service('b', 'c2', 'p2', 20000), service('c', 'c1', 'p3', 5000, 'check-in'), service('zero', 'c1', 'p4', 0), service('missing', 'c1', 'p4', null)];
  const original = JSON.stringify({ services, settings, filters });
  const plain = analyze(services, settings, filters), allocated = analyzeWithAllocation(services, settings, filters, 'revenue');
  assert.equal(plain.total.revenue, 40000); assert.equal(plain.total.expense, 6482); assert.equal(plain.general.expense, 201);
  assert.deepEqual(allocated.total, plain.total, 'The full business balance is invariant under allocation');
  assert.equal(allocated.general.expense, 0); assert.equal(allocated.allocation.assigned, 201);
  for (const category of Object.keys(allocated.total.costs)) assert.equal(allocated.clients.reduce((sum, row) => sum + row.costs[category], allocated.general.costs[category]), allocated.total.costs[category]);
  for (const client of allocated.clients) {
    const filtered = analyzeWithAllocation(services, settings, { ...filters, clients: [client.id] }, 'revenue');
    assert.equal(filtered.total.revenue, client.revenue); assert.equal(filtered.total.expense, client.expense);
    assert.deepEqual(financialInsights(services, settings, { ...filters, clients: [client.id] }, 'revenue').rows.at(-1).costs, client.costs);
  }
  const properties = propertyResults(allocated, [{ id: 'p1', name: 'Piso 1' }, { id: 'p2', name: 'Piso 2' }, { id: 'p3', name: 'Piso 3' }]);
  assert.equal(properties.find(row => row.id === 'p1').expense, 1831); assert.equal(properties.find(row => row.id === 'p1').allocated, 50);
  const property = analyzeWithAllocation(services, settings, { ...filters, properties: ['p1'] }, 'revenue');
  assert.equal(property.total.expense, properties.find(row => row.id === 'p1').expense);
  assert.equal(properties.reduce((sum, row) => sum + row.expense, 0) + allocated.incomes[0].expense + allocated.expenses.filter(row => !row.propertyId).reduce((sum, row) => sum + row.cents, 0), allocated.total.expense);
  const kpis = operationalKpis(plain, propertyResults(plain, []));
  assert.equal(kpis.cleaningCost, 1900); assert.equal(kpis.laundryPerService, 0); assert.equal(kpis.revenuePerProperty, 35000 / 3); assert.equal(kpis.personnelShare, 5481 / 40000 * 100);
  const count = analyzeWithAllocation(services, settings, filters, 'services');
  assert.deepEqual(count.total, plain.total); assert.equal(count.expenses.filter(row => row.id.startsWith('allocation:') && row.propertyId === 'p1').reduce((sum, row) => sum + row.cents, 0), 68);
  assert.equal(count.expenses.filter(row => row.id.startsWith('allocation:') && !row.propertyId).length, 0, 'External recurring entries are not services for service-count allocation');
  const empty = analyzeWithAllocation(services.filter(row => !row.revenue), settings, { ...filters, types: ['limpieza'] }, 'services');
  assert.equal(empty.allocation.assigned, 0); assert.equal(empty.general.expense, 201); assert.equal(empty.services.length, 0);
  const personal = analyzeWithAllocation(services, settings, { ...filters, categories: ['personal'] }, 'revenue');
  assert.equal(personal.total.revenue, 40000); assert.equal(personal.total.costs.salary, 100); assert.equal(personal.total.expense, 5481); assert.equal(personal.total.costs.products, 0);
  const scoped = scopeBuildings({ ...filters, buildings: ['g'] }, [{ id: 'g', propertyIds: ['p1', 'p2'] }]);
  assert.equal(analyze(services, settings, scoped).total.revenue, 30000);
  assert.equal(analyze(services, settings, { ...scoped, properties: ['p3'] }).total.revenue, 0, 'Conflicting building/property filters must be empty, not broadened');
  assert.equal(analyze(services, settings, scopeBuildings({ ...filters, buildings: ['gone'] }, [])).total.revenue, 0);
  const cleaning = analyze(services, settings, { ...filters, types: ['limpieza'] });
  assert.equal(cleaning.services.length, 2); assert.equal(cleaning.incomes.length, 0); assert.equal(cleaning.total.costs.salary, 100, 'Unlinked general costs have no service type and remain visible');
  for (const mode of ['none', 'revenue', 'services']) for (const concept of ['revenue', 'personal', 'laundry', 'expense', 'result']) {
    const analysis = analyzeWithAllocation(services, settings, filters, mode), detail = financialDetail(analysis, concept, settings);
    assert.equal(detail.rows.reduce((sum, row) => sum + row.amount, 0), detail.total, `Detail ${concept} must reconcile for ${mode}`);
  }
  assert.deepEqual([...distributeCents(1, [{ id: 'b', weight: 1 }, { id: 'a', weight: 1 }])], [['a', 1], ['b', 0]]);
  assert.equal([...distributeCents(999999999, [{ id: 'x', weight: 1000000000 }, { id: 'y', weight: 999999999 }]).values()].reduce((sum, value) => sum + value, 0), 999999999);
  const twoMonths = analyzeWithAllocation([...services, { ...services[0], id: 'oct', date: '2026-10-10' }], settings, { ...filters, end: '2026-10-31' }, 'revenue');
  assert.equal(twoMonths.expenses.filter(row => row.id.startsWith('allocation:') && row.date.startsWith('2026-10')).reduce((sum, row) => sum + row.cents, 0), 100, 'September overhead cannot spill into October');
  const yearFilters = { ...filters, start: '2026-01-01', end: '2026-12-31' };
  assert.equal(annualTrend(services, settings, yearFilters, 'revenue').reduce((sum, row) => sum + row.expense, 0), analyzeWithAllocation(services, settings, yearFilters, 'revenue').total.expense);
  const pendingServices = [...services, { ...service('old', 'c1', 'p5', 10000), date: '2026-09-01', workers: [{ id: 'c1', name: 'Ana', minutes: null, actual: false }] }];
  const alerts = financialAlerts(analyze(pendingServices, settings, filters), { margin: 90, days: 8, zero: true }, '2026-09-10');
  assert.equal(alerts.pending[0].id, 'old'); assert.equal(alerts.pending[0].age, 9); assert.equal(alerts.zero.length, 1); assert.equal(alerts.clients.length, 2);
  assert.equal(financialAlerts(analyze(pendingServices, settings, filters), { margin: 0, days: 9, zero: false }, '2026-09-10').pending.length, 0);
  const budget = { id: 'q', client_id: 'c1', status: 'draft', current_version_number: 2, title: 'Plan', quote_number: 'Q-2' };
  const items = readBudgetProjection([{ property_id: 'p1', result_snapshot: { monthly: { totalRevenue: 500, totalCost: 200 } } }]);
  const comparison = compareBudget(budget, items, services, settings, filters, 'none');
  assert.equal(comparison.projection.revenue, 50000); assert.equal(comparison.projection.expense, 20000); assert.equal(comparison.actual.total.revenue, 10000, 'Budget scope excludes other properties and external incomes');
  assert.equal(compareBudget(budget, items, services, settings, { ...filters, start: '2026-09-01', end: '2026-09-15' }, 'none').projection.revenue, 25000);
  assert.equal(Math.round(budgetPeriodFactor(yearFilters)), 12);
  assert.throws(() => readBudgetProjection([{ property_id: 'p1', result_snapshot: {} }]));
  assert.throws(() => readBudgetProjection([{ property_id: null, result_snapshot: { monthly: { totalRevenue: 5, totalCost: 2 } } }]));
  for (const selection of [{ ...filters, clients: ['c2'] }, { ...filters, properties: ['p2'] }, { ...filters, workers: ['c1'] }, { ...filters, categories: ['laundry'] }, { ...filters, types: ['external-income'] }]) assert.throws(() => compareBudget(budget, items, services, settings, selection, 'none'));
  assert.deepEqual(previousYearPeriod({ start: '2024-02-29', end: '2024-03-01' }), { start: '2023-02-28', end: '2023-03-01', label: 'vs mismo periodo del año anterior' });
  assert.equal(financialHistoryRange(filters, 'year').start, '2025-09-01');
  assert.equal(JSON.stringify({ services, settings, filters }), original, 'Analytics must not mutate tariffs, consumptions, hours, manual inputs or filters');
  console.log('financial-analytics: property KPIs, category/type/building filters, integer-cent monthly allocation and client/property conservation, detail/annual reconciliation, alerts and budget scope/proration/missing data passed');
} finally { unlinkSync(path); }
