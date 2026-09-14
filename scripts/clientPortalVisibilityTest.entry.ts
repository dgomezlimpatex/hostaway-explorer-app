import {
  CLIENT_PORTAL_PAST_VISIBILITY_DAYS,
  filterClientPortalListBookings,
  getClientPortalHistoryCutoff,
} from '../src/components/client-portal/clientPortalVisibility';
import type { PortalBooking } from '../src/types/clientPortal';

type Assert = typeof import('node:assert/strict');

const booking = (id: string, cleaningDate: string): PortalBooking => ({
  id,
  source: 'manual',
  isEditable: true,
  cleaningDate,
  checkInDate: cleaningDate,
  checkOutDate: cleaningDate,
  guestCount: null,
  specialRequests: null,
  status: 'active',
  taskId: null,
  reservationId: id,
});

export const run = async (assert: Assert) => {
  const now = new Date('2026-07-05T10:00:00Z');
  const visible = filterClientPortalListBookings([
    booking('too-old', '2026-06-04'),
    booking('recent-past', '2026-06-05'),
    booking('within-30-days', '2026-08-04'),
    booking('fuensanta-aug-10', '2026-08-10'),
    booking('far-future', '2026-12-24'),
  ], now).map((item) => item.id);

  assert.equal(CLIENT_PORTAL_PAST_VISIBILITY_DAYS, 30);
  assert.deepEqual(visible, [
    'recent-past',
    'within-30-days',
    'fuensanta-aug-10',
    'far-future',
  ]);
  assert.ok(
    visible.includes('fuensanta-aug-10'),
    'a reservation saved on 5 July with checkout 10 August must appear in the client portal list',
  );

  const september = new Date('2026-09-08T22:30:00Z'); // Already 9 September in Madrid
  assert.equal(getClientPortalHistoryCutoff(september), '2026-08-10');
  assert.deepEqual(filterClientPortalListBookings([
    booking('outside', '2026-08-09'),
    booking('boundary', '2026-08-10'),
    booking('august-report', '2026-08-31'),
    booking('today', '2026-09-09'),
    booking('future', '2027-01-01'),
  ], september).map(item => item.id), ['boundary', 'august-report', 'today', 'future']);
  assert.equal(getClientPortalHistoryCutoff(new Date('2026-03-30T00:00:00Z')), '2026-02-28');
  assert.equal(getClientPortalHistoryCutoff(new Date('2026-10-26T00:00:00Z')), '2026-09-26');
  assert.equal(getClientPortalHistoryCutoff(new Date('2026-01-05T12:00:00Z')), '2025-12-06');
  assert.equal(getClientPortalHistoryCutoff(new Date('2024-03-01T12:00:00Z')), '2024-01-31');
};
