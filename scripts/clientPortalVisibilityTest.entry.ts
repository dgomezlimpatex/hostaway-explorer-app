import {
  CLIENT_PORTAL_PAST_VISIBILITY_DAYS,
  filterClientPortalListBookings,
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
  const now = new Date(2026, 6, 5, 12, 0, 0); // 5 July 2026, local time
  const visible = filterClientPortalListBookings([
    booking('too-old', '2026-06-27'),
    booking('recent-past', '2026-06-28'),
    booking('within-30-days', '2026-08-04'),
    booking('fuensanta-aug-10', '2026-08-10'),
    booking('far-future', '2026-12-24'),
  ], now).map((item) => item.id);

  assert.equal(CLIENT_PORTAL_PAST_VISIBILITY_DAYS, 7);
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
};
