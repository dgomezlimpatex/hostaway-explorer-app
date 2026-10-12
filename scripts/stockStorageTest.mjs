import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { build } from 'esbuild';

// Ejecuta el stockStorage real con un Supabase simulado: sin red ni datos reales.
const bundle = await build({
  stdin: {
    contents: "export { stockStorage } from './src/services/storage/stockStorage'; export { calls } from './src/integrations/supabase/client';",
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
               const call = { table, op: null, payload: null };
               calls.push(call);
               const chain = {
                 update: (payload) => { call.op = 'update'; call.payload = payload; return chain; },
                 insert: (payload) => { call.op = 'insert'; call.payload = payload; return chain; },
                 eq: () => chain,
                 then: (resolve) => resolve({ error: globalThis.__failTable === table ? new Error('fallo simulado') : null }),
               };
               return chain;
             } };`
          : 'export const recordAiObservedEvent = async () => {};',
      }));
    },
  }],
});
const url = `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`;
const { stockStorage, calls } = await import(url);
const level = (current, extra = {}) => ({ id: 'l1', product_id: 'p1', warehouse_id: 'w1', current_quantity: current, minimum_quantity: 2, target_quantity: 10, cost_per_unit: 2, ...extra });
const adjust = (movement_type, quantity, current = 5) => stockStorage.adjustStock({ stock_level: level(current), movement_type, quantity, reason: ' recuento ', user_id: 'u1' });

// Estadísticas del resumen
const stats = stockStorage.getDashboardStats(
  [level(0), level(2), level(5), level(7, { product_id: 'p2', cost_per_unit: null }), level(3, { warehouse_id: 'w2' })],
  [{ id: 'w1' }, { id: 'w2' }],
);
assert.equal(stats.totalProducts, 2, 'cuenta productos únicos');
assert.equal(stats.criticalStock, 1, 'sin stock = 0');
assert.equal(stats.lowStock, 1, 'bajo = >0 y <= mínimo');
assert.equal(stats.totalUnits, 17);
assert.equal(stats.totalValue, (0 + 2 + 5 + 3) * 2, 'sin coste no suma valor');
assert.equal(stats.totalWarehouses, 2);

// Ajustes: límites
await assert.rejects(() => adjust('salida', 6), /No hay stock suficiente/, 'no permite stock negativo');
await assert.rejects(() => adjust('ajuste', 5), /producir un cambio/, 'ajuste sin diferencia');
await assert.rejects(() => adjust('entrada', 0), /producir un cambio/, 'entrada de 0');

// Ajustes: efecto y movimiento registrado
const lastWrites = () => calls.splice(0).map(({ table, op, payload }) => ({ table, op, payload }));
lastWrites();
await adjust('entrada', 3);
let [levelWrite, movementWrite] = lastWrites();
assert.equal(levelWrite.table, 'stock_levels');
assert.equal(levelWrite.payload.current_quantity, 8);
assert.equal(movementWrite.table, 'stock_movements');
assert.deepEqual(
  [movementWrite.payload.quantity, movementWrite.payload.previous_quantity, movementWrite.payload.new_quantity, movementWrite.payload.reason],
  [3, 5, 8, 'recuento'],
);

await adjust('salida', 5);
[levelWrite] = lastWrites();
assert.equal(levelWrite.payload.current_quantity, 0, 'permite vaciar a 0 exacto');

await adjust('ajuste', 2);
[levelWrite, movementWrite] = lastWrites();
assert.equal(levelWrite.payload.current_quantity, 2);
assert.equal(movementWrite.payload.quantity, 3, 'el ajuste registra la diferencia absoluta');

// Riesgo conocido: si falla el movimiento, el stock ya se cambió. Lo corregirá el ajuste atómico en SQL.
globalThis.__failTable = 'stock_movements';
await assert.rejects(() => adjust('entrada', 1), /fallo simulado/);
assert.equal(lastWrites()[0].table, 'stock_levels', 'documenta que el stock se escribe antes que el movimiento');
globalThis.__failTable = undefined;

// Guarda: el sistema antiguo inventory_* no debe usarse desde fuera de su resto aislado (NotificationCenter, useInventory, inventoryStorage, types/inventory), pendiente de retirar por la vía revisada
const legacy = /services\/storage\/inventoryStorage|@\/types\/inventory['"]|components\/inventory\/(?!LaundryReceiptReview)|hooks\/(useInventory|useMovements|useConsumptionConfig|useAutomaticConsumption)\b/;
const walk = dir => readdirSync(dir).flatMap(name => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
});
const isolated = /[\\/](NotificationCenter\.tsx|useInventory\.ts|inventoryStorage\.ts|inventory\.ts)$/;
const offenders = walk('src').filter(file => !file.includes('integrations') && !isolated.test(file) && legacy.test(readFileSync(file, 'utf8')));
assert.deepEqual(offenders, [], `Importan código antiguo de inventario: ${offenders.join(', ')}`);

console.log('PASS stockStorage: resumen, límites del ajuste y sin código antiguo');
