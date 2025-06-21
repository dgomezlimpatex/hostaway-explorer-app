
import { HostawayReservation } from './types.ts';

/**
 * Determines if a task should be created for a reservation based on its status
 */
export function shouldCreateTaskForReservation(reservation: HostawayReservation): boolean {
  const validStatuses = ['confirmed', 'new', 'modified'];
  const invalidStatuses = ['cancelled', 'inquiry', 'declined', 'expired'];
  
  // Verificar status
  const statusLower = reservation.status.toLowerCase();
  
  if (invalidStatuses.includes(statusLower)) {
    return false;
  }
  
  if (validStatuses.includes(statusLower)) {
    return true;
  }
  
  // IMPLEMENTADO: Política para awaiting_payment - crear tarea inmediatamente
  if (statusLower === 'awaiting_payment') {
    console.log(`✅ Reserva en awaiting_payment: ${reservation.id} - creando tarea inmediatamente (política definida)`);
    return true;
  }
  
  // Para otros statuses, asumir que sí se debe crear tarea (enfoque conservador)
  console.log(`⚠️ Status desconocido: ${reservation.status}, creando tarea por precaución`);
  return true;
}

/**
 * Explains why a task creation decision was made
 */
export function getTaskCreationReason(reservation: HostawayReservation): string {
  const statusLower = reservation.status.toLowerCase();
  
  if (statusLower === 'cancelled') {
    return 'Reserva cancelada';
  }
  if (statusLower === 'inquiry') {
    return 'Solo es una consulta, no una reserva confirmada';
  }
  if (statusLower === 'declined') {
    return 'Reserva rechazada';
  }
  if (statusLower === 'expired') {
    return 'Reserva expirada';
  }
  if (statusLower === 'awaiting_payment') {
    return 'Reserva pendiente de pago - se crea tarea inmediatamente (política aplicada)';
  }
  
  return 'Status válido para crear tarea';
}
