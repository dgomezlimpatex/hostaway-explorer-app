import { AvantioReservation } from './types.ts';
import { envValue, resolveDaysAhead } from '../_shared/syncHorizon.ts';

export const DEFAULT_TASK_CREATION_HORIZON_DAYS = 30;
export const AVANTIO_TASK_HORIZON_ENV = 'AVANTIO_TASK_CREATION_HORIZON_DAYS';

/**
 * Días hacia el futuro en los que se crea la tarea de limpieza (una por
 * check-out). Se puede sobrescribir por invocación para los pases de más
 * alcance; sin valor, el comportamiento es el histórico (30 días).
 */
export function taskCreationHorizonDays(): number {
  return resolveDaysAhead(envValue(AVANTIO_TASK_HORIZON_ENV), DEFAULT_TASK_CREATION_HORIZON_DAYS);
}

/**
 * Determines if a task should be created for a reservation.
 * Creates tasks only for non-cancelled reservations whose checkout is inside
 * the operational sync horizon. Reservations arriving in that horizon may be
 * stored for future-entry display even when their checkout is later.
 */
export function shouldCreateTaskForReservation(
  reservation: AvantioReservation,
  horizonDays: number = taskCreationHorizonDays(),
): boolean {
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
  lastTaskDate.setDate(lastTaskDate.getDate() + horizonDays);
  if (checkoutDate > lastTaskDate) {
    return false;
  }
  
  return true;
}
