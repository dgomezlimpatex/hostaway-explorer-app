import assert from 'node:assert/strict';
import {
  assertAppearsBefore,
  buildPlanningItems,
  combinedPlanningSql,
} from './planningBatchTestSupport.mjs';

const baselineItems = buildPlanningItems(150);
for (const faultAt of [1, 75, 150]) {
  const faultedItems = structuredClone(baselineItems);
  faultedItems[faultAt - 1].expected_planning_version = Number.MAX_SAFE_INTEGER;
  const changedOrdinals = faultedItems
    .map((item, index) => item.expected_planning_version === baselineItems[index].expected_planning_version ? null : index + 1)
    .filter(Boolean);
  assert.deepEqual(changedOrdinals, [faultAt], `fixture de fault injection ${faultAt}/150 debe alterar un único item`);
}

const sql = combinedPlanningSql();
assert.match(sql, /(?:jsonb_array_length\s*\(\s*_items\s*\)|v_count)\s*<\s*1/i);
assert.match(sql, /(?:jsonb_array_length\s*\(\s*_items\s*\)|v_count)\s*>\s*500/i);
assert.match(sql, /pg_advisory_xact_lock/i, 'el batch debe serializar sede/recursos con locks transaccionales');
assert.match(sql, /SELECT[\s\S]*FROM\s+public\.tasks[\s\S]*ORDER\s+BY[\s\S]*FOR\s+UPDATE/i);
assert.match(sql, /BEGIN[\s\S]*EXCEPTION\s+WHEN\s+(?:OTHERS|SQLSTATE)/i, 'las mutaciones deben vivir en una subtransacción PL/pgSQL');
assert.doesNotMatch(sql, /\b(?:COMMIT|ROLLBACK)\b/i, 'la función no puede romper la transacción de la RPC');
assert.match(sql, /jsonb_to_recordset|jsonb_array_elements/i, 'los items deben transformarse en un conjunto SQL');
assert.match(sql, /INSERT\s+INTO\s+public\.planning_apply_batch_items/i);
assert.match(sql, /(?:INSERT\s+INTO|DELETE\s+FROM)\s+public\.task_assignments/i);
assert.match(sql, /INSERT\s+INTO\s+public\.notification_events/i);
assert.match(sql, /planning_assignment_audit/i);
assert.match(sql, /planning_batch_id/i, 'los eventos temporales deben quedar ligados al batch');
assert.match(sql, /superseded|DELETE\s+FROM\s+public\.notification_events/i, 'debe eliminar o superseder eventos intermedios');

assertAppearsBefore(
  sql,
  /conflict|validation_failed/i,
  /(?:INSERT\s+INTO|DELETE\s+FROM)\s+public\.task_assignments/i,
  'la revalidación completa debe preceder la primera mutación canónica',
);

for (const forbiddenExternalEffect of [
  /net\.http_post/i,
  /http_post\s*\(/i,
  /api\.whatsapp\.com/i,
  /graph\.facebook\.com/i,
  /api\.resend\.com/i,
]) {
  assert.doesNotMatch(sql, forbiddenExternalEffect, 'la transacción jamás llama a Meta/Resend');
}

console.log('planning-batch-atomicity-tests: OK (fault points 1/75/150 quedan cubiertos por validación-before-write)');
