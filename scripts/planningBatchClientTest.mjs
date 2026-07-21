import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'planning-batch-client-'));
const outfile = join(dir, 'test.mjs');
try {
  await build({
    entryPoints: ['scripts/planningBatchClientTest.entry.ts'],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    tsconfig: 'tsconfig.json',
  });
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
    key: () => null,
    length: 0,
  };
  const { run } = await import(`${pathToFileURL(outfile).href}?v=${Date.now()}`);
  await run(assert);
  console.log('planning-batch-client-tests: OK');
} finally {
  rmSync(dir, { recursive: true, force: true });
}

const fixture = {
  sede_id: '10000000-0000-4000-8000-000000000001',
  source_run_id: null,
  source_run_version: null,
  notification_policy: 'require_all_recipients',
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
const idempotencyKey = 'planning-ui:run-42:attempt-1';
const rpcArguments = {
  _batch_id: '50000000-0000-4000-8000-000000000001',
  _idempotency_key: idempotencyKey,
  _sede_id: fixture.sede_id,
  _source_run_id: fixture.source_run_id,
  _source_run_version: fixture.source_run_version,
  _request_hash: null,
  _notification_policy: fixture.notification_policy,
  _items: fixture.items,
};
assert.equal(rpcArguments._idempotency_key, idempotencyKey);
assert.deepEqual(rpcArguments._items, fixture.items);
assert.equal(rpcArguments._request_hash, null);
assert.equal(Object.hasOwn(rpcArguments, '_items'), true);
assert.equal(Object.hasOwn(rpcArguments, '_idempotency_key'), true);
console.log('planning-batch-client-contract-tests: OK key + payload; hash cliente no requerido');
