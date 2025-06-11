
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
    
    // Determinar si debe crear tarea basándose en el status y fechas
    const shouldCreateTask = reservation.status.toLowerCase() !== 'cancelled' && 
                           reservation.status.toLowerCase() !== 'inquiry' &&
                           reservation.status.toLowerCase() !== 'declined';
    
    console.log(`📋 ¿Crear tarea? Status: ${reservation.status}, válido: ${shouldCreateTask}`);
    
    if (shouldCreateTask) {
      console.log(`📋 Creando tarea para reserva activa (status: ${reservation.status})...`);
      console.log(`📋 Fecha de salida (para la tarea): ${reservation.departureDate}`);
      
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
      console.log(`⏭️ No se crea tarea para reserva con status: ${reservation.status}`);
    }

    await insertReservation({
      ...reservationData,
      task_id: taskId
    });

    stats.new_reservations++;
    console.log(`📝 Nueva reserva guardada en BD: ${reservation.id}, task_id: ${taskId}`);
  } else {
    // Reserva existente - verificar cambios
    const hasChanges = 
      existingReservation.status !== reservation.status ||
      existingReservation.departure_date !== reservation.departureDate ||
      existingReservation.cancellation_date !== (reservation.cancellationDate || null);

    if (hasChanges) {
      console.log(`🔄 Cambios detectados en reserva: ${reservation.id}`);
      console.log(`   - Status anterior: ${existingReservation.status} -> nuevo: ${reservation.status}`);
      console.log(`   - Fecha salida anterior: ${existingReservation.departure_date} -> nueva: ${reservation.departureDate}`);

      // Verificar si fue cancelada
      if (reservation.status === 'cancelled' && existingReservation.status !== 'cancelled') {
        console.log(`❌ Reserva cancelada: ${reservation.id}`);
        stats.cancelled_reservations++;

        // Eliminar tarea asociada si existe
        if (existingReservation.task_id) {
          try {
            await deleteTask(existingReservation.task_id);
            console.log(`🗑️ Tarea eliminada: ${existingReservation.task_id}`);
          } catch (error) {
            console.error(`Error eliminando tarea ${existingReservation.task_id}:`, error);
          }
        }

        // Enviar email de cancelación
        try {
          await sendCancellationEmail(reservation, property);
        } catch (error) {
          console.error('Error enviando email de cancelación:', error);
          stats.errors.push(`Error enviando email de cancelación: ${error.message}`);
        }
      } else if (reservation.status !== 'cancelled' && existingReservation.status === 'cancelled') {
        // Reserva reactivada - crear nueva tarea
        console.log(`🔄 Reserva reactivada: ${reservation.id}`);
        try {
          const task = await createTaskForReservation(reservation, property);
          reservationData.task_id = task.id;
          stats.tasks_created++;
          console.log(`✅ Nueva tarea creada para reserva reactivada: ${task.id}`);
        } catch (error) {
          console.error(`Error creando tarea para reserva reactivada:`, error);
          stats.errors.push(`Error creando tarea para reserva reactivada: ${error.message}`);
        }
      }

      // Actualizar reserva
      await updateReservation(existingReservation.id, reservationData);
      stats.updated_reservations++;
      console.log(`📝 Reserva actualizada en BD: ${reservation.id}`);
    } else {
      console.log(`✅ No hay cambios en reserva: ${reservation.id}`);
    }
  }
}
