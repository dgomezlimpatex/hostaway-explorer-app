import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Cálculo real de los informes de stock (src/utils/stockReport.ts), sin red ni datos reales.
const bundle = await build({ entryPoints: ['src/utils/stockReport.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { buildStockReport, reorderToCsv, movementUnitCost, REORDER_CSV_HEADERS } =
  await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

const level = (product, warehouse, current, minimum, target, cost, names = {}) => ({
  id: `${product}-${warehouse}`, product_id: product, warehouse_id: warehouse,
  current_quantity: current, minimum_quantity: minimum, target_quantity: target, cost_per_unit: cost,
  product: { name: names.product || product.toUpperCase(), unit_of_measure: 'u', category: { name: names.category || 'Ropa' } },
  warehouse: { name: names.warehouse || warehouse.toUpperCase() },
});
const move = (id, type, product, warehouse, quantity, extra = {}) => ({ id, movement_type: type, product_id: product, warehouse_id: warehouse, quantity, product: { name: product.toUpperCase() }, ...extra });

// Prioridad del coste de cada movimiento
const costs = (levels) => {
  const byPw = new Map(), byP = new Map();
  for (const l of levels) { if (l.cost_per_unit == null) continue; byPw.set(`${l.product_id}|${l.warehouse_id}`, l.cost_per_unit); if (!byP.has(l.product_id)) byP.set(l.product_id, l.cost_per_unit); }
  return [byPw, byP];
};
const lv = [level('p1', 'w1', 5, 1, 10, 2), level('p1', 'w2', 5, 1, 10, 9), level('p2', 'w1', 0, 1, 4, null)];
const [byPw, byP] = costs(lv);
assert.equal(movementUnitCost(move('a', 'salida', 'p1', 'w1', 1, { unit_cost_at_movement: 3.5 }), byPw, byP), 3.5, 'coste guardado en el movimiento');
assert.equal(movementUnitCost(move('b', 'salida', 'p1', 'w2', 1, { unit_cost_at_movement: 0 }), byPw, byP), 0, 'un coste guardado de 0 se respeta');
assert.equal(movementUnitCost(move('c', 'salida', 'p1', 'w2', 1), byPw, byP), 9, 'sin coste guardado: el del almacén del movimiento');
assert.equal(movementUnitCost(move('d', 'salida', 'p1', 'w3', 1), byPw, byP), 2, 'almacén sin coste: el de otro almacén');
assert.equal(movementUnitCost(move('e', 'salida', 'p2', 'w1', 1), byPw, byP), 0, 'sin ningún coste no valora');

// Informe
const movements = [
  move('1', 'salida', 'p1', 'w1', 2, { unit_cost_at_movement: 3 }),
  move('2', 'consumo_automatico', 'p1', 'w2', 1),
  move('3', 'consumo_automatico', 'p2', 'w1', 4),
  move('4', 'entrada', 'p1', 'w1', 50),
  move('5', 'ajuste', 'p1', 'w1', 1),
  move('6', 'transferencia', 'p1', 'w1', 7),
];
const report = buildStockReport(movements, lv);
assert.deepEqual([report.exits.length, report.automaticConsumption.length, report.entries.length], [3, 2, 1], 'entradas, salidas y consumos; ajustes y transferencias no cuentan');
assert.deepEqual(report.consumptionByProduct, [
  { product: 'P2', quantity: 4, value: 0 },
  { product: 'P1', quantity: 3, value: 15 },
], 'p1 = 2×3 (coste del movimiento) + 1×9 (coste del almacén); ordenado por cantidad');
assert.deepEqual(report.lowStock.map(l => l.id), ['p2-w1'], 'bajo mínimo = actual <= mínimo');
assert.deepEqual(report.reorder.map(r => [r.level.id, r.needed, r.estimatedCost]), [['p1-w1', 5, 10], ['p1-w2', 5, 45], ['p2-w1', 4, 0]].sort((a, b) => b[1] - a[1]), 'reponer = objetivo − actual, con coste');
assert.equal(buildStockReport([], []).reorder.length, 0);
assert.equal(buildStockReport([move('x', 'salida', 'p', 'w', 0.1), move('y', 'salida', 'p', 'w', 0.2)], []).consumptionByProduct[0].quantity, 0.3, 'sin errores de coma flotante');

// Rendimiento: muchos movimientos no deben hacer el informe cuadrático
const many = Array.from({ length: 20000 }, (_, i) => move(`m${i}`, 'salida', `p${i % 50}`, 'w1', 1));
const manyLevels = Array.from({ length: 500 }, (_, i) => level(`p${i % 50}`, `w${i}`, 1, 1, 5, 1));
const started = Date.now();
buildStockReport(many, manyLevels);
assert.ok(Date.now() - started < 1000, 'informe de 20.000 movimientos en menos de 1 s');

// CSV de reposición
const csv = reorderToCsv([
  { level: level('b', 'w1', 1, 1, 5, 1.5, { product: 'Zeta "grande"; nuevo', category: 'Amenities', warehouse: 'Central' }), needed: 4, estimatedCost: 6 },
  { level: level('a', 'w1', 0, 1, 3, null, { product: '=SUMA(1)', category: 'Amenities', warehouse: 'Central' }), needed: 3, estimatedCost: 0 },
  { level: level('c', 'w1', 2, 1, 6, 2, { product: 'Toalla', category: 'Lavandería', warehouse: 'Central' }), needed: 4, estimatedCost: 8 },
]);
const lines = csv.split('\n');
assert.equal(lines[0], REORDER_CSV_HEADERS.join(';'));
assert.equal(lines.length, 4);
assert.match(lines[1], /^"Amenities";"'=SUMA\(1\)";/, 'ordenado por tipo y nombre, y neutraliza fórmulas');
assert.match(lines[2], /"Zeta ""grande""; nuevo"/, 'comillas y punto y coma dentro del texto');
assert.match(lines[3], /^"Lavandería";"Toalla";"Central";"u";"2";"1";"6";"4";"2";"8"$/);
assert.match(lines[1], /;"";"0"$/, 'sin coste: celda vacía');
assert.equal(reorderToCsv([]), REORDER_CSV_HEADERS.join(';'));

console.log('PASS informes de stock: coste por movimiento, reposición, rendimiento y CSV seguro');
