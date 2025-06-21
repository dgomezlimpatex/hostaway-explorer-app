
import { HostawayReservation, SyncStats, TaskDetail } from './types.ts';
import { createTaskForReservation, deleteTask } from './database-operations.ts';
import { shouldCreateTaskForReservation, getTaskCreationReason } from './reservation-validator.ts';

/**
 * Creates a task for a new reservation if conditions are met
 */
export async function handleNewReservationTask(
  reservation: HostawayReservation,
  property: any,
  stats: SyncStats
): Promise<string | null> {
  const shouldCreateTask = shouldCreateTaskForReservation(reservation);
  
  console.log(`📋 ¿Crear tarea? Status: ${reservation.status}, válido: ${shouldCreateTask}`);
  console.log(`📋 Motivo: ${getTaskCreationReason(reservation)}`);
  
  if (!shouldCreateTask) {
    console.log(`⏭️ No se crea tarea para reserva: ${getTaskCreationReason(reservation)}`);
    return null;
  }

  console.log(`📋 Creando tarea para reserva activa (status: ${reservation.status})...`);
  console.log(`📋 Fecha de la tarea: ${reservation.departureDate} (departure date)`);
  
  try {
    const task = await createTaskForReservation(reservation, property);
    stats.tasks_created++;
    
    // Agregar detalles de la tarea creada
    if (!stats.tasks_details) stats.tasks_details = [];
    stats.tasks_details.push({
      reservation_id: reservation.id,
      property_name: property.nombre,
      task_id: task.id,
      task_date: reservation.departureDate,
      guest_name: reservation.guestName,
      listing_id: reservation.listingMapId,
      status: reservation.status
    });
    
    console.log(`✅ Tarea creada con ID: ${task.id} para fecha: ${reservation.departureDate}`);
    console.log(`✅ Detalles de la tarea: ${task.property} - ${task.start_time} a ${task.end_time}`);
    return task.id;
  } catch (error) {
    const errorMsg = `Error creando tarea para reserva ${reservation.id} (${property.nombre}, ${reservation.guestName}): ${error.message}`;
    console.error(`❌ ${errorMsg}`);
    stats.errors.push(errorMsg);
    return null;
  }
}

/**
 * Handles task deletion for cancelled reservations
 */
export async function handleCancelledReservationTask(
  existingReservation: any,
  stats: SyncStats
): Promise<void> {
  if (existingReservation.task_id) {
    try {
      await deleteTask(existingReservation.task_id);
      console.log(`🗑️ Tarea eliminada: ${existingReservation.task_id}`);
    } catch (error) {
      console.error(`Error eliminando tarea ${existingReservation.task_id}:`, error);
    }
  }
}

/**
 * Creates a missing task for an existing reservation
 */
export async function createMissingTask(
  reservation: HostawayReservation,
  property: any,
  stats: SyncStats
): Promise<string | null> {
  if (!shouldCreateTaskForReservation(reservation)) {
    return null;
  }

  console.log(`🔄 Creando tarea faltante para reserva: ${reservation.id}`);
  try {
    const task = await createTaskForReservation(reservation, property);
    stats.tasks_created++;
    
    // Agregar detalles de la tarea creada
    if (!stats.tasks_details) stats.tasks_details = [];
    stats.tasks_details.push({
      reservation_id: reservation.id,
      property_name: property.nombre,
      task_id: task.id,
      task_date: reservation.departureDate,
      guest_name: reservation.guestName,
      listing_id: reservation.listingMapId,
      status: reservation.status
    });
    
    console.log(`✅ Tarea faltante creada: ${task.id}`);
    return task.id;
  } catch (error) {
    console.error(`Error creando tarea faltante:`, error);
    stats.errors.push(`Error creando tarea faltante para ${reservation.id}: ${error.message}`);
    return null;
  }
}
