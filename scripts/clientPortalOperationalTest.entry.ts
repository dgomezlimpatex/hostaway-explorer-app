import {
  filterPortalBookingsByOperationalDay,
  formatPortalTaskTime,
  getPortalOperationalStatus,
  getPortalOperationalStatusLabel,
  summarizePortalOperationalStatuses,
} from '../src/components/client-portal/portalOperationalView';
import type { PortalBooking } from '../src/types/clientPortal';

type Assert = typeof import('node:assert/strict');

const booking = (
  id: string,
  cleaningDate: string,
  taskStatus: string,
  startTime: string | null,
  propertyCode: string,
): PortalBooking => ({
  id,
  source: 'external',
  isEditable: false,
  cleaningDate,
  checkInDate: null,
  checkOutDate: null,
  guestCount: null,
  specialRequests: null,
  status: taskStatus as PortalBooking['status'],
  taskStatus,
  taskId: id,
  startTime,
  endTime: startTime ? '14:00:00' : null,
  reservationId: null,
  property: { id, codigo: propertyCode, nombre: propertyCode, direccion: '' },
});

export const run = async (assert: Assert) => {
  assert.equal(getPortalOperationalStatus('pending'), 'not_cleaned');
  assert.equal(getPortalOperationalStatus('in_progress'), 'in_progress');
  assert.equal(getPortalOperationalStatus('completed'), 'cleaned');
  assert.equal(getPortalOperationalStatusLabel('not_cleaned'), 'No limpia');
  assert.equal(getPortalOperationalStatusLabel('in_progress'), 'En curso');
  assert.equal(getPortalOperationalStatusLabel('cleaned'), 'Limpia');
  assert.equal(formatPortalTaskTime('11:30:00'), '11:30');
  assert.equal(formatPortalTaskTime(null), 'Sin hora');

  const bookings = [
    booking('late', '2026-07-22', 'pending', '13:00:00', 'B2'),
    booking('other-day', '2026-07-23', 'pending', '09:00:00', 'C1'),
    booking('done', '2026-07-22', 'completed', '11:00:00', 'A1'),
    booking('active', '2026-07-22', 'in_progress', '11:30:00', 'A2'),
    booking('cancelled', '2026-07-22', 'cancelled', '10:00:00', 'Z1'),
    booking('no-time', '2026-07-22', 'pending', null, 'A0'),
    { ...booking('unlinked', '2026-07-22', 'pending', '09:00:00', 'U1'), taskId: null },
  ];

  const selected = filterPortalBookingsByOperationalDay(bookings, '2026-07-22');
  assert.deepEqual(selected.map((item) => item.id), ['done', 'active', 'late', 'no-time']);
  assert.deepEqual(summarizePortalOperationalStatuses(selected), {
    not_cleaned: 2,
    in_progress: 1,
    cleaned: 1,
  });
};
