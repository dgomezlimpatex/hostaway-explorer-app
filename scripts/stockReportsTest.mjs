import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Código real de informes de stock con un Supabase simulado: sin red ni datos reales.
const bundle = await build({
  stdin: {
    contents: `export { stockStorage } from './src/services/storage/stockStorage';
      export { madridDayStartIso, madridRangeBounds } from './src/utils/stockDateRange';
      export { calls } from './src/integrations/supabase/client';`,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  plugins: [{
    name: 'fake-backend',
    setup(builder) {
      builder.onResolve({ filter: /integrations\/supabase\/client$|services\/aiObservedEvents$/ }, args => ({ path: args.path.endsWith('client') ? 'fake-client' : 'fake-events', namespace: 'fake' }));
      builder.onLoad({ filter: /.*/, namespace: 'fake' }, args => ({
        loader: 'js',
        contents: args.path === 'fake-client'
          ? `export const calls = [];
             export const supabase = { from: (table) => {
               const call = { table, filters: [], order: [], range: null };
               calls.push(call);
               const chain = {
                 select: () => chain,
                 eq: (column, value) => { call.filters.push(['eq', column, value]); return chain; },
                 gte: (column, value) => { call.filters.push(['gte', column, value]); return chain; },
                 lt: (column, value) => { call.filters.push(['lt', column, value]); return chain; },
                 order: (column, options) => { call.order.push([column, options?.ascending]); return chain; },
                 range: (from, to) => { call.range = [from, to]; return chain; },
                 then: (resolve) => resolve(globalThis.__respond(call)),
               };
               return chain;
             } };`
          : 'export const recordAiObservedEvent = async () => {};',
      }));
    },
  }],
});
const url = `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`;
const { stockStorage, madridDayStartIso, madridRangeBounds, calls } = await import(url);

// Días en horario de Madrid (UTC+1 invierno, UTC+2 verano), incluidos los cambios de hora
assert.equal(madridDayStartIso('2026-01-15'), '2026-01-14T23:00:00.000Z');
assert.equal(madridDayStartIso('2026-07-01'), '2026-06-30T22:00:00.000Z');
assert.equal(madridDayStartIso('2026-03-29'), '2026-03-28T23:00:00.000Z', 'día del cambio a verano empieza en horario de invierno');
assert.equal(madridDayStartIso('2026-03-30'), '2026-03-29T22:00:00.000Z');
assert.equal(madridDayStartIso('2026-10-25'), '2026-10-24T22:00:00.000Z', 'día del cambio a invierno empieza en horario de verano');
assert.equal(madridDayStartIso('2026-10-26'), '2026-10-25T23:00:00.000Z');
assert.deepEqual(madridRangeBounds('2026-10-01', '2026-10-31'), { start: '2026-09-30T22:00:00.000Z', endExclusive: '2026-10-31T23:00:00.000Z' }, 'incluye el último día completo');
assert.deepEqual(madridRangeBounds('2026-12-31', '2026-12-31'), { start: '2026-12-30T23:00:00.000Z', endExclusive: '2026-12-31T23:00:00.000Z' }, 'cruce de año');
assert.throws(() => madridDayStartIso('31/10/2026'), /Fecha no válida/);

// Paginación: Supabase corta en 1.000 filas por consulta
const rows = total => Array.from({ length: total }, (_, index) => ({ id: `m${index}`, quantity: '1', previous_quantity: '5', new_quantity: '4', to_previous_quantity: null, to_new_quantity: null, created_at: '2026-10-05T10:00:00Z', unit_cost_at_movement: index === 0 ? '2.5' : null }));
const respondWith = total => call => {
  const [from, to] = call.range;
  return { data: rows(total).slice(from, to + 1), error: null };
};

globalThis.__respond = respondWith(2500);
calls.length = 0;
let result = await stockStorage.getMovementsInRange('sede-1', '2026-10-01', '2026-10-31');
assert.equal(result.movements.length, 2500, 'trae todas las filas, no solo las 1.000 primeras');
assert.equal(result.truncated, false);
assert.deepEqual(calls.map(call => call.range), [[0, 999], [1000, 1999], [2000, 2999]]);
const first = calls[0];
assert.ok(first.filters.some(([op, column, value]) => op === 'gte' && column === 'created_at' && value === '2026-09-30T22:00:00.000Z'), 'filtra el inicio en servidor');
assert.ok(first.filters.some(([op, column, value]) => op === 'lt' && column === 'created_at' && value === '2026-10-31T23:00:00.000Z'), 'filtra el fin en servidor');
assert.ok(first.filters.some(([op, column, value]) => op === 'eq' && column === 'product.sede_id' && value === 'sede-1'), 'limita a la sede');
assert.deepEqual(first.order, [['created_at', false], ['id', false]], 'orden estable para paginar');
assert.equal(typeof result.movements[0].quantity, 'number', 'normaliza números');
assert.equal(result.movements[0].unit_cost_at_movement, 2.5, 'normaliza el coste guardado en el movimiento');
assert.equal(result.movements[1].unit_cost_at_movement, null, 'sin coste guardado queda en null');

globalThis.__respond = respondWith(1000);
calls.length = 0;
result = await stockStorage.getMovementsInRange('sede-1', '2026-10-01', '2026-10-01');
assert.equal(result.movements.length, 1000);
assert.equal(calls.length, 2, 'una página completa exige pedir la siguiente');
assert.equal(result.truncated, false);

globalThis.__respond = respondWith(0);
result = await stockStorage.getMovementsInRange('sede-1', '2026-10-01', '2026-10-01');
assert.deepEqual(result, { movements: [], truncated: false });

globalThis.__respond = respondWith(1_000_000);
calls.length = 0;
result = await stockStorage.getMovementsInRange('sede-1', '2026-01-01', '2026-10-31');
assert.equal(calls.length, 20, 'tope de páginas');
assert.equal(result.truncated, true, 'avisa de informe incompleto en vez de ocultarlo');

globalThis.__respond = () => ({ data: null, error: new Error('fallo simulado') });
await assert.rejects(() => stockStorage.getMovementsInRange('sede-1', '2026-10-01', '2026-10-02'), /fallo simulado/);

// Alertas activas de la sede
globalThis.__respond = () => ({ data: [{ id: 'a1', alert_type: 'stock_critico', is_active: true }], error: null });
calls.length = 0;
const alerts = await stockStorage.getActiveAlerts('sede-9');
assert.equal(alerts.length, 1);
assert.equal(calls[0].table, 'stock_alerts');
assert.ok(calls[0].filters.some(([op, column, value]) => op === 'eq' && column === 'is_active' && value === true));
assert.ok(calls[0].filters.some(([op, column, value]) => op === 'eq' && column === 'product.sede_id' && value === 'sede-9'));
globalThis.__respond = () => ({ data: null, error: null });
assert.deepEqual(await stockStorage.getActiveAlerts('sede-9'), []);

console.log('PASS informes de stock: días Madrid, paginación, aviso de truncado y alertas');
