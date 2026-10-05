import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const directory = await mkdtemp(join(tmpdir(), 'limpatex-login-'));
try {
  const outfile = join(directory, 'login.mjs');
  await build({ entryPoints: ['src/auth/passwordSignIn.ts'], outfile, bundle: true, platform: 'node', format: 'esm' });
  const { passwordSignIn, describeLoginError } = await import(pathToFileURL(outfile).href);
  const key = 'login_credential_failures_v2';
  const email = 'test@example.test';
  const makeStorage = () => {
    const data = new Map();
    return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  };
  let clock = 1_000_000;
  const invalid = { code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' };
  const run = async (storage, error, throws = false) => {
    const states = [];
    let calls = 0;
    const result = await passwordSignIn({ email, storage, now: () => clock, setLoading: (value) => states.push(value), authenticate: async () => {
      calls++;
      if (throws) throw error;
      return { error };
    } });
    assert.deepEqual(states, [true, false], 'Loading must be released on every outcome');
    return { ...result, calls };
  };

  // Service errors never exhaust the user's password attempts, including old locks.
  const storage = makeStorage();
  storage.setItem('login_attempts', JSON.stringify({ [email]: { count: 5, lastAttempt: clock } }));
  for (let i = 0; i < 7; i++) {
    const result = await run(storage, { status: 504, message: '{}' });
    assert.equal(result.error.code, 'temporary_unavailable');
    assert.equal(result.calls, 1);
  }
  assert.equal(storage.getItem(key), null);
  for (const error of [{ status: 500 }, { status: 503 }, { name: 'AuthRetryableFetchError' }, new TypeError('Failed to fetch'), { name: 'AbortError' }, { code: 'request_timeout' }]) {
    assert.equal((await run(storage, error, true)).error.code, 'temporary_unavailable');
  }
  assert.equal(storage.getItem(key), null);
  assert.equal((await run(storage, { status: 429 })).error.code, 'rate_limited');
  assert.equal((await run(storage, { code: 'email_not_confirmed' })).error.code, 'email_not_confirmed');
  assert.equal(storage.getItem(key), null);

  // Only genuine invalid credentials increment the counter. An outage preserves it.
  for (let i = 0; i < 4; i++) assert.equal((await run(storage, invalid)).error.code, 'invalid_credentials');
  assert.equal(JSON.parse(storage.getItem(key))[email].count, 4);
  await run(storage, { status: 500 });
  assert.equal(JSON.parse(storage.getItem(key))[email].count, 4);
  await run(storage, invalid, true);
  const locked = await run(storage, null);
  assert.equal(locked.error.code, 'local_lockout');
  assert.equal(locked.calls, 0);
  clock += 15 * 60 * 1000;
  assert.equal((await run(storage, null)).error, null);
  assert.deepEqual(JSON.parse(storage.getItem(key)), {});

  // Success clears prior credential failures.
  await run(storage, invalid);
  await run(storage, null);
  assert.deepEqual(JSON.parse(storage.getItem(key)), {});

  // Corrupt/restricted storage and unexpected exceptions cannot strand the form.
  for (const raw of ['{', 'null', '[]', JSON.stringify({ [email]: { count: 'bad', lastAttempt: clock } })]) {
    storage.setItem(key, raw);
    assert.equal((await run(storage, null)).error, null);
  }
  const blockedStorage = { getItem() { throw new Error('Storage blocked'); }, setItem() { throw new Error('Storage blocked'); } };
  assert.equal((await run(blockedStorage, null)).error, null);
  for (const error of [undefined, null, {}, new Error('Unexpected failure')]) {
    assert.equal((await run(storage, error, true)).error.code, 'login_failed');
  }
  assert.equal(describeLoginError({ status: 500, code: 'invalid_credentials' }).code, 'temporary_unavailable');
  assert.equal(describeLoginError({ status: 400, message: 'Invalid login credentials' }).code, 'invalid_credentials');
  console.log('OK: login recovery, credential lockout, expiry, success, exceptions and storage failures verified without network access.');
} finally {
  await rm(directory, { recursive: true, force: true });
}
