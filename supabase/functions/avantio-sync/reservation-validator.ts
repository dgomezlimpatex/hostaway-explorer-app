import { AvantioReservation } from './types.ts';

/**
 * Determina si se debe crear una tarea para una reserva
 * Criterios:
 * - Estado confirmed o pending (no cancelled)
 * - Sin fecha de cancelación
 * - Fecha de checkout dentro de los próximos 30 días
 */
export function shouldCreateTaskForReservation(reservation: AvantioReservation): boolean {
  console.log(`🔍 Evaluando si crear tarea para reserva ${reservation.id}: status="${reservation.status}", cancellationDate="${reservation.cancellationDate || 'NULL'}"`);
  
  const statusLower = reservation.status.toLowerCase();
  
  // REGLA 1: Si está cancelada, NO crear tarea
  if (statusLower === 'cancelled' || statusLower === 'canceled') {
    console.log(`❌ NO CREAR TAREA: Reserva ${reservation.id} status=cancelled`);
    return false;
  }
  
  // REGLA 2: Si tiene fecha de cancelación, NO crear tarea
  if (reservation.cancellationDate) {
    console.log(`❌ NO CREAR TAREA: Reserva ${reservation.id} tiene cancellation_date: ${reservation.cancellationDate}`);
    return false;
  }
  
  // REGLA 3: Verificar que la fecha de checkout está en el futuro
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkoutDate = new Date(reservation.departureDate);
  
  if (checkoutDate < today) {
    console.log(`❌ NO CREAR TAREA: Reserva ${reservation.id} tiene checkout en el pasado: ${reservation.departureDate}`);
    return false;
  }
  
  // REGLA 4: Estados válidos que crean tareas
  const validStatuses = ['confirmed', 'pending', 'new', 'modified', 'checked_in'];
  if (validStatuses.includes(statusLower)) {
    console.log(`✅ CREAR TAREA: Reserva ${reservation.id} status=${reservation.status}`);
    return true;
  }
  
  console.log(`⚠️ Estado desconocido: ${reservation.status} - creando tarea por defecto`);
  return true;
}

/**
 * Explica por qué se tomó la decisión de crear/no crear tarea
 */
export function getTaskCreationReason(reservation: AvantioReservation): string {
  // Verificar fecha de cancelación primero
  if (reservation.cancellationDate) {
    return `Reserva cancelada (fecha de cancelación: ${reservation.cancellationDate})`;
  }
  
  const statusLower = reservation.status.toLowerCase();
  
  if (statusLower === 'cancelled' || statusLower === 'canceled') {
    return 'Reserva cancelada (status: cancelled)';
  }
  
  // Verificar fecha de checkout
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkoutDate = new Date(reservation.departureDate);
  
  if (checkoutDate < today) {
    return `Checkout en el pasado (${reservation.departureDate})`;
  }
  
  const validStatuses = ['confirmed', 'pending', 'new', 'modified', 'checked_in'];
  if (validStatuses.includes(statusLower)) {
    return `Reserva ${reservation.status} - se crea tarea de limpieza`;
  }
  
  return `Estado procesado: ${reservation.status}`;
}
