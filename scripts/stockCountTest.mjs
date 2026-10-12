import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Lógica real del recuento físico (src/components/stock/stockCount.ts), sin red ni datos reales.
const bundle = await build({
  entryPoints: ['src/components/stock/stockCount.ts'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
});
const { parseCountedQuantity, buildCountLines, summarizeCount, linesToApply, countReason } =
  await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

const level = (id, current, cost = 2) => ({ id, product_id: `p${id}`, warehouse_id: 'w', current_quantity: current, minimum_quantity: 1, target_quantity: 9, cost_per_unit: cost });

// Lectura de lo contado
assert.equal(parseCountedQuantity(''), null, 'en blanco = sin contar');
assert.equal(parseCountedQuantity('  '), null);
assert.equal(parseCountedQuantity(undefined), null);
assert.equal(parseCountedQuantity('0'), 0, 'cero es un conteo válido');
assert.equal(parseCountedQuantity('12,5'), 12.5, 'coma decimal');
assert.equal(parseCountedQuantity('7.25'), 7.25);
for (const bad of ['-1', 'abc', '1,234', '1e3', '1,2,3', '99999999', '--', '5 u']) assert.equal(parseCountedQuantity(bad), 'invalid', `no válido: ${bad}`);

// Líneas: solo difieren las contadas y distintas del sistema
const levels = [level('a', 10), level('b', 5), level('c', 3, null), level('d', 8), level('e', 2)];
const lines = buildCountLines(levels, { a: '7', b: '5', c: '4,5', d: '', e: 'x' });
assert.deepEqual(lines.map(line => line.status), ['difference', 'same', 'difference', 'pending', 'invalid']);
assert.equal(lines[0].difference, -3);
assert.equal(lines[0].valueDifference, -6);
assert.equal(lines[2].difference, 1.5);
assert.equal(lines[2].valueDifference, 0, 'sin coste no valora');
assert.equal(lines[3].counted, null);

const summary = summarizeCount(lines);
assert.deepEqual(summary, { pending: 1, same: 1, withDifference: 2, invalid: 1, unitsDifference: -1.5, valueDifference: -6 });
assert.deepEqual(linesToApply(lines).map(line => line.level.id), ['a', 'c'], 'solo se ajustan las líneas con diferencia');
assert.equal(linesToApply(lines)[0].counted, 7, 'el ajuste se hace con la cantidad contada (valor absoluto)');

// Sin redondeos raros con decimales
const decimals = summarizeCount(buildCountLines([level('x', 0.1), level('y', 0.2)], { x: '0.3', y: '0.5' }));
assert.equal(decimals.unitsDifference, 0.5);

// Contar a cero un producto con stock es una diferencia, no "sin contar"
assert.equal(buildCountLines([level('z', 4)], { z: '0' })[0].status, 'difference');
assert.deepEqual(summarizeCount([]), { pending: 0, same: 0, withDifference: 0, invalid: 0, unitsDifference: 0, valueDifference: 0 });

// Motivo del movimiento
assert.equal(countReason('2026-10-12', ''), 'Recuento físico 12/10/2026');
assert.equal(countReason('2026-10-12', '  almacén central '), 'Recuento físico 12/10/2026 · almacén central');

console.log('PASS recuento físico: lectura, diferencias, resumen y motivo');
