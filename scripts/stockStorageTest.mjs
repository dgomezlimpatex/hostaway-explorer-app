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
             },
             rpc: (fn, args) => {
               calls.push({ table: 'rpc:' + fn, op: 'rpc', payload: args });
               return Promise.resolve({ data: globalThis.__rpcData ?? null, error: globalThis.__rpcError ?? null });
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

// Ajuste manual: el cliente delega en la función SQL atómica y no escribe tablas directamente
const lastCalls = () => calls.splice(0);
lastCalls();
globalThis.__rpcData = { previous_quantity: 5, new_quantity: 8, quantity: 3 };
await adjust('entrada', 3);
const [rpcCall, ...extra] = lastCalls();
assert.equal(extra.length, 0, 'no escribe stock_levels ni stock_movements desde el navegador');
assert.equal(rpcCall.table, 'rpc:adjust_stock_level');
assert.deepEqual(rpcCall.payload, {
  stock_level_id_param: 'l1',
  movement_type_param: 'entrada',
  quantity_param: 3,
  reason_param: 'recuento',
  cost_per_unit_param: null,
});
await stockStorage.adjustStock({ stock_level: level(5), movement_type: 'ajuste', quantity: 4, reason: 'x', user_id: 'u1', cost_per_unit: 1.5 });
assert.equal(lastCalls()[0].payload.cost_per_unit_param, 1.5, 'envía el coste cuando se indica');

// Errores de la función SQL traducidos a mensajes claros; los desconocidos se conservan
const failWith = async (message, expected) => {
  globalThis.__rpcError = { message };
  await assert.rejects(() => adjust('salida', 6), expected);
  assert.deepEqual(lastCalls().map(call => call.table), ['rpc:adjust_stock_level'], 'un fallo no intenta escribir por otra vía');
};
await failWith('Insufficient stock for this exit', /No hay stock suficiente/);
await failWith('Quantity must change the stock', /producir un cambio/);
await failWith('User not allowed to adjust stock', /No tienes permiso/);
await failWith('Adjustment reason is required', /motivo es obligatorio/);
await failWith('Active stock level not found', /No se encontró/);
await failWith('error inesperado de red', /error inesperado de red/);
globalThis.__rpcError = undefined;

// La migración conserva las garantías que el cliente da por hechas
const sql = readFileSync('supabase/migrations/20261012190000_stock_adjust_atomic.sql', 'utf8');
for (const [pattern, why] of [
  [/FOR UPDATE OF l/, 'bloquea la fila antes de leer la cantidad'],
  [/auth\.uid\(\)/, 'usa la sesión real, no un usuario enviado por el cliente'],
  [/role IN \('admin', 'manager'\)/, 'solo admin y manager'],
  [/INSERT INTO public.stock_movements/, 'registra el movimiento en la misma función'],
  [/REVOKE ALL ON FUNCTION public\.adjust_stock_level\([^)]*\) FROM PUBLIC, anon/, 'sin acceso anónimo'],
]) assert.match(sql, pattern, why);
assert.doesNotMatch(sql, /DROP |DELETE FROM|TRUNCATE|ALTER TABLE|CREATE TABLE/i, 'la migración solo añade una función');

// Guarda: el sistema antiguo inventory_* ya no existe en el código y no debe volver
const legacy = /services\/storage\/inventoryStorage|@\/types\/inventory['"]|components\/inventory\/(?!LaundryReceiptReview)|hooks\/(useInventory|useMovements|useConsumptionConfig|useAutomaticConsumption)\b/;
const walk = dir => readdirSync(dir).flatMap(name => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
});
const offenders = walk('src').filter(file => !file.includes('integrations') && legacy.test(readFileSync(file, 'utf8')));
assert.deepEqual(offenders, [], `Importan código antiguo de inventario: ${offenders.join(', ')}`);

console.log('PASS stockStorage: resumen, ajuste delegado en SQL atómico, errores traducidos y sin código antiguo');
