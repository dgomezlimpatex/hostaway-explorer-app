import { httpGet } from '../supabase/functions/avantio-sync/avantio-api.ts';

type Assert = typeof import('node:assert/strict');

const abortError = () => new DOMException('The signal has been aborted', 'AbortError');

export const run = async (assert: Assert) => {
  let attempts = 0;
  const recoveryFetch: typeof fetch = async () => {
    attempts += 1;
    if (attempts <= 3) throw abortError();
    return new Response(JSON.stringify({ data: [{ id: 'recovered' }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const recovered = await httpGet(
    'https://api.avantio.pro/pms/v1/bookings?limit=200',
    { 'X-Avantio-Auth': 'must-not-leak' },
    {
      fetchImpl: recoveryFetch,
      sleep: async () => undefined,
    },
  );

  assert.equal(attempts, 4, 'a fourth attempt must recover after three transient aborts');
  assert.equal(recovered.data[0].id, 'recovered');

  let terminalAttempts = 0;
  const failingFetch: typeof fetch = async () => {
    terminalAttempts += 1;
    throw abortError();
  };

  await assert.rejects(
    () => httpGet(
      'https://api.avantio.pro/pms/v1/bookings?limit=200&departureFrom=2026-07-25',
      { 'X-Avantio-Auth': 'must-not-leak' },
      {
        retries: 4,
        timeoutMs: 5,
        fetchImpl: failingFetch,
        sleep: async () => undefined,
      },
    ),
    (error: unknown) => {
      assert.equal(terminalAttempts, 4);
      assert.ok(error instanceof Error);
      assert.match(error.message, /Avantio request timed out after 4 attempts/i);
      assert.match(error.message, /\/pms\/v1\/bookings\?limit=200/);
      assert.doesNotMatch(error.message, /must-not-leak/);
      return true;
    },
  );

  let clientErrorAttempts = 0;
  const unauthorizedFetch: typeof fetch = async () => {
    clientErrorAttempts += 1;
    return new Response('Unauthorized', { status: 401 });
  };

  await assert.rejects(
    () => httpGet(
      'https://api.avantio.pro/pms/v1/bookings',
      { 'X-Avantio-Auth': 'must-not-leak' },
      {
        retries: 4,
        timeoutMs: 5,
        fetchImpl: unauthorizedFetch,
        sleep: async () => undefined,
      },
    ),
    /API Error 401/,
  );
  assert.equal(clientErrorAttempts, 1, 'non-retriable 4xx responses must fail immediately');
};
