import { resolveDaysAhead } from '../supabase/functions/_shared/syncHorizon.ts';
import {
  avantioFutureDays,
  fetchAllAvantioReservations,
} from '../supabase/functions/avantio-sync/avantio-api.ts';
import {
  shouldCreateTaskForReservation,
  taskCreationHorizonDays,
} from '../supabase/functions/avantio-sync/reservation-validator.ts';

type Assert = typeof import('node:assert/strict');

/** Fecha local (la que usa el validador de tareas). */
const localInDays = (days: number): string => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Fecha UTC (la que usa la ventana de la API). */
const utcInDays = (days: number): string => {
  const d = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export const run = async (assert: Assert) => {
  // --- helper de horizonte ---
  assert.equal(resolveDaysAhead('92', 30), 92, 'lee un entero positivo');
  assert.equal(resolveDaysAhead(92, 30), 92, 'acepta un número entero');
  assert.equal(resolveDaysAhead(undefined, 30), 30, 'sin valor usa el default');
  assert.equal(resolveDaysAhead(null, 30), 30, 'null usa el default');
  assert.equal(resolveDaysAhead('', 30), 30, 'cadena vacía usa el default');
  assert.equal(resolveDaysAhead('abc', 30), 30, 'no numérico usa el default');
  assert.equal(resolveDaysAhead('0', 30), 30, 'cero usa el default');
  assert.equal(resolveDaysAhead(0, 30), 30, 'cero numérico usa el default');
  assert.equal(resolveDaysAhead('-5', 30), 30, 'negativo usa el default');
  assert.equal(resolveDaysAhead(' 92 ', 30), 92, 'tolera espacios');
  assert.equal(resolveDaysAhead(1.5, 30), 30, 'decimal usa el default');

  // --- ventana de lectura de Avantio ---
  assert.equal(avantioFutureDays(), 30, 'sin override, el default histórico de Avantio es 30');
  assert.equal(taskCreationHorizonDays(), 30, 'sin override, el horizonte de tarea es 30');

  const urls: string[] = [];
  const fakeFetch: typeof fetch = async (input) => {
    urls.push(String(input));
    return new Response(JSON.stringify({ data: [], meta: { totalPages: 1, page: 1 } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  await fetchAllAvantioReservations('token-de-prueba', { fetchImpl: fakeFetch, futureDays: 92 });
  assert.ok(urls.length >= 2, 'debe consultar las dos ventanas (checkouts y entradas)');
  assert.ok(
    urls.some((url) => url.includes(`departureTo=${utcInDays(92)}`)),
    'la ventana de checkouts llega a +92 días',
  );
  assert.ok(
    urls.some((url) => url.includes(`arrivalTo=${utcInDays(92)}`)),
    'la ventana de entradas llega a +92 días',
  );

  // --- creación de tarea de check-out ---
  const base = {
    id: 'r1',
    accommodationId: '1',
    accommodationName: 'Casa',
    accommodationInternalName: 'C1',
    status: 'CONFIRMED',
    arrivalDate: localInDays(1),
    departureDate: localInDays(1),
    guestName: 'Huésped',
  } as any;

  assert.equal(
    shouldCreateTaskForReservation({ ...base, departureDate: localInDays(29) }),
    true,
    'con horizonte 30, un check-out a 29 días crea tarea',
  );
  assert.equal(
    shouldCreateTaskForReservation({ ...base, departureDate: localInDays(60) }),
    false,
    'con horizonte 30, un check-out a 60 días NO crea tarea',
  );
  assert.equal(
    shouldCreateTaskForReservation({ ...base, departureDate: localInDays(60) }, 92),
    true,
    'con horizonte 92, un check-out a 60 días SÍ crea tarea',
  );
  assert.equal(
    shouldCreateTaskForReservation({ ...base, departureDate: localInDays(100) }, 92),
    false,
    'con horizonte 92, un check-out a 100 días no crea tarea',
  );
  assert.equal(
    shouldCreateTaskForReservation({ ...base, status: 'CANCELLED', departureDate: localInDays(10) }),
    false,
    'una reserva cancelada nunca crea tarea',
  );
  assert.equal(
    shouldCreateTaskForReservation({ ...base, status: 'REQUESTED', departureDate: localInDays(10) }),
    false,
    'una solicitud tentativa (REQUESTED) nunca crea tarea',
  );

  console.log('sync-horizon-tests: OK');
};
