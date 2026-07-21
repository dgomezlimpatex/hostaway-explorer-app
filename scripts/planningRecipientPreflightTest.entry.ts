import { evaluatePlanningRecipientPreflight } from '../src/services/planning/planningRecipientPreflight';

type Assert = typeof import('node:assert/strict');

export function run(assert: Assert) {
  const workers = [
    { id: 'a', name: 'Ana', telefono: '600 111 222', whatsapp_phone_e164: null },
    { id: 'b', name: 'Bea', telefono: '', whatsapp_phone_e164: '+34600222333' },
    { id: 'c', name: 'Celia', telefono: '981123456', whatsapp_phone_e164: null },
  ];
  const requiredCleanerIds = Array.from({ length: 150 }, (_, index) => ['a', 'b', 'c'][index % 3]);
  const result = evaluatePlanningRecipientPreflight({ requiredCleanerIds, workers, policy: 'require_all_recipients' });

  assert.equal(result.requiredRecipientCount, 3);
  assert.equal(result.reachable.length, 2);
  assert.deepEqual(result.legacyFallback.map((item) => item.cleanerId), ['b']);
  assert.deepEqual(result.unreachable.map((item) => item.cleanerId), ['c']);
  assert.equal(result.canCommit, false);
  assert.equal(JSON.stringify(result).includes('+34600'), false, 'preflight output must not expose full phones');

  const permissive = evaluatePlanningRecipientPreflight({ requiredCleanerIds, workers, policy: 'best_effort' });
  assert.equal(permissive.canCommit, true);

  const missingWorker = evaluatePlanningRecipientPreflight({ requiredCleanerIds: ['missing'], workers, policy: 'require_all_recipients' });
  assert.equal(missingWorker.canCommit, false);
  assert.equal(missingWorker.unreachable[0].reason, 'worker_not_found');
}
