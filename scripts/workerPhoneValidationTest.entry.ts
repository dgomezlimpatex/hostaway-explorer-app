import { normalizeWorkerPhoneForStorage } from '../src/utils/phone/workerPhone';

type Assert = typeof import('node:assert/strict');

export function run(assert: Assert) {
  assert.equal(normalizeWorkerPhoneForStorage(''), '');
  assert.equal(normalizeWorkerPhoneForStorage('   '), '');
  assert.equal(normalizeWorkerPhoneForStorage('698 157 788'), '+34698157788');
  assert.equal(normalizeWorkerPhoneForStorage('+34 698 157 788'), '+34698157788');
  assert.throws(
    () => normalizeWorkerPhoneForStorage('981 123 456'),
    /móvil español válido/i,
  );
  assert.throws(
    () => normalizeWorkerPhoneForStorage('123'),
    /móvil español válido/i,
  );
}
