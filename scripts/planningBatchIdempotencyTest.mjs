import assert from 'node:assert/strict';
import {
  buildPlanningItems,
  canonicalRequestHash,
  combinedPlanningSql,
} from './planningBatchTestSupport.mjs';

const sql = combinedPlanningSql();
const request = {
  sede_id: '00000000-0000-4000-0001-000000000001',
  source_run_id: null,
  source_run_version: 7,
  notification_policy: 'require_all_recipients',
  items: buildPlanningItems(30),
};
const sameRequestDifferentKeyOrder = {
  items: request.items.map((item) => Object.fromEntries(Object.entries(item).reverse())),
  notification_policy: request.notification_policy,
  source_run_version: request.source_run_version,
  source_run_id: request.source_run_id,
  sede_id: request.sede_id,
};
assert.equal(canonicalRequestHash(request), canonicalRequestHash(sameRequestDifferentKeyOrder));
const changed = structuredClone(request);
changed.items[0].proposed_end_time = '13:15';
assert.notEqual(canonicalRequestHash(request), canonicalRequestHash(changed));

assert.match(sql, /idempotency_key/i);
assert.match(sql, /request_hash/i);
assert.match(sql, /UNIQUE[\s\S]*(?:sede_id[\s\S]*)?idempotency_key|CREATE\s+UNIQUE\s+INDEX[\s\S]*idempotency_key/i);
assert.match(sql, /digest\s*\(|sha256|encode\s*\(/i, 'el servidor debe calcular/verificar hash canónico');
assert.match(sql, /IDEMPOTENCY_CONFLICT/i);
assert.match(sql, /idempotent_replay/i);
assert.match(sql, /request_hash\s*=|request_hash\s*<>/i);
assert.match(sql, /FOR\s+UPDATE/i, 'la key debe reclamarse bajo lock antes de escribir negocio');

console.log('planning-batch-idempotency-tests: OK');
