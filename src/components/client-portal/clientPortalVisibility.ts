import type { PortalBooking } from '../../types/clientPortal';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const CLIENT_PORTAL_PAST_VISIBILITY_DAYS = 7;

const toLocalMidnightMs = (date: Date): number =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

const parseDateOnlyAsLocalDate = (value: string): Date => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return new Date(value);

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
};

export const getPortalBookingCleaningDayMs = (cleaningDate: string): number => {
  const raw = parseDateOnlyAsLocalDate(cleaningDate);
  return toLocalMidnightMs(raw);
};

/**
 * The portal list should hide stale past items, but it must not cap future
 * bookings: owners often add reservations weeks or months in advance.
 */
export const filterClientPortalListBookings = (
  bookings: PortalBooking[],
  now: Date = new Date(),
): PortalBooking[] => {
  const todayMs = toLocalMidnightMs(now);
  const sevenDaysAgoMs = todayMs - CLIENT_PORTAL_PAST_VISIBILITY_DAYS * MS_PER_DAY;

  return bookings.filter((booking) =>
    getPortalBookingCleaningDayMs(booking.cleaningDate) >= sevenDaysAgoMs,
  );
};
