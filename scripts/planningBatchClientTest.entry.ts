import {
  buildPlanningBatchRequestHash,
  buildPlanningBatchRpcArgs,
  type PlanningBatchApplyRequest,
} from '../src/services/planning/planningBatchClient';

type Assert = typeof import('node:assert/strict');

const baseRequest: PlanningBatchApplyRequest = {
  batchId: '50000000-0000-4000-8000-000000000001',
  idempotencyKey: 'planning:test:one',
  sedeId: '10000000-0000-4000-8000-000000000001',
  sourceRunId: null,
  sourceRunVersion: null,
  notificationPolicy: 'require_all_recipients',
  items: [{
    task_id: '40000000-0000-4000-8000-000000000001',
    expected_planning_version: 3,
    expected_status: 'pending',
    expected_cleaner_ids: ['30000000-0000-4000-8000-000000000001'],
    date: '2026-08-03',
    start_time: '10:00',
    end_time: '11:00',
    cleaner_ids: ['30000000-0000-4000-8000-000000000002'],
  }],
};

export async function run(assert: Assert) {
  const reordered = {
    ...baseRequest,
    items: [{
      cleaner_ids: baseRequest.items[0].cleaner_ids,
      end_time: '11:00',
      start_time: '10:00',
      date: '2026-08-03',
      expected_cleaner_ids: baseRequest.items[0].expected_cleaner_ids,
      expected_status: 'pending',
      expected_planning_version: 3,
      task_id: baseRequest.items[0].task_id,
    }],
  } satisfies PlanningBatchApplyRequest;
  const firstHash = await buildPlanningBatchRequestHash(baseRequest);
  const secondHash = await buildPlanningBatchRequestHash(reordered);
  assert.equal(firstHash, secondHash);
  assert.equal(
    firstHash,
    'cf0015e616e7d4579297e80429cc2c3e9665b14994ad868c7d6098983dbbce07',
    'el hash del navegador debe coincidir byte a byte con planning_batch_request_hash de PostgreSQL',
  );

  const args = await buildPlanningBatchRpcArgs(baseRequest);
  assert.deepEqual(Object.keys(args), [
    '_batch_id', '_idempotency_key', '_sede_id', '_source_run_id',
    '_source_run_version', '_request_hash', '_notification_policy', '_items',
  ]);
  assert.equal(args._request_hash, firstHash);
  assert.equal(args._items, baseRequest.items);
}
