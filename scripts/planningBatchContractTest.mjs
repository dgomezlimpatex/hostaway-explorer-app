import assert from 'node:assert/strict';
import {
  combinedPlanningSql,
  sourceWithPlanningBatchClient,
} from './planningBatchTestSupport.mjs';

const sql = combinedPlanningSql();
const clients = sourceWithPlanningBatchClient();
const client = clients.map(({ source }) => source).join('\n');

const orderedArguments = [
  '_batch_id uuid',
  '_idempotency_key text',
  '_sede_id uuid',
  '_source_run_id uuid',
  '_source_run_version bigint',
  '_request_hash text',
  '_notification_policy text',
  '_items jsonb',
];
const signature = orderedArguments
  .map((argument) => argument.replaceAll(' ', '\\s+'))
  .join('\\s*,\\s*');

assert.match(
  sql,
  new RegExp(`FUNCTION\\s+public\\.apply_planning_batch\\s*\\(\\s*${signature}\\s*\\)`, 'i'),
  'SQL y cliente deben compartir la firma aprobada, sin argumentos inventados',
);
assert.match(sql, /RETURNS\s+jsonb/i);
assert.match(sql, /SECURITY\s+DEFINER/i);
assert.match(sql, /SET\s+search_path\s*=\s*(?:pg_catalog,\s*)?public/i);
assert.match(sql, /REVOKE\s+(?:ALL|EXECUTE)[\s\S]*apply_planning_batch[\s\S]*FROM\s+(?:PUBLIC\s*,\s*anon|PUBLIC)[^;]*;/i);
assert.match(sql, /GRANT\s+EXECUTE[\s\S]*apply_planning_batch[\s\S]*TO\s+authenticated/i);

for (const argument of [
  '_batch_id',
  '_idempotency_key',
  '_sede_id',
  '_source_run_id',
  '_source_run_version',
  '_request_hash',
  '_notification_policy',
  '_items',
]) {
  const clientKey = argument.slice(1);
  assert.match(
    client,
    new RegExp(`${argument}\\s*:\\s*[^,}]+`),
    `el cliente debe enviar ${clientKey} con el nombre SQL exacto ${argument}`,
  );
}

for (const state of ['applying', 'applied', 'validation_failed', 'technical_failed']) {
  assert.match(sql, new RegExp(`['"]${state}['"]`), `falta el estado backend ${state}`);
  assert.match(client, new RegExp(`['"]${state}['"]`), `falta tipar el estado cliente ${state}`);
}
for (const resultKey of [
  'batch_id',
  'status',
  'idempotent_replay',
  'applied_task_count',
  'applied_assignment_count',
  'notification_event_count',
  'conflicts',
]) {
  assert.match(sql, new RegExp(`['"]${resultKey}['"]`), `la RPC debe devolver ${resultKey}`);
  assert.match(client, new RegExp(`\\b${resultKey}\\b`), `el cliente debe consumir ${resultKey}`);
}

for (const terminalStatus of ['applied', 'validation_failed', 'technical_failed']) {
  const statusResults = [...sql.matchAll(new RegExp(`jsonb_build_object\\([^;]{0,1600}'status'\\s*,\\s*'${terminalStatus}'[^;]{0,1600}`, 'gi'))];
  assert.ok(statusResults.length > 0, `falta construir resultado ${terminalStatus}`);
  for (const match of statusResults) {
    for (const key of ['applied_task_count', 'applied_assignment_count', 'notification_event_count', 'conflicts']) {
      assert.match(match[0], new RegExp(`'${key}'`, 'i'), `${terminalStatus} debe incluir ${key}`);
    }
  }
}

for (const validationCode of [
  'INVALID_BATCH_IDEMPOTENCY',
  'ITEMS_MUST_BE_ARRAY',
  'ITEM_COUNT_OUT_OF_RANGE',
  'INVALID_NOTIFICATION_POLICY',
  'IDEMPOTENCY_CONFLICT',
  'BATCH_IDEMPOTENCY_CONFLICT',
]) {
  assert.doesNotMatch(
    sql,
    new RegExp(`RAISE\\s+EXCEPTION\\s+['"]${validationCode}['"]`, 'i'),
    `${validationCode} es un outcome de validación y no un error de transporte`,
  );
  const branch = sql.match(new RegExp(`jsonb_build_object\\([^;]{0,1800}'${validationCode}'[^;]{0,1800}`, 'i'));
  assert.ok(branch, `falta resultado ejecutable para ${validationCode}`);
  for (const key of ['batch_id', 'status', 'idempotent_replay', 'applied_task_count', 'applied_assignment_count', 'notification_event_count', 'conflicts']) {
    assert.match(branch[0], new RegExp(`'${key}'`, 'i'), `${validationCode} debe incluir ${key}`);
  }
}
assert.match(sql, /00000000-0000-0000-0000-000000000000/, 'batch_id NULL debe usar UUID sentinel explícito');

console.log('planning-batch-contract-tests: OK');
