import { AvantioReservation } from './types.ts';

/**
 * Determines if a task should be created for a reservation.
 * Creates task for ALL non-cancelled reservations with future checkout.
 */
export function shouldCreateTaskForReservation(reservation: AvantioReservation): boolean {
  const statusUpper = reservation.status.toUpperCase();
  
  // Cancelled reservations don't get tasks
  if (statusUpper === 'CANCELLED' || statusUpper === 'CANCELED') {
    return false;
  }
  
  // If has cancellation date, don't create task
  if (reservation.cancellationDate) {
    return false;
  }
  
  // Checkout must be in the future
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkoutDate = new Date(reservation.departureDate);
  
  if (checkoutDate < today) {
    return false;
  }
  
  // All other reservations get a cleaning task
  return true;
}
