import type { PortalBooking } from '../../types/clientPortal';
import { formatMadridDate } from '../../utils/date';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const CLIENT_PORTAL_PAST_VISIBILITY_DAYS = 30;

// Encode civil dates in UTC for arithmetic only, avoiding browser timezone and DST shifts.
export const getPortalBookingCleaningDayMs = (cleaningDate: string): number =>
  Date.parse(`${cleaningDate.slice(0, 10)}T00:00:00Z`);

export const getClientPortalHistoryCutoff = (now: Date = new Date()): string => {
  const todayMs = getPortalBookingCleaningDayMs(formatMadridDate(now));
  return new Date(todayMs - CLIENT_PORTAL_PAST_VISIBILITY_DAYS * MS_PER_DAY)
    .toISOString().slice(0, 10);
};

/**
 * The portal list should hide stale past items, but it must not cap future
 * bookings: owners often add reservations weeks or months in advance.
 */
export const filterClientPortalListBookings = (
  bookings: PortalBooking[],
  now: Date = new Date(),
): PortalBooking[] => {
  const cutoffMs = getPortalBookingCleaningDayMs(getClientPortalHistoryCutoff(now));

  return bookings.filter((booking) =>
    getPortalBookingCleaningDayMs(booking.cleaningDate) >= cutoffMs,
  );
};
