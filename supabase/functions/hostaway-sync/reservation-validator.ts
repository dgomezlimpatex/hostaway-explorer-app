
import { HostawayReservation } from './types.ts';

/**
 * Determines if a task should be created for a reservation based on its status
 */
export function shouldCreateTaskForReservation(reservation: HostawayReservation): boolean {
  console.log(`🔍 Evaluando si crear tarea para reserva ${reservation.id}: status="${reservation.status}", cancellationDate="${reservation.cancellationDate || 'NULL'}"`);
  
  // REGLA CRÍTICA HOSTAWAY: Solo 3 estados posibles: new, modified, cancelled
  const validHostawayStatuses = ['new', 'modified', 'cancelled'];
  const statusLower = reservation.status.toLowerCase();
  
  if (!validHostawayStatuses.includes(statusLower)) {
    console.log(`❌ ESTADO INVÁLIDO: ${reservation.id} tiene status desconocido: ${reservation.status}`);
    return false;
  }
  
  // REGLA 1: Si status es 'cancelled', NO crear tarea NUNCA
  if (statusLower === 'cancelled') {
    console.log(`❌ NO CREAR TAREA: Reserva ${reservation.id} status=cancelled`);
    return false;
  }
  
  // REGLA 2: Si tiene fecha de cancelación, NO crear tarea NUNCA (independientemente del status)
  if (reservation.cancellationDate) {
    console.log(`❌ NO CREAR TAREA: Reserva ${reservation.id} tiene cancellation_date: ${reservation.cancellationDate}`);
    console.log(`❌ Status actual: ${reservation.status} - IGNORADO, cancellation_date prevalece`);
    return false;
  }
  
  // REGLA 3: Solo 'new' y 'modified' CREAN tareas
  if (statusLower === 'new') {
    console.log(`✅ CREAR TAREA: Reserva ${reservation.id} status=new`);
    return true;
  }
  
  if (statusLower === 'modified') {
    console.log(`✅ CREAR TAREA: Reserva ${reservation.id} status=modified`);
    return true;
  }
  
  // Solo debería llegar aquí si hay un error en la lógica anterior
  console.log(`❌ ERROR LÓGICO: Llegó al final con status inesperado: ${reservation.status}`);
  return false;
}

/**
 * Explains why a task creation decision was made
 */
export function getTaskCreationReason(reservation: HostawayReservation): string {
  // PRIMERA PRIORIDAD: Verificar fecha de cancelación
  if (reservation.cancellationDate) {
    return `Reserva cancelada (fecha de cancelación: ${reservation.cancellationDate})`;
  }
  
  const statusLower = reservation.status.toLowerCase();
  
  // Verificar cancelación por status
  if (statusLower === 'cancelled') {
    return 'Reserva cancelada (status: cancelled)';
  }
  
  // Estados válidos que crean tareas
  if (statusLower === 'new') {
    return 'Reserva nueva - se crea tarea';
  }
  
  if (statusLower === 'modified') {
    return 'Reserva modificada - se crea tarea';
  }
  
  // Estados inválidos de Hostaway
  const validHostawayStatuses = ['new', 'modified', 'cancelled'];
  if (!validHostawayStatuses.includes(statusLower)) {
    return `Estado desconocido de Hostaway: ${reservation.status}`;
  }
  
  return 'Status procesado correctamente';
}
