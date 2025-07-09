
import { HostawayReservation, SyncStats, ReservationDetail } from './types.ts';
import { updateReservation, updateTaskDate } from './database-operations.ts';
import { sendCancellationEmail } from './email-service.ts';
import { handleCancelledReservationTask, createMissingTask } from './task-service.ts';

/**
 * Handles status changes for existing reservations
 */
export async function handleReservationStatusChange(
  reservation: HostawayReservation,
  existingReservation: any,
  property: any,
  reservationData: any,
  stats: SyncStats
): Promise<void> {
  console.log(`🔄 Cambios detectados en reserva: ${reservation.id}`);
  console.log(`   - Status anterior: ${existingReservation.status} -> nuevo: ${reservation.status}`);
  console.log(`   - Fecha llegada anterior: ${existingReservation.arrival_date} -> nueva: ${reservation.arrivalDate}`);
  console.log(`   - Fecha salida anterior: ${existingReservation.departure_date} -> nueva: ${reservation.departureDate}`);

  let action: 'updated' | 'cancelled' = 'updated';

  // Verificar si fue cancelada
  if (reservation.status === 'cancelled' && existingReservation.status !== 'cancelled') {
    console.log(`❌ Reserva cancelada: ${reservation.id}`);
    stats.cancelled_reservations++;
    action = 'cancelled';

    // Eliminar tarea asociada si existe
    await handleCancelledReservationTask(existingReservation, stats);

    // Enviar email de cancelación
    try {
      await sendCancellationEmail(reservation, property);
    } catch (error) {
      console.error('Error enviando email de cancelación:', error);
      stats.errors.push(`Error enviando email de cancelación para ${reservation.id}: ${error.message}`);
    }
  } else {
    // Manejar otros cambios de estado
    const taskId = await handleOtherStatusChanges(
      reservation, 
      existingReservation, 
      property, 
      reservationData, 
      stats
    );
    if (taskId) {
      reservationData.task_id = taskId;
    }
  }

  // Actualizar reserva con validación de integridad
  try {
    await updateReservation(existingReservation.id, reservationData);
    stats.updated_reservations++;
    
    // Agregar detalles de la reserva actualizada
    if (!stats.reservations_details) stats.reservations_details = [];
    stats.reservations_details.push({
      reservation_id: reservation.id,
      property_name: property.nombre,
      guest_name: reservation.guestName,
      listing_id: reservation.listingMapId,
      status: reservation.status,
      arrival_date: reservation.arrivalDate,
      departure_date: reservation.departureDate,
      action
    });
    
    console.log(`📝 Reserva actualizada en BD: ${reservation.id}`);
  } catch (error) {
    const errorMsg = `Error actualizando reserva ${reservation.id}: ${error.message}`;
    console.error(`❌ ${errorMsg}`);
    stats.errors.push(errorMsg);
  }
}

/**
 * Handles other status changes (reactivation, missing tasks, etc.)
 */
async function handleOtherStatusChanges(
  reservation: HostawayReservation,
  existingReservation: any,
  property: any,
  reservationData: any,
  stats: SyncStats
): Promise<string | null> {
  // Reserva reactivada - crear nueva tarea
  if (existingReservation.status === 'cancelled') {
    console.log(`🔄 Reserva reactivada: ${reservation.id}`);
    return await createMissingTask(reservation, property, stats);
  }
  
  // Reserva que debería tener tarea pero no la tiene
  if (!existingReservation.task_id) {
    console.log(`🔄 Creando tarea faltante para reserva: ${reservation.id}`);
    return await createMissingTask(reservation, property, stats);
  }
  
  // Fechas cambiaron - actualizar tarea existente
  if (existingReservation.task_id && 
      (reservation.departureDate !== existingReservation.departure_date || 
       reservation.arrivalDate !== existingReservation.arrival_date)) {
    console.log(`📅 Fechas cambiaron, actualizando tarea: ${existingReservation.task_id}`);
    console.log(`📅 Fecha anterior: ${existingReservation.departure_date} -> Nueva fecha: ${reservation.departureDate}`);
    
    try {
      await updateTaskDate(existingReservation.task_id, reservation.departureDate);
      console.log(`✅ Tarea ${existingReservation.task_id} actualizada con nueva fecha: ${reservation.departureDate}`);
    } catch (error) {
      console.error(`❌ Error actualizando fecha de tarea ${existingReservation.task_id}:`, error);
      stats.errors.push(`Error actualizando fecha de tarea ${existingReservation.task_id}: ${error.message}`);
    }
  }

  return null;
}

/**
 * Handles reservations without changes but might need missing tasks
 */
export async function handleUnchangedReservation(
  reservation: HostawayReservation,
  existingReservation: any,
  property: any,
  reservationData: any,
  stats: SyncStats
): Promise<void> {
  console.log(`✅ No hay cambios en reserva: ${reservation.id}`);
  
  // Verificar si debería tener tarea pero no la tiene
  const taskId = await createMissingTask(reservation, property, stats);
  if (taskId) {
    const updateData = { ...reservationData, task_id: taskId };
    try {
      await updateReservation(existingReservation.id, updateData);
      console.log(`✅ Tarea faltante creada y reserva actualizada: ${taskId}`);
    } catch (error) {
      console.error(`Error creando tarea faltante para reserva existente:`, error);
      stats.errors.push(`Error creando tarea faltante para ${reservation.id}: ${error.message}`);
    }
  }
}
