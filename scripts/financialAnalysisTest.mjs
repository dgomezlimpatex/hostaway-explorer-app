import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = mkdtempSync(join(tmpdir(), 'limpatex-financial-test-'));
try {
  await build({ stdin: { contents: "export * from './src/features/financial/financialModel'; export * from './src/features/financial/financialSource';", resolveDir: process.cwd(), loader: 'ts' }, outfile: join(dir, 'model.mjs'), bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
  const { COST_ITEMS, newSettings, priceAt, setRate, calculateService, analyze, parseAmount, readSettings, buildServices, readAllPages, validDate } = await import(pathToFileURL(join(dir, 'model.mjs')));
  assert.deepEqual(COST_ITEMS.map(item => item.mills), [15500,550,510,570,247,535,226,226,10537,3159,3159,150,870,890,1910,130]);
  const settings = newSettings();
  const service = { id: 's', date: '2026-10-06', clientId: 'c', clientName: 'Cliente', propertyId: 'p', propertyName: 'Apartamento', revenue: 10000, revenueEstimated: false,
    workers: [{ id: 'w1', name: 'Ana', minutes: 60, actual: true }, { id: 'w2', name: 'Bea', minutes: 60, actual: true }], quantities: { pillowcase: 3, bathTowel: 2 } };
  let computed = calculateService(service, settings);
  assert.equal(computed.costs.personal, 3100); // Two people x one hour, never divide actual worked time.
  assert.equal(computed.costs.laundry, 181); // 3 x .247 + 2 x .535 = 1.811, round only category total.
  assert.ok(computed.pending.length); assert.equal(computed.estimated, true);
  const quantities = Object.fromEntries(COST_ITEMS.filter(item => item.id !== 'labor').map(item => [item.id, 0]));
  settings.adjustments.s = { quantities: { ...quantities, pillowcase: 3, bathTowel: 2 }, reviewed: true };
  computed = calculateService(service, settings); assert.deepEqual(computed.pending, []); assert.equal(computed.estimated, false);
  settings.rates = setRate(settings.rates, { item: 'labor', date: '2026-11-01', mills: 20000 });
  assert.equal(priceAt(settings.rates, 'labor', '2026-10-06'), 15500);
  assert.equal(priceAt(settings.rates, 'labor', '2026-11-01'), 20000);
  settings.rates = setRate(settings.rates, { item: 'labor', date: '2026-10-01', mills: 18000, workerId: 'w1' });
  assert.equal(calculateService(service, settings).costs.personal, 3350);
  settings.rates = setRate(settings.rates, { item: 'labor', date: '2026-10-01', mills: 19000, workerId: 'w1' });
  assert.equal(settings.rates.length, 2); assert.equal(priceAt(settings.rates, 'labor', service.date, 'w1'), 19000);
  const filters = { start: '2026-10-01', end: '2026-10-31', clients: [], properties: [], workers: [] };
  settings.expenses = [{ id: 'e', date: service.date, label: 'Alquiler', category: 'other', cents: 5000, clientId: '', propertyId: '', workerId: '' },
    { id: 'e2', date: service.date, label: 'Extra', category: 'other', cents: 1000, clientId: 'c', propertyId: 'p', workerId: 'w1' }];
  const all = analyze([service], settings, filters);
  assert.equal(all.total.revenue, 10000); assert.equal(all.general.expense, 5000); assert.equal(all.total.expense, all.clients[0].expense + all.general.expense);
  const worker = analyze([service], settings, { ...filters, workers: ['w1', 'w2'] });
  assert.equal(worker.total.revenue, 10000); assert.equal(worker.services.length, 1); assert.equal(worker.expenses.length, 1);
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
  assert.throws(() => readSettings({ ...settings, expenses: [settings.expenses[0], settings.expenses[0]] }));
  assert.throws(() => readSettings({ ...settings, adjustments: { s: { reviewed: true } } }));
  const property = { id: 'p', nombre: 'Casa', cliente_id: 'c', coste_servicio: 55, duracion_servicio: 120, numero_sabanas: 2, numero_sabanas_pequenas: 1, numero_sabanas_suite: 1, numero_fundas_almohada: 3 };
  const source = { id: 's', date: service.date, status: 'completed', coste: 0, cliente_id: 'c', propiedad_id: 'p', property: 'Casa', cleaner_id: 'w1', cleaner: 'Ana', start_time: '10:00', end_time: '11:00', task_assignments: [{ cleaner_id: 'w1', cleaner_name: 'Ana' }, { cleaner_id: 'w2', cleaner_name: 'Bea' }], task_reports: [] };
  const mapped = buildServices([source], [property], [{ id: 'c', name: 'Cliente' }])[0];
  assert.equal(mapped.revenue, 0); assert.equal(mapped.revenueEstimated, false); assert.equal(mapped.quantities.doubleSheet, 2);
  assert.equal(calculateService(mapped, newSettings()).costs.personal, 3100);
  assert.equal(buildServices([{ ...source, status: 'pending' }], [property], []).length, 0);
  assert.equal(buildServices([{ ...source, status: 'cancelled' }], [property], []).length, 0);
  const report = id => ({ cleaner_id: id, overall_status: 'completed', start_time: '2026-10-06T08:00:00Z', end_time: '2026-10-06T09:30:00Z' });
  const actual = buildServices([{ ...source, status: 'pending', task_reports: [report('w1'), report('w2')] }], [property], [])[0];
  assert.equal(actual.workers[0].minutes, 90); assert.equal(actual.workers[0].actual, true);
  assert.equal(buildServices([{ ...source, status: 'pending', task_reports: [report('w1')] }], [property], []).length, 0);
  const absent = buildServices([{ ...source, coste: null, start_time: '', end_time: '', task_assignments: [], cleaner_id: null }], [], [])[0];
  assert.equal(absent.revenue, null); assert.equal(absent.workers.length, 0);
  const pages = []; const entries = await readAllPages(async (from, to) => { pages.push([from,to]); return { data: Array.from({length:from === 0 ? 500 : 3}, (_,i) => from+i), error: null }; });
  assert.equal(entries.length, 503); assert.deepEqual(pages, [[0,499],[500,999]]);
  await assert.rejects(() => readAllPages(async () => ({ data: null, error: { message: 'Error de lectura' } })), /Error de lectura/);
  console.log('financial-analysis: all domain, source, precision, history, filters and validation tests passed');
} finally { rmSync(dir, { recursive: true, force: true }); }
