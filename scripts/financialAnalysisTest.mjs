import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
  const dir = mkdtempSync(join(tmpdir(), 'limpatex-financial-test-'));
try {
  await build({ stdin: { contents: "export * from './src/features/financial/financialModel'; export * from './src/features/financial/financialSource';", resolveDir: process.cwd(), loader: 'ts' }, outfile: join(dir, 'model.mjs'), bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
  const { COST_ITEMS, newSettings, priceAt, setRate, calculateService, analyze, parseAmount, readSettings, buildServices, readAllPages, validDate, monthlySalaryExpenses } = await import(pathToFileURL(join(dir, 'model.mjs')));
  assert.deepEqual(COST_ITEMS.map(item => item.mills), [15500,550,510,570,247,535,226,226,10537,3159,3159,150,870,890,1910,130,3000,2317000]);
  const monthly = monthlySalaryExpenses([], '2026-10-01', '2026-10-31');
  assert.equal(monthly.length, 1); assert.equal(monthly[0].cents, 231700); assert.equal(monthly[0].automatic, true);
  assert.equal(monthlySalaryExpenses([], '2026-10-01', '2026-11-30').reduce((sum, expense) => sum + expense.cents, 0), 463400);
  assert.equal(monthlySalaryExpenses([], '2026-10-01', '2026-10-15')[0].cents, Math.round(231700 * 15 / 31));
  assert.equal(monthlySalaryExpenses([], '2024-02-01', '2024-02-29')[0].cents, 231700);
  assert.equal(monthlySalaryExpenses([], '2024-02-29', '2024-02-29')[0].cents, Math.round(231700 / 29));
  assert.equal(monthlySalaryExpenses([], '2026-02-01', '2026-02-28')[0].cents, 231700);
  const changedSalary = [{ item: 'tourismSalary', date: '2026-10-16', mills: 2500000 }];
  assert.equal(monthlySalaryExpenses(changedSalary, '2026-10-01', '2026-10-31')[0].cents, Math.round((231700 * 15 + 250000 * 16) / 31));
  assert.equal(monthlySalaryExpenses(changedSalary, '2026-09-01', '2026-09-30')[0].cents, 231700);
  assert.deepEqual(monthlySalaryExpenses([], '', '2026-10-01'), []);
  assert.deepEqual(monthlySalaryExpenses([], '2026-10-31', '2026-10-01'), []);
  const salaryFilters = { start: '2026-10-01', end: '2026-10-31', clients: [], properties: [], workers: [] };
  const salaryAnalysis = analyze([], newSettings(), salaryFilters);
  assert.equal(salaryAnalysis.total.costs.salary, 231700); assert.equal(salaryAnalysis.general.expense, 231700); assert.equal(salaryAnalysis.total.result, -231700);
  for (const field of ['clients','properties','workers']) assert.equal(analyze([], newSettings(), { ...salaryFilters, [field]: ['id'] }).total.costs.salary, 0);
  assert.deepEqual(readSettings(JSON.parse(JSON.stringify(newSettings()))), newSettings()); // Existing backups need no salary quantities.
  const settings = newSettings(); settings.rates = [{ item: 'tourismSalary', date: '2026-01-01', mills: 0 }];
  const service = { type: 'limpieza-turistica', id: 's', date: '2026-10-06', clientId: 'c', clientName: 'Cliente', propertyId: 'p', propertyName: 'Apartamento', revenue: 10000, revenueEstimated: false,
    workers: [{ id: 'w1', name: 'Ana', minutes: 60, actual: true }, { id: 'w2', name: 'Bea', minutes: 60, actual: true }], quantities: { pillowcase: 3, bathTowel: 2 } };
  let computed = calculateService(service, settings);
  assert.equal(computed.costs.personal, 3100); // Two people x one hour, never divide actual worked time.
  assert.equal(computed.costs.products, 300); // 3% of service income, once despite two workers.
  assert.equal(calculateService({ ...service, revenue: 5000 }, settings).costs.products, 150);
  assert.equal(calculateService({ ...service, revenue: 12345 }, settings).costs.products, 370);
  assert.equal(calculateService({ ...service, revenue: 0 }, settings).costs.products, 0);
  assert.equal(calculateService({ ...service, type: 'check-in' }, settings).costs.products, 0);
  assert.equal(calculateService({ ...service, type: 'desplazamiento' }, settings).costs.products, 0);
  assert.equal(calculateService({ ...service, type: 'limpieza-mantenimiento' }, settings).costs.products, 300);
  assert.ok(calculateService({ ...service, revenue: null }, settings).pending.includes('Base de productos pendiente'));
  const percentageSettings = { ...settings, rates: [{ item: 'products', date: '2026-11-01', mills: 5000 }] };
  assert.equal(calculateService(service, percentageSettings).costs.products, 300);
  assert.equal(calculateService({ ...service, date: '2026-11-01' }, percentageSettings).costs.products, 500);
  assert.equal(computed.costs.laundry, 181); // 3 x .247 + 2 x .535 = 1.811, round only category total.
  assert.ok(computed.pending.length); assert.equal(computed.estimated, true);
  const quantities = Object.fromEntries(COST_ITEMS.filter(item => item.id !== 'labor' && item.id !== 'products' && item.id !== 'tourismSalary').map(item => [item.id, 0]));
  settings.adjustments.s = { quantities: { ...quantities, pillowcase: 3, bathTowel: 2 }, reviewed: true };
  computed = calculateService(service, settings); assert.deepEqual(computed.pending, []); assert.equal(computed.estimated, false);
  settings.rates = setRate(settings.rates, { item: 'labor', date: '2026-11-01', mills: 20000 });
  assert.equal(priceAt(settings.rates, 'labor', '2026-10-06'), 15500);
  assert.equal(priceAt(settings.rates, 'labor', '2026-11-01'), 20000);
  settings.rates = setRate(settings.rates, { item: 'labor', date: '2026-10-01', mills: 18000, workerId: 'w1' });
  assert.equal(calculateService(service, settings).costs.personal, 3350);
  settings.rates = setRate(settings.rates, { item: 'labor', date: '2026-10-01', mills: 19000, workerId: 'w1' });
  assert.equal(settings.rates.length, 3); assert.equal(priceAt(settings.rates, 'labor', service.date, 'w1'), 19000);
  const filters = { start: '2026-10-01', end: '2026-10-31', clients: [], properties: [], workers: [] };
  settings.expenses = [{ id: 'e', date: service.date, label: 'Alquiler', category: 'other', cents: 5000, clientId: '', propertyId: '', workerId: '' },
    { id: 'e2', date: service.date, label: 'Extra', category: 'other', cents: 1000, clientId: 'c', propertyId: 'p', workerId: 'w1' }];
  const all = analyze([service], settings, filters);
  assert.equal(all.total.revenue, 10000); assert.equal(all.general.expense, 5000); assert.equal(all.total.expense, all.clients[0].expense + all.general.expense);
  const unidentified = analyze([{ ...service, clientId: '', clientName: 'Sin cliente identificado' }], settings, filters);
  assert.equal(unidentified.total.expense, unidentified.clients.reduce((sum, client) => sum + client.expense, 0) + unidentified.general.expense);
  const worker = analyze([service], settings, { ...filters, workers: ['w1', 'w2'] });
  assert.equal(worker.total.revenue, 10000); assert.equal(worker.services.length, 1); assert.equal(worker.expenses.length, 1);
  assert.equal(worker.total.costs.products, 300);
  assert.equal(all.total.costs.products, 300); assert.equal(all.clients[0].costs.products, 300);
  assert.equal(worker.total.costs.personal, 3450); // Retain whole team cost alongside whole service revenue.
  assert.equal(analyze([service], settings, { ...filters, clients: ['c'] }).general.expense, 0);
  assert.equal(analyze([service], settings, { ...filters, properties: ['missing'] }).total.services, 0);
  assert.equal(analyze([], settings, filters).total.expense, 6000); // Expenses without services must still count.
  assert.equal(analyze([], newSettings(), filters).total.margin, null);
  assert.ok(calculateService({ ...service, revenue: null, workers: [] }, settings).pending.length);
  settings.adjustments.s.minutes = { w1: 90 }; assert.equal(calculateService(service, settings).costs.personal, 4400);
  assert.equal(parseAmount('0,247'), 247); assert.equal(parseAmount('15.50'), 15500);
  for (const invalid of ['-1', '', '1e3', 'abc', 'Infinity', '1.0001']) assert.equal(parseAmount(invalid), null);
  assert.equal(validDate('2026-02-30'), false); assert.equal(validDate('2026-10-06'), true);
  assert.deepEqual(readSettings(JSON.parse(JSON.stringify(settings))), settings);
  assert.throws(() => readSettings({ ...settings, rates: [{ item: 'labor', mills: -1, date: service.date }] }));
  assert.throws(() => readSettings({ ...settings, rates: [{ item: 'products', mills: 100001, date: service.date }] }));
  assert.throws(() => readSettings({ ...settings, expenses: [settings.expenses[0], settings.expenses[0]] }));
  assert.throws(() => readSettings({ ...settings, adjustments: { s: { reviewed: true } } }));
  const property = { id: 'p', nombre: 'Casa', cliente_id: 'c', coste_servicio: 55, duracion_servicio: 120, numero_sabanas: 2, numero_sabanas_pequenas: 1, numero_sabanas_suite: 1, numero_fundas_almohada: 3 };
  const source = { type: 'limpieza-turistica', id: 's', date: service.date, status: 'completed', coste: 0, cliente_id: 'c', propiedad_id: 'p', property: 'Casa', cleaner_id: 'w1', cleaner: 'Ana', start_time: '10:00', end_time: '11:00', task_assignments: [{ cleaner_id: 'w1', cleaner_name: 'Ana' }, { cleaner_id: 'w2', cleaner_name: 'Bea' }], task_reports: [] };
  const mapped = buildServices([source], [property], [{ id: 'c', name: 'Cliente' }])[0];
  assert.equal(mapped.revenue, 5500); assert.equal(mapped.revenueEstimated, true); assert.equal(mapped.quantities.doubleSheet, 2);
  assert.equal(calculateService(mapped, newSettings()).costs.products, 165);
  const zeroProperty = buildServices([source], [{ ...property, coste_servicio: 0 }], [])[0];
  assert.equal(zeroProperty.revenue, 0); assert.equal(zeroProperty.revenueEstimated, false);
  const missingProperty = buildServices([source], [], [])[0];
  assert.equal(missingProperty.revenue, 0); assert.equal(missingProperty.revenueEstimated, false);
  const positiveTask = buildServices([{ ...source, coste: 42 }], [property], [])[0];
  assert.equal(positiveTask.revenue, 4200); assert.equal(positiveTask.revenueEstimated, false);
  assert.equal(buildServices([{ ...source, coste: null }], [property], [])[0].revenue, 5500);
  assert.equal(buildServices([source], [{ ...property, coste_servicio: -1 }], [])[0].revenue, 0);
  assert.equal(buildServices([source], [{ ...property, coste_servicio: Infinity }], [])[0].revenue, 0);
  assert.equal(calculateService(mapped, newSettings()).costs.personal, 3100);
  assert.equal(buildServices([{ ...source, status: 'pending' }], [property], []).length, 1);
  assert.equal(buildServices([{ ...source, status: 'cancelled' }], [property], []).length, 0);
  const report = id => ({ cleaner_id: id, overall_status: 'completed', start_time: '2026-10-06T08:00:00Z', end_time: '2026-10-06T09:30:00Z' });
  const actual = buildServices([{ ...source, status: 'pending', task_reports: [report('w1'), report('w2')] }], [property], [])[0];
  assert.equal(actual.workers[0].minutes, 90); assert.equal(actual.workers[0].actual, true);
  const partial = buildServices([{ ...source, status: 'pending', task_reports: [report('w1')] }], [property], [])[0];
  assert.equal(partial.workers[0].actual, true); assert.equal(partial.workers[1].actual, false);
  assert.equal(partial.workers[1].minutes, 60);
  const unassigned = { ...source, date: '2026-09-30', coste: null, start_time: '', end_time: '', task_assignments: [], cleaner_id: null };
  assert.equal(buildServices([unassigned], [], [], [], '2026-10-01').length, 0);
  assert.equal(buildServices([{ ...unassigned, status: 'completed', task_reports: [report('w1')] }], [], [], [], '2026-10-01').length, 0);
  const absent = buildServices([unassigned], [], [], [], '2026-09-30')[0];
  assert.equal(absent.revenue, null); assert.equal(absent.workers.length, 0);
  assert.equal(buildServices([unassigned], [], [], [], '2026-09-29').length, 1); // Future unassigned: provisional.
  assert.equal(buildServices([{ ...source, status: 'in_progress' }], [property], []).length, 1);
  assert.equal(buildServices([{ ...source, status: 'canceled' }], [property], []).length, 0);
  const excludedWorker = { id: 'nc', name: 'NOT COUNT' };
  const notCount = { ...source, task_assignments: [{ cleaner_id: 'nc', cleaner_name: ' not count ' }] };
  assert.equal(buildServices([notCount], [property], []).length, 0);
  assert.equal(buildServices([{ ...notCount, task_assignments: [{ cleaner_id: 'nc', cleaner_name: 'Nombre antiguo' }] }], [property], [], [excludedWorker]).length, 0);
  assert.equal(buildServices([{ ...notCount, task_assignments: [...notCount.task_assignments, source.task_assignments[0]] }], [property], []).length, 0); // Whole service, no duplicated income.
  assert.equal(buildServices([{ ...source, task_assignments: [], cleaner_id: 'nc', cleaner: 'NOT COUNT' }], [property], []).length, 0);
  assert.equal(buildServices([{ ...source, task_assignments: [], cleaner_id: 'w1', date: '2026-09-30', status: 'pending' }], [property], [], [], '2026-10-01').length, 1); // Legacy assigned task.
  assert.equal(buildServices([{ ...unassigned, task_assignments: [{ cleaner_id: '', cleaner_name: 'Ana' }] }], [], [], [], '2026-10-01').length, 0);
  const pages = []; const entries = await readAllPages(async (from, to) => { pages.push([from,to]); return { data: Array.from({length:from === 0 ? 500 : 3}, (_,i) => from+i), error: null }; });
  assert.equal(entries.length, 503); assert.deepEqual(pages, [[0,499],[500,999]]);
  await assert.rejects(() => readAllPages(async () => ({ data: null, error: { message: 'Error de lectura' } })), /Error de lectura/);
  console.log('financial-analysis: all domain, source, precision, history, filters and validation tests passed');
} finally { rmSync(dir, { recursive: true, force: true }); }
