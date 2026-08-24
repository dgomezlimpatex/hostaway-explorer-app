import { evaluatePropertyOccupancy, buildBuildingSupervisionAgenda } from '@/features/supervision/buildingAgenda';

export function run(assert: typeof import('node:assert/strict')) {
  const betweenReservations = evaluatePropertyOccupancy({
    now: '2026-08-24T14:00',
    checkInTime: '17:00',
    checkOutTime: '11:00',
    reservations: [
      { id: 'previous', propertyId: 'p1', checkInDate: '2026-08-20', checkOutDate: '2026-08-24', status: 'active' },
      { id: 'next', propertyId: 'p1', checkInDate: '2026-08-24', checkOutDate: '2026-08-28', status: 'active' },
    ],
  });
  assert.equal(betweenReservations.status, 'vacant');
  assert.equal(betweenReservations.nextCheckInDate, '2026-08-24');
  assert.equal(betweenReservations.nextCheckInTime, '17:00');
  assert.equal(betweenReservations.currentCheckOutDate, '2026-08-24');
  assert.equal(betweenReservations.currentCheckOutTime, '11:00');

  const occupied = evaluatePropertyOccupancy({
    now: '2026-08-24T18:00',
    checkInTime: '17:00',
    checkOutTime: '11:00',
    reservations: [{ id: 'next', propertyId: 'p1', checkInDate: '2026-08-24', checkOutDate: '2026-08-28', status: 'active' }],
  });
  assert.equal(occupied.status, 'occupied');
  assert.equal(occupied.currentCheckOutDate, '2026-08-28');
  assert.equal(occupied.currentCheckOutTime, '11:00');

  const agenda = buildBuildingSupervisionAgenda({
    date: '2026-08-24',
    now: '2026-08-24T18:00',
    buildings: [{ id: 'b1', name: 'Edificio 1', checkInTime: '17:00', checkOutTime: '11:00' }],
    properties: [
      { id: 'p1', code: 'P1', name: 'Ocupado', buildingId: 'b1', active: true, checkOutTime: '11:00' },
      { id: 'p2', code: 'P2', name: 'Vacío', buildingId: 'b1', active: true, checkOutTime: '11:00' },
    ],
    tasks: [{ id: 't2', propertyId: 'p2', date: '2026-08-24', status: 'completed', checkIn: '2026-08-25T17:00' }],
    reviews: [],
    incidents: [],
    reservations: [{ id: 'r1', propertyId: 'p1', checkInDate: '2026-08-24', checkOutDate: '2026-08-28', status: 'active' }],
  });
  assert.equal(agenda.buildings[0].properties.find((property) => property.id === 'p1')?.occupancy.status, 'occupied');
  assert.equal(agenda.buildings[0].items.some((item) => item.propertyId === 'p1'), false);
  assert.equal(agenda.buildings[0].properties.find((property) => property.id === 'p2')?.occupancy.status, 'vacant');
  assert.equal(agenda.buildings[0].items.some((item) => item.propertyId === 'p2'), true);
}
