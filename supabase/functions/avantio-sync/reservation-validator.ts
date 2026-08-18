import { AvantioReservation } from './types.ts';

export const TASK_CREATION_HORIZON_DAYS = 30;

/**
 * Determines if a task should be created for a reservation.
 * Creates tasks only for non-cancelled reservations whose checkout is inside
 * the operational sync horizon. Reservations arriving in that horizon may be
 * stored for future-entry display even when their checkout is later.
 */
export function shouldCreateTaskForReservation(reservation: AvantioReservation): boolean {
  const statusUpper = reservation.status.toUpperCase();
  
  // Cancelled or unavailable reservations don't get tasks
  if (statusUpper === 'CANCELLED' || statusUpper === 'CANCELED' || statusUpper === 'UNAVAILABLE' || statusUpper === 'UNAVALIABLE') {
    return false;
  }
  
  // REQUESTED = solicitud tentativa no confirmada. No genera tarea ni alerta.
  // Solo se crean tareas para reservas confirmadas (CONFIRMED, BOOKED, etc.)
  if (statusUpper === 'REQUESTED' || statusUpper === 'PENDING' || statusUpper === 'TENTATIVE') {
    return false;
  }
  
  // If has cancellation date, don't create task
  if (reservation.cancellationDate) {
    return false;
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkoutDate = new Date(reservation.departureDate);
  
  if (checkoutDate < today) {
    return false;
  }

  const lastTaskDate = new Date(today);
  lastTaskDate.setDate(lastTaskDate.getDate() + TASK_CREATION_HORIZON_DAYS);
  if (checkoutDate > lastTaskDate) {
    return false;
  }
  
  return true;
}
