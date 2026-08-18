import { fetchAllAvantioReservations, getAccommodationDetail, httpGet } from '../supabase/functions/avantio-sync/avantio-api.ts';
import { shouldCreateTaskForReservation } from '../supabase/functions/avantio-sync/reservation-validator.ts';

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

  let rateLimitAttempts = 0;
  const rateLimitedFetch: typeof fetch = async () => {
    rateLimitAttempts += 1;
    if (rateLimitAttempts < 3) return new Response('Too Many Requests', { status: 429 });
    return new Response(JSON.stringify({ data: [{ id: 'after-rate-limit' }] }), { status: 200 });
  };
  const rateLimitRecovery = await httpGet(
    'https://api.avantio.pro/pms/v1/bookings?limit=1',
    { 'X-Avantio-Auth': 'must-not-leak' },
    { retries: 3, fetchImpl: rateLimitedFetch, sleep: async () => undefined },
  );
  assert.equal(rateLimitAttempts, 3, 'HTTP 429 must be retried');
  assert.equal(rateLimitRecovery.data[0].id, 'after-rate-limit');

  let realAbortObserved = false;
  const hangingFetch: typeof fetch = async (_input, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => {
      realAbortObserved = true;
      reject(abortError());
    }, { once: true });
  });
  const timeoutStartedAt = Date.now();
  await assert.rejects(
    () => httpGet(
      'https://api.avantio.pro/pms/v1/bookings?limit=1',
      { 'X-Avantio-Auth': 'must-not-leak' },
      { retries: 1, timeoutMs: 10, fetchImpl: hangingFetch },
    ),
    /timed out after 1 attempt/i,
  );
  assert.equal(realAbortObserved, true, 'the real AbortController signal must cancel a hanging fetch');
  assert.ok(Date.now() - timeoutStartedAt < 250, 'the request timeout must fire promptly');

  let budgetAttempts = 0;
  const budgetFetch: typeof fetch = async (_input, init) => new Promise((_resolve, reject) => {
    budgetAttempts += 1;
    init?.signal?.addEventListener('abort', () => reject(abortError()), { once: true });
  });
  const budgetStartedAt = Date.now();
  const deadlineOptions = {
    retries: 4,
    timeoutMs: 1000,
    deadlineAt: Date.now() + 25,
    fetchImpl: budgetFetch,
  } as unknown as Parameters<typeof httpGet>[2];
  await assert.rejects(
    () => httpGet(
      'https://api.avantio.pro/pms/v1/bookings?limit=1',
      { 'X-Avantio-Auth': 'must-not-leak' },
      deadlineOptions,
    ),
    /global Avantio source budget exhausted/i,
  );
  assert.equal(budgetAttempts, 1, 'the global deadline must stop new attempts');
  assert.ok(Date.now() - budgetStartedAt < 250, 'the global deadline must reserve time for log finalization');

  let accommodationRequestUrl = '';
  const accommodationFetch: typeof fetch = async (input) => {
    accommodationRequestUrl = String(input);
    return new Response(JSON.stringify({
      data: { id: 774600, name: 'CSJ16.1', legalName: 'Casa San Juan 16.1' },
    }), { status: 200 });
  };
  const accommodation = await getAccommodationDetail(
    'must-not-leak',
    '774600',
    { fetchImpl: accommodationFetch },
  );
  assert.match(accommodationRequestUrl, /\/pms\/v1\/accommodations\/774600$/);
  assert.doesNotMatch(accommodationRequestUrl, /\/bookings\//);
  assert.equal(accommodation.name, 'CSJ16.1');

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const addDays = (days: number) => {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  };
  const bookingUrls: string[] = [];
  const futureArrivalFetch: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes('/bookings?')) {
      bookingUrls.push(url);
      const currentReservation = {
        id: 'current-checkout',
        accommodationId: '678795',
        status: 'CONFIRMED',
        dates: { arrival: addDays(-5), departure: addDays(5) },
      };
      const futureArrival = {
        id: 'future-arrival',
        accommodationId: '678795',
        status: 'REQUESTED',
        dates: { arrival: addDays(7), departure: addDays(45) },
      };
      return new Response(JSON.stringify({ data: [currentReservation, futureArrival] }), { status: 200 });
    }
    return new Response(JSON.stringify({ data: { name: 'Blue Ocean Penthouse', internalName: 'RMA.7D' } }), { status: 200 });
  };

  const synced = await fetchAllAvantioReservations('must-not-leak', {
    fetchImpl: futureArrivalFetch,
    deadlineAt: Date.now() + 5000,
  });
  assert.equal(synced.length, 2, 'checkout and future-arrival windows must be deduplicated by reservation ID');
  assert.ok(bookingUrls.some(url => url.includes('departureFrom=') && url.includes('departureTo=')));
  assert.ok(bookingUrls.some(url => url.includes('arrivalFrom=') && url.includes('arrivalTo=')));
  assert.equal(synced.find(item => item.id === 'future-arrival')?.arrivalDate, addDays(7));
  assert.equal(
    shouldCreateTaskForReservation({
      id: 'far-checkout',
      accommodationId: '678795',
      accommodationName: 'Blue Ocean Penthouse',
      accommodationInternalName: 'RMA.7D',
      status: 'CONFIRMED',
      arrivalDate: addDays(7),
      departureDate: addDays(45),
      reservationDate: addDays(0),
      cancellationDate: '',
      nights: 38,
      adults: 2,
      children: 0,
      guestName: 'Huésped de prueba',
      totalAmount: 0,
      currency: 'EUR',
      notes: '',
    }),
    false,
    'a future arrival outside the task horizon must be stored without creating a cleaning task',
  );
};
