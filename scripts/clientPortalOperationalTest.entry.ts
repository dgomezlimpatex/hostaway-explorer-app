import {
  applyPortalOperationalStatuses,
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
  reservationId: null,
  property: { id, codigo: propertyCode, nombre: propertyCode, direccion: '' },
});

export const run = async (assert: Assert) => {
  assert.equal(getPortalOperationalStatus('pending'), 'not_cleaned');
  assert.equal(
    getPortalOperationalStatus('in-progress'),
    'in_progress',
    'the real task status used when a worker starts a cleaning must appear as En curso',
  );
  assert.equal(
    getPortalOperationalStatus('in_progress'),
    'in_progress',
    'legacy/report-style status remains compatible',
  );
  assert.equal(getPortalOperationalStatus('completed'), 'cleaned');
  assert.equal(getPortalOperationalStatusLabel('not_cleaned'), 'No limpia');
  assert.equal(getPortalOperationalStatusLabel('in_progress'), 'En curso');
  assert.equal(getPortalOperationalStatusLabel('cleaned'), 'Limpia');
  assert.equal(formatPortalTaskTime('11:30:00'), '11:30');
  assert.equal(formatPortalTaskTime(null), 'Sin hora');

  const enriched = applyPortalOperationalStatuses(
    [booking('report-started', '2026-07-22', 'pending', '12:00:00', 'R1')],
    [{ task_id: 'report-started', operational_status: 'in-progress' }],
  );
  assert.equal(
    enriched[0].taskStatus,
    'in-progress',
    'an in-progress report must enrich a still-pending task without mutating the task row',
  );

  const bookings = [
    booking('late', '2026-07-22', 'pending', '13:00:00', 'B2'),
    booking('other-day', '2026-07-23', 'pending', '09:00:00', 'C1'),
    booking('done', '2026-07-22', 'completed', '11:00:00', 'A1'),
    booking('active', '2026-07-22', 'in-progress', '11:30:00', 'A2'),
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
