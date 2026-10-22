import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

// Ejecuta savePropertyConsumptionRules real con un Supabase simulado: sin red ni datos reales.
// Las lecturas con joins a stock_products simulan el 57014 (statement timeout) visto en producción.
const entry = process.env.STOCK_STORAGE_ENTRY || './src/services/storage/stockStorage';
const bundle = await build({
  stdin: {
    contents: `export { stockStorage } from '${entry}'; export { calls, events } from './src/integrations/supabase/client'; export { buildInitialStockConsumptions } from './src/components/properties/forms/propertyStockConsumption';`,
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
      builder.onResolve({ filter: /services\/stockBagAccounting$/ }, () => ({ path: 'fake-bags', namespace: 'fake' }));
      builder.onLoad({ filter: /.*/, namespace: 'fake' }, args => ({
        loader: 'js',
        contents: args.path === 'fake-client'
          ? `export const calls = []; export const events = [];
             export const supabase = { from: (table) => {
               const call = { table, op: 'select', select: null, filters: [], payload: null, options: null, startedAt: Date.now() };
               calls.push(call);
               const chain = {
                 select: (columns) => { call.select = columns; return chain; },
                 upsert: (payload, options) => { call.op = 'upsert'; call.payload = payload; call.options = options; return chain; },
                 eq: (column, value) => { call.filters.push(['eq', column, value]); return chain; },
                 in: (column, value) => { call.filters.push(['in', column, value]); return chain; },
                 order: () => chain,
                 then: (resolve, reject) => Promise.resolve(globalThis.__respond(call)).then(resolve, reject),
               };
               return chain;
             } };`
          : args.path === 'fake-events'
            ? `import { events } from 'fake-client'; export const recordAiObservedEvent = async (event) => { events.push(event); };`
            : 'export const adjustBagStock = async () => { throw new Error("no usado"); };',
      }));
      builder.onResolve({ filter: /^fake-client$/ }, () => ({ path: 'fake-client', namespace: 'fake' }));
    },
  }],
});
const url = `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`;
const { stockStorage, calls, events, buildInitialStockConsumptions } = await import(url);

const timeout = { code: '57014', message: 'canceling statement due to statement timeout' };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const filterValue = (call, column) => call.filters.find(([, c]) => c === column)?.[2];
// Lecturas que expiraron en producción: joins a stock_products y el propio listado de productos.
const isWideJoin = call => call.op === 'select' && /stock_products\s*\(/.test(call.select || '');
const isProductsRead = call => call.table === 'stock_products';

// Reglas existentes en "base de datos" por propiedad.
const existing = {
  'cga8-3': [
    { product_id: 'sheets', warehouse_id: 'w-cga8', quantity_per_cleaning: 3, notes: 'Conservar nota', is_active: true },
    { product_id: 'kit', warehouse_id: null, quantity_per_cleaning: 1, notes: null, is_active: true },
    { product_id: 'hidden', warehouse_id: 'w-cga8', quantity_per_cleaning: 4, notes: null, is_active: true },
  ],
  'other': [
    { product_id: 'sheets', warehouse_id: 'w-other', quantity_per_cleaning: 2, notes: null, is_active: true },
  ],
};

const scenario = ({ wideJoinTimeout = true, narrowReadError = null, upsertError = null, latency = {} } = {}) => {
  globalThis.__respond = async (call) => {
    const propertyId = filterValue(call, 'property_id');
    if (call.op === 'upsert') {
      await sleep(latency[propertyId]?.upsert ?? 0);
      return { data: null, error: upsertError };
    }
    await sleep(latency[propertyId]?.read ?? 0);
    if ((isWideJoin(call) || isProductsRead(call)) && wideJoinTimeout) return { data: null, error: timeout };
    if (narrowReadError) return { data: null, error: narrowReadError };
    return { data: (existing[propertyId] || []).filter(rule => rule.is_active).map(rule => ({ ...rule })), error: null };
  };
};
const take = () => ({ calls: calls.splice(0), events: events.splice(0) });
const rejectsWith = async (promise, code) => {
  let thrown = null;
  try { await promise; } catch (error) { thrown = error; }
  assert.ok(thrown, 'debe fallar, nunca un éxito falso');
  assert.equal(thrown.code, code);
};

// 0. Carga: con los joins amplios expirando, la lectura de reglas por propiedad es directa y sin joins.
scenario();
const loaded = await stockStorage.getPropertyConsumptionRules('cga8-3');
let { calls: c, events: e } = take();
assert.equal(c.length, 1);
assert.equal(c.some(isWideJoin), false, 'la carga no une productos/categorías/almacenes');
assert.deepEqual(c[0].filters, [['eq', 'property_id', 'cga8-3'], ['eq', 'is_active', true]]);
assert.deepEqual(loaded.map(rule => [rule.product_id, rule.quantity_per_cleaning, rule.notes]), [
  ['sheets', 3, 'Conservar nota'], ['kit', 1, null], ['hidden', 4, null],
]);
assert.equal(typeof (await (scenario(), stockStorage.getPropertyConsumptionRules('other')))[0].quantity_per_cleaning, 'number');
take();
// Los consumidores de la propiedad solo usan product_id/quantity_per_cleaning/notes, no los embebidos.
const products = [{ id: 'sheets', name: 'Sábanas grandes' }, { id: 'kit', name: 'Amenities baño' }, { id: 'paper', name: 'Rollos de papel higiénico' }];
assert.deepEqual(buildInitialStockConsumptions(products, loaded, { cantidadRollosPapelHigienico: 2 }), { sheets: 3, kit: 1, paper: 2 });
for (const file of ['src/components/properties/PropertyConsumptionsPanel.tsx', 'src/components/properties/usePropertyInlineEdit.ts', 'src/components/properties/forms/StockConsumptionSection.tsx', 'src/components/properties/forms/propertyStockConsumption.ts']) {
  assert.doesNotMatch(readFileSync(file, 'utf8'), /\brules?(\.data)?(\?\.|\.)(product|warehouse)\b|find\([^)]*\)\?\.(product|warehouse)\b/, `${file} no lee reglas embebidas`);
}
// Un fallo de lectura sigue siendo un error (no una lista vacía), igual que en productos.
scenario({ narrowReadError: timeout });
await rejectsWith(stockStorage.getPropertyConsumptionRules('cga8-3'), '57014');
scenario();
await rejectsWith(stockStorage.getProducts('sede'), '57014');
({ calls: c } = take());
assert.equal(c.at(-1).table, 'stock_products', 'el 57014 de productos no se oculta');

// 1. Reproducción: con las lecturas amplias expirando, el guardado no debe depender de ellas.
scenario();
await stockStorage.savePropertyConsumptionRules('cga8-3', [
  { product_id: 'sheets', quantity_per_cleaning: 7, notes: 'Conservar nota' },
  { product_id: 'kit', quantity_per_cleaning: 0 },
]);
({ calls: c, events: e } = take());
assert.equal(c.length, 2, 'una lectura estrecha y una escritura');
assert.equal(c.some(isWideJoin), false, 'el guardado no vuelve a leer productos/categorías/almacenes');
assert.equal(c[0].table, 'stock_property_consumption_rules');
assert.equal(c[0].op, 'select');
assert.deepEqual(c[0].select.split(',').map(s => s.trim()).sort(), ['product_id', 'warehouse_id']);
assert.deepEqual(c[0].filters, [['eq', 'property_id', 'cga8-3'], ['eq', 'is_active', true]]);
assert.equal(c[1].op, 'upsert');
assert.deepEqual(c[1].options, { onConflict: 'property_id,product_id' }, 'mismo contrato de escritura');
assert.deepEqual(c[1].payload, [
  { property_id: 'cga8-3', product_id: 'sheets', warehouse_id: 'w-cga8', quantity_per_cleaning: 7, notes: 'Conservar nota', is_active: true },
  { property_id: 'cga8-3', product_id: 'kit', warehouse_id: null, quantity_per_cleaning: 0, notes: null, is_active: true },
], 'cantidad 0 conservada, almacén omitido conserva el vigente, nota conservada');
assert.equal(c[1].payload.some(rule => rule.product_id === 'hidden'), false, 'reglas no editadas/no visibles no se tocan');
assert.equal(e.length, 1, 'un único aviso tras escribir');
assert.equal(e[0].eventType, 'stock_consumption_rules_updated');
assert.deepEqual(e[0].metadata, { rules_count: 2 });

// 2. Almacén: omitido conserva, null explícito borra, cadena vacía = null, id explícito se respeta, regla nueva = null.
scenario();
await stockStorage.savePropertyConsumptionRules('cga8-3', [
  { product_id: 'sheets', quantity_per_cleaning: 1, warehouse_id: null },
  { product_id: 'kit', quantity_per_cleaning: 2, warehouse_id: 'w-new' },
  { product_id: 'hidden', quantity_per_cleaning: 3, warehouse_id: '' },
  { product_id: 'brand-new', quantity_per_cleaning: -5 },
]);
({ calls: c } = take());
assert.deepEqual(c[1].payload.map(r => [r.product_id, r.warehouse_id, r.quantity_per_cleaning]), [
  ['sheets', null, 1], ['kit', 'w-new', 2], ['hidden', null, 3], ['brand-new', null, 0],
]);

// 3. Sin almacenes omitidos no hace falta leer: solo la escritura.
scenario();
await stockStorage.savePropertyConsumptionRules('cga8-3', [{ product_id: 'sheets', quantity_per_cleaning: 0, warehouse_id: 'w-cga8' }]);
({ calls: c } = take());
assert.deepEqual(c.map(call => call.op), ['upsert']);
assert.equal(c[0].payload[0].quantity_per_cleaning, 0);

// 4. Lista vacía: ni lecturas ni escrituras ni avisos.
scenario();
await stockStorage.savePropertyConsumptionRules('cga8-3', []);
assert.deepEqual(take(), { calls: [], events: [] });

// 5. Si la lectura previa falla (incluso 57014), no escribe a ciegas ni avisa: error visible.
scenario({ narrowReadError: timeout });
await rejectsWith(stockStorage.savePropertyConsumptionRules('cga8-3', [{ product_id: 'sheets', quantity_per_cleaning: 9 }]), '57014');
({ calls: c, events: e } = take());
assert.deepEqual(c.map(call => call.op), ['select'], 'sin upsert tras fallo de lectura');
assert.equal(e.length, 0);

// 6. Si la escritura falla, se propaga el error y no hay aviso de éxito.
scenario({ upsertError: timeout });
await rejectsWith(stockStorage.savePropertyConsumptionRules('cga8-3', [{ product_id: 'sheets', quantity_per_cleaning: 9 }]), '57014');
({ calls: c, events: e } = take());
assert.deepEqual(c.map(call => call.op), ['select', 'upsert'], 'un solo intento, sin reintentos ciegos');
assert.equal(e.length, 0);

// 7. Varias propiedades seguidas con red lenta y respuestas desordenadas: sin cruces de almacén ni propiedad.
scenario({ latency: { 'cga8-3': { read: 40, upsert: 5 }, other: { read: 5, upsert: 30 } } });
const started = Date.now();
await Promise.all([
  stockStorage.savePropertyConsumptionRules('cga8-3', [{ product_id: 'sheets', quantity_per_cleaning: 5 }]),
  stockStorage.savePropertyConsumptionRules('other', [{ product_id: 'sheets', quantity_per_cleaning: 6 }]),
]);
const elapsed = Date.now() - started;
({ calls: c, events: e } = take());
const upserts = Object.fromEntries(c.filter(call => call.op === 'upsert').map(call => [call.payload[0].property_id, call.payload]));
assert.deepEqual(upserts['cga8-3'], [{ property_id: 'cga8-3', product_id: 'sheets', warehouse_id: 'w-cga8', quantity_per_cleaning: 5, notes: null, is_active: true }]);
assert.deepEqual(upserts.other, [{ property_id: 'other', product_id: 'sheets', warehouse_id: 'w-other', quantity_per_cleaning: 6, notes: null, is_active: true }]);
assert.deepEqual(e.map(event => event.entityId).sort(), ['cga8-3', 'other']);
assert.ok(elapsed < 200, `latencia controlada acotada (${elapsed} ms)`);

// 8. Reintento manual tras un fallo: el mismo borrador se escribe una vez, sin duplicados.
scenario({ narrowReadError: timeout });
await rejectsWith(stockStorage.savePropertyConsumptionRules('cga8-3', [{ product_id: 'kit', quantity_per_cleaning: 0 }]), '57014');
scenario();
await stockStorage.savePropertyConsumptionRules('cga8-3', [{ product_id: 'kit', quantity_per_cleaning: 0 }]);
({ calls: c, events: e } = take());
assert.equal(c.filter(call => call.op === 'upsert').length, 1);
assert.equal(e.length, 1);

console.log('propertyConsumptionSaveTest: OK');
