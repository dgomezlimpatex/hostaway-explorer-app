import assert from 'node:assert/strict';
import { combinedPlanningSql } from './planningBatchTestSupport.mjs';

const sql = combinedPlanningSql();

assert.match(sql, /pg_advisory_xact_lock[\s\S]*(?:sede|_sede_id)/i);
assert.match(sql, /ORDER\s+BY[\s\S]*(?:task_id|id)[\s\S]*FOR\s+UPDATE/i, 'tareas solapadas deben bloquearse en orden estable');
assert.match(sql, /planning_apply_batches[\s\S]*FOR\s+UPDATE/i, 'la fila idempotente debe tener un único dueño');
assert.match(sql, /planning_version/i, 'el segundo manager debe observar conflicto de versión, no sobrescribir');
assert.match(sql, /IDEMPOTENCY_CONFLICT|PLANNING_VERSION_CONFLICT|validation_failed/i);
assert.doesNotMatch(sql, /pg_advisory_lock\s*\(/i, 'usar locks de sesión puede dejar bloqueos huérfanos');

console.log('planning-batch-concurrency-tests: OK (dos managers/tareas solapadas)');
