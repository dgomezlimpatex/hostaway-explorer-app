
import { HostawayReservation, SyncStats } from './types.ts';
import { 
  findPropertyByHostawayId, 
  createTaskForReservation, 
  getExistingReservation,
  insertReservation,
  updateReservation,
  deleteTask
} from './database-operations.ts';
import { sendCancellationEmail } from './email-service.ts';

export async function processReservation(
  reservation: HostawayReservation, 
  stats: SyncStats,
  reservationIndex: number,
  totalReservations: number
) {
  console.log(`\n🔄 Procesando reserva ${reservation.id} (${reservationIndex + 1}/${totalReservations})`);
  console.log(`   - listingMapId: ${reservation.listingMapId}`);
  console.log(`   - Status: ${reservation.status}`);
  console.log(`   - Arrival: ${reservation.arrivalDate}`);
  console.log(`   - Departure: ${reservation.departureDate}`);
  console.log(`   - Guest: ${reservation.guestName}`);

  // Buscar si ya existe esta reserva
  const existingReservation = await getExistingReservation(reservation.id);

  // Buscar la propiedad correspondiente
  const property = await findPropertyByHostawayId(reservation.listingMapId);
  
  if (!property) {
    const errorMsg = `Propiedad no encontrada para listingMapId: ${reservation.listingMapId}`;
    console.warn(`⚠️ ${errorMsg}`);
    stats.errors.push(errorMsg);
    return;
  }

  console.log(`✅ Propiedad encontrada: ${property.nombre} (hostaway_listing_id: ${property.hostaway_listing_id})`);

  const reservationData = {
    hostaway_reservation_id: reservation.id,
    property_id: property.id,
    cliente_id: property.cliente_id,
    arrival_date: reservation.arrivalDate,
    departure_date: reservation.departureDate,
    reservation_date: reservation.reservationDate,
    cancellation_date: reservation.cancellationDate || null,
    nights: reservation.nights,
    status: reservation.status,
    adults: reservation.adults,
    last_sync_at: new Date().toISOString()
  };

  if (!existingReservation) {
    // Nueva reserva
    console.log(`🆕 Nueva reserva encontrada: ${reservation.id}`);
    
    let taskId = null;
    
    // Solo crear tarea si la reserva está activa
    const validStatusesForTasks = ['confirmed', 'new', 'modified', 'awaiting_payment'];
    const shouldCreateTask = validStatusesForTasks.includes(reservation.status.toLowerCase());
    
    console.log(`📋 ¿Crear tarea? Status: ${reservation.status}, válido: ${shouldCreateTask}`);
    
    if (shouldCreateTask) {
      console.log(`📋 Creando tarea para reserva activa (status: ${reservation.status})...`);
      try {
        const task = await createTaskForReservation(reservation, property);
        taskId = task.id;
        stats.tasks_created++;
        console.log(`✅ Tarea creada con ID: ${taskId} para fecha: ${reservation.departureDate}`);
      } catch (error) {
        const errorMsg = `Error creando tarea para reserva ${reservation.id}: ${error.message}`;
        console.error(`❌ ${errorMsg}`);
        stats.errors.push(errorMsg);
      }
    } else {
      console.log(`⏭️ Saltando creación de tarea para reserva ${reservation.status}`);
    }

    await insertReservation({
      ...reservationData,
      task_id: taskId
    });

    stats.new_reservations++;
  } else {
    // Reserva existente - verificar cambios
    const hasChanges = 
      existingReservation.status !== reservation.status ||
      existingReservation.departure_date !== reservation.departureDate ||
      existingReservation.cancellation_date !== (reservation.cancellationDate || null);

    if (hasChanges) {
      console.log(`🔄 Cambios detectados en reserva: ${reservation.id}`);

      // Verificar si fue cancelada
      if (reservation.status === 'cancelled' && existingReservation.status !== 'cancelled') {
        console.log(`❌ Reserva cancelada: ${reservation.id}`);
        stats.cancelled_reservations++;

        // Eliminar tarea asociada si existe
        if (existingReservation.task_id) {
          await deleteTask(existingReservation.task_id);
          console.log(`🗑️ Tarea eliminada: ${existingReservation.task_id}`);
        }

        // Enviar email de cancelación
        try {
          await sendCancellationEmail(reservation, property);
        } catch (error) {
          console.error('Error enviando email de cancelación:', error);
          stats.errors.push(`Error enviando email de cancelación: ${error.message}`);
        }
      }

      // Actualizar reserva
      await updateReservation(existingReservation.id, reservationData);
      stats.updated_reservations++;
    }
  }
}
