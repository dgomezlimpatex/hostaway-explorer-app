import type { PortalBooking } from '@/types/clientPortal';

export type PortalOperationalStatus = 'not_cleaned' | 'in_progress' | 'cleaned';

export const getPortalOperationalStatus = (
  taskStatus: PortalBooking['taskStatus'],
): PortalOperationalStatus => {
  if (taskStatus === 'completed') return 'cleaned';
  if (taskStatus === 'in_progress') return 'in_progress';
  return 'not_cleaned';
};

export const getPortalOperationalStatusLabel = (status: PortalOperationalStatus): string => {
  if (status === 'cleaned') return 'Limpia';
  if (status === 'in_progress') return 'En curso';
  return 'No limpia';
};

export const filterPortalBookingsByOperationalDay = (
  bookings: PortalBooking[],
  day: string,
): PortalBooking[] => bookings
  .filter((booking) => (
    Boolean(booking.taskId)
    && booking.cleaningDate.slice(0, 10) === day
    && booking.taskStatus !== 'cancelled'
    && booking.status !== 'cancelled'
  ))
  .sort((left, right) => {
    const timeComparison = (left.startTime || '99:99').localeCompare(right.startTime || '99:99');
    if (timeComparison !== 0) return timeComparison;
    const leftName = left.property?.codigo || left.property?.nombre || '';
    const rightName = right.property?.codigo || right.property?.nombre || '';
    return leftName.localeCompare(rightName, 'es', { numeric: true, sensitivity: 'base' });
  });

export const summarizePortalOperationalStatuses = (bookings: PortalBooking[]) => ({
  not_cleaned: bookings.filter((booking) => getPortalOperationalStatus(booking.taskStatus) === 'not_cleaned').length,
  in_progress: bookings.filter((booking) => getPortalOperationalStatus(booking.taskStatus) === 'in_progress').length,
  cleaned: bookings.filter((booking) => getPortalOperationalStatus(booking.taskStatus) === 'cleaned').length,
});

export const formatPortalTaskTime = (value?: string | null): string => {
  if (!value) return 'Sin hora';
  return value.slice(0, 5);
};
