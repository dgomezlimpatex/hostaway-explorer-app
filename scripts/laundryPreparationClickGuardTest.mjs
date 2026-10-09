import assert from 'node:assert/strict';
import { build } from 'esbuild';

const result = await build({ entryPoints: ['src/components/laundry-share/preparationClickGuard.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { createPreparationClickGuard } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
let time = 0;
const guard = createPreparationClickGuard(() => time);
assert.equal(guard.remainingSeconds(), 0);
assert.equal(guard.tryStart(), true);
for (let i = 0; i < 10; i++) assert.equal(guard.tryStart(), false, 'Synchronous repeated clicks must be ignored');
assert.equal(guard.remainingSeconds(), 3);
guard.finish();
time = 1000;
assert.equal(guard.remainingSeconds(), 2);
time = 2999;
assert.equal(guard.tryStart(), false, 'A different bag still shares the cooldown');
assert.equal(guard.remainingSeconds(), 1);
time = 3000;
assert.equal(guard.remainingSeconds(), 0);
assert.equal(guard.tryStart(), true, 'Exactly three seconds allows the next bag');
time = 9000;
assert.equal(guard.tryStart(), false, 'A slow save must remain locked after three seconds');
guard.finish();
assert.equal(guard.tryStart(), true);
guard.finish(); // Success and failure both release the in-flight lock.
assert.equal(guard.tryStart(), false, 'A fast failure does not bypass the cooldown');
time = 12000;
assert.equal(guard.tryStart(), true, 'A failed action can be retried after the cooldown');
console.log('PASS preparation click guard: immediate repeats, exact boundary, slow saves, failure/retry');
