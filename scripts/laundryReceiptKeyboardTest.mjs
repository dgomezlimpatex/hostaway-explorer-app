import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Execute the actual keyboard adapter without DOM, network or production writes.
const result = await build({entryPoints: ['src/components/inventory/receiptKeyboard.ts'], bundle: true, write: false, format: 'esm', platform: 'node'});
const { handleReceiptQuantityKey } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
let added = 0, prevented = 0;
const event = overrides => ({key: 'Enter', repeat: false, nativeEvent: {isComposing: false}, preventDefault: () => prevented++, ...overrides});
const add = () => added++;
handleReceiptQuantityKey(event(), false, '12', add);
assert.equal(added, 1); assert.equal(prevented, 1);
for (const [locked, value] of [[true, '12'], [false, undefined], [false, ''], [false, '   ']]) {
  handleReceiptQuantityKey(event(), locked, value, add);
}
handleReceiptQuantityKey(event({repeat: true}), false, '12', add);
handleReceiptQuantityKey(event({key: 'Tab'}), false, '12', add);
handleReceiptQuantityKey(event({nativeEvent: {isComposing: true}}), false, '12', add);
assert.equal(added, 1, 'Empty/locked/repeated/composing/non-Enter input cannot add');
assert.equal(prevented, 6);
handleReceiptQuantityKey(event(), false, '0', add);
assert.equal(added, 2, 'Quantity validation remains with the existing add callback');
console.log('receipt-keyboard: Enter delegates once; pending, empty, held keys and composition blocked.');
