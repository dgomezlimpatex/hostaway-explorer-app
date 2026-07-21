import assert from 'node:assert/strict';
import {
  buildPlanningItems,
  combinedPlanningSql,
} from './planningBatchTestSupport.mjs';

const sql = combinedPlanningSql();
const scenarios = [
  { count: 1, recurringEvery: 0 },
  { count: 30, recurringEvery: 0 },
  { count: 70, recurringEvery: 7 },
  { count: 150, recurringEvery: 10 },
  { count: 500, recurringEvery: 25 },
];

for (const scenario of scenarios) {
  const items = buildPlanningItems(scenario.count, { recurringEvery: scenario.recurringEvery });
  assert.equal(items.length, scenario.count);
  assert.equal(new Set(items.map((item) => item.task_id)).size, scenario.count);
  assert.ok(items.every((item) => item.proposed_cleaner_ids.length === 1));
  if (scenario.recurringEvery > 0) {
    assert.ok(items.some((item) => item.occurrence_key), `${scenario.count} debe incluir recurrencias`);
  }
}

const amplified = buildPlanningItems(150, { workersPerTask: 3 });
assert.equal(amplified.flatMap((item) => item.proposed_cleaner_ids).length, 450);
assert.equal(new Set(amplified.flatMap((item) => item.proposed_cleaner_ids)).size, 450);

assert.match(sql, /(?:jsonb_array_length\s*\(\s*_items\s*\)|v_count)\s*>\s*500/i, '501 debe rechazarse explícitamente');
assert.match(sql, /jsonb_to_recordset|jsonb_array_elements/i);
assert.match(sql, /ON\s+CONFLICT[\s\S]*recurring_task_id[\s\S]*execution_date|UNIQUE[\s\S]*recurring_task_id[\s\S]*execution_date/i);
assert.match(sql, /expected_task_count/i);
assert.match(sql, /expected_assignment_count/i);
assert.doesNotMatch(
  sql,
  /FOR\s+[^;]*\bIN\s+(?:SELECT|\d+\.\.jsonb_array_length)[\s\S]{0,1200}(?:UPDATE\s+public\.tasks|INSERT\s+INTO\s+public\.task_assignments)/i,
  'el camino de carga no puede aplicar tareas una a una',
);

console.log('planning-batch-load-scenarios: OK (1/30/70/150/500 y amplificación 450)');
