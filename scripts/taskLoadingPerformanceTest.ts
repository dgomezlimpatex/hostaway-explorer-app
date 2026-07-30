import assert from 'node:assert/strict';
import { filterTasksByDateRange, filterTasksByQueryRange, getTaskDateRange, getTaskWindowRange } from '../src/utils/taskQueryRange';

const viewedDate = new Date('2026-07-30T10:00:00Z');

assert.deepEqual(
  getTaskDateRange(viewedDate, 'day'),
  { dateFrom: '2026-07-30', dateTo: '2026-07-30' },
  'La vista diaria solo debe consultar el día visible',
);

assert.deepEqual(
  getTaskDateRange(viewedDate, 'three-day'),
  { dateFrom: '2026-07-30', dateTo: '2026-08-01' },
  'La vista de tres días solo debe consultar sus tres fechas visibles',
);

assert.deepEqual(
  getTaskDateRange(viewedDate, 'week'),
  { dateFrom: '2026-07-27', dateTo: '2026-08-02' },
  'La vista semanal debe consultar de lunes a domingo',
);

assert.deepEqual(
  getTaskWindowRange(new Date('2026-12-31T23:30:00Z'), 2),
  { dateFrom: '2027-01-01', dateTo: '2027-01-02' },
  'La agenda de limpiadora debe consultar fecha seleccionada y mañana en Madrid',
);

assert.deepEqual(
  filterTasksByDateRange(
    [{ date: '2027-01-01' }, { date: '2027-01-02' }, { date: '2027-01-03' }],
    { dateFrom: '2027-01-01', dateTo: '2027-01-02' },
  ).map((task) => task.date),
  ['2027-01-01', '2027-01-02'],
  'La agenda de limpiadora no debe conservar tareas fuera de su ventana de dos días',
);

const timezoneCases = [
  {
    instant: '2026-07-26T22:30:00Z',
    view: 'week' as const,
    expected: { dateFrom: '2026-07-27', dateTo: '2026-08-02' },
    label: 'cambio domingo/lunes',
  },
  {
    instant: '2026-12-31T23:30:00Z',
    view: 'three-day' as const,
    expected: { dateFrom: '2027-01-01', dateTo: '2027-01-03' },
    label: 'cambio de año',
  },
  {
    instant: '2026-03-29T22:30:00Z',
    view: 'week' as const,
    expected: { dateFrom: '2026-03-30', dateTo: '2026-04-05' },
    label: 'inicio del horario de verano',
  },
  {
    instant: '2026-10-25T23:30:00Z',
    view: 'week' as const,
    expected: { dateFrom: '2026-10-26', dateTo: '2026-11-01' },
    label: 'fin del horario de verano',
  },
];

timezoneCases.forEach(({ instant, view, expected, label }) => {
  assert.deepEqual(
    getTaskDateRange(new Date(instant), view),
    expected,
    `El rango debe respetar Europe/Madrid en ${label}`,
  );
});

const queriedWeek = [
  '2026-07-27',
  '2026-07-28',
  '2026-07-29',
  '2026-07-30',
  '2026-07-31',
  '2026-08-01',
  '2026-08-02',
].map((date) => ({ date }));

assert.deepEqual(
  filterTasksByQueryRange(
    queriedWeek,
    new Date('2026-07-26T22:30:00Z'),
    'week',
  ).map((task) => task.date),
  queriedWeek.map((task) => task.date),
  'El filtro posterior debe conservar toda la semana consultada en Madrid',
);

console.log('Task loading performance regression test passed');
