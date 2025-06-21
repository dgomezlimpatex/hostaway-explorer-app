import { HostawayReservation, SyncStats, TaskDetail, ReservationDetail } from './types.ts';
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

  // MEJORADO: Buscar la propiedad con fallback por nombre
  const property = await findPropertyByHostawayId(
    reservation.listingMapId, 
    reservation.listingName || undefined
  );
  
  if (!property) {
    const errorMsg = `Propiedad no encontrada para listingMapId: ${reservation.listingMapId}, nombre: ${reservation.listingName || 'N/A'} (Reserva: ${reservation.id}, Huésped: ${reservation.guestName})`;
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

  // Inicializar arrays si no existen
  if (!stats.tasks_details) stats.tasks_details = [];
  if (!stats.reservations_details) stats.reservations_details = [];

  if (!existingReservation) {
    // Nueva reserva
    console.log(`🆕 Nueva reserva encontrada: ${reservation.id}`);
    
    let taskId = null;
    
    // MEJORADO: Determinar si debe crear tarea con lógica más robusta
    const shouldCreateTask = shouldCreateTaskForReservation(reservation);
    
    console.log(`📋 ¿Crear tarea? Status: ${reservation.status}, válido: ${shouldCreateTask}`);
    console.log(`📋 Motivo: ${getTaskCreationReason(reservation)}`);
    
    if (shouldCreateTask) {
      console.log(`📋 Creando tarea para reserva activa (status: ${reservation.status})...`);
      console.log(`📋 Fecha de la tarea: ${reservation.departureDate} (departure date)`);
      
      try {
        const task = await createTaskForReservation(reservation, property);
        taskId = task.id;
        stats.tasks_created++;
        
        // Agregar detalles de la tarea creada
        stats.tasks_details.push({
          reservation_id: reservation.id,
          property_name: property.nombre,
          task_id: task.id,
          task_date: reservation.departureDate,
          guest_name: reservation.guestName,
          listing_id: reservation.listingMapId,
          status: reservation.status
        });
        
        console.log(`✅ Tarea creada con ID: ${taskId} para fecha: ${reservation.departureDate}`);
        console.log(`✅ Detalles de la tarea: ${task.property} - ${task.start_time} a ${task.end_time}`);
      } catch (error) {
        const errorMsg = `Error creando tarea para reserva ${reservation.id} (${property.nombre}, ${reservation.guestName}): ${error.message}`;
        console.error(`❌ ${errorMsg}`);
        stats.errors.push(errorMsg);
      }
    } else {
      console.log(`⏭️ No se crea tarea para reserva: ${getTaskCreationReason(reservation)}`);
    }

    try {
      await insertReservation({
        ...reservationData,
        task_id: taskId
      });
      stats.new_reservations++;
      
      // Agregar detalles de la reserva
      stats.reservations_details.push({
        reservation_id: reservation.id,
        property_name: property.nombre,
        guest_name: reservation.guestName,
        listing_id: reservation.listingMapId,
        status: reservation.status,
        arrival_date: reservation.arrivalDate,
        departure_date: reservation.departureDate,
        action: 'created'
      });
      
      console.log(`📝 Nueva reserva guardada en BD: ${reservation.id}, task_id: ${taskId}`);
    } catch (error) {
      const errorMsg = `Error insertando reserva ${reservation.id}: ${error.message}`;
      console.error(`❌ ${errorMsg}`);
      stats.errors.push(errorMsg);
    }
  } else {
    // Reserva existente - verificar cambios
    const hasChanges = 
      existingReservation.status !== reservation.status ||
      existingReservation.departure_date !== reservation.departureDate ||
      existingReservation.arrival_date !== reservation.arrivalDate ||
      existingReservation.cancellation_date !== (reservation.cancellationDate || null);

    if (hasChanges) {
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
          stats.errors.push(`Error enviando email de cancelación para ${reservation.id}: ${error.message}`);
        }
      } else if (shouldCreateTaskForReservation(reservation) && existingReservation.status === 'cancelled') {
        // Reserva reactivada - crear nueva tarea
        console.log(`🔄 Reserva reactivada: ${reservation.id}`);
        try {
          const task = await createTaskForReservation(reservation, property);
          reservationData.task_id = task.id;
          stats.tasks_created++;
          
          // Agregar detalles de la tarea creada
          stats.tasks_details.push({
            reservation_id: reservation.id,
            property_name: property.nombre,
            task_id: task.id,
            task_date: reservation.departureDate,
            guest_name: reservation.guestName,
            listing_id: reservation.listingMapId,
            status: reservation.status
          });
          
          console.log(`✅ Nueva tarea creada para reserva reactivada: ${task.id}`);
        } catch (error) {
          console.error(`Error creando tarea para reserva reactivada:`, error);
          stats.errors.push(`Error creando tarea para reserva reactivada ${reservation.id}: ${error.message}`);
        }
      } else if (shouldCreateTaskForReservation(reservation) && !existingReservation.task_id) {
        // Reserva que debería tener tarea pero no la tiene
        console.log(`🔄 Creando tarea faltante para reserva: ${reservation.id}`);
        try {
          const task = await createTaskForReservation(reservation, property);
          reservationData.task_id = task.id;
          stats.tasks_created++;
          
          // Agregar detalles de la tarea creada
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
        } catch (error) {
          console.error(`Error creando tarea faltante:`, error);
          stats.errors.push(`Error creando tarea faltante para ${reservation.id}: ${error.message}`);
        }
      } else if (existingReservation.task_id && (reservation.departureDate !== existingReservation.departure_date || reservation.arrivalDate !== existingReservation.arrival_date)) {
        // Fechas cambiaron - actualizar tarea existente
        console.log(`📅 Fechas cambiaron, actualizando tarea: ${existingReservation.task_id}`);
        // Aquí podrías implementar lógica para actualizar la fecha de la tarea si es necesario
      }

      // Actualizar reserva con validación de integridad
      try {
        await updateReservation(existingReservation.id, reservationData);
        stats.updated_reservations++;
        
        // Agregar detalles de la reserva actualizada
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
    } else {
      console.log(`✅ No hay cambios en reserva: ${reservation.id}`);
      
      // Verificar si debería tener tarea pero no la tiene
      if (shouldCreateTaskForReservation(reservation) && !existingReservation.task_id) {
        console.log(`🔍 Detectada reserva sin tarea que debería tenerla: ${reservation.id}`);
        try {
          const task = await createTaskForReservation(reservation, property);
          const updateData = { ...reservationData, task_id: task.id };
          await updateReservation(existingReservation.id, updateData);
          stats.tasks_created++;
          
          // Agregar detalles de la tarea creada
          stats.tasks_details.push({
            reservation_id: reservation.id,
            property_name: property.nombre,
            task_id: task.id,
            task_date: reservation.departureDate,
            guest_name: reservation.guestName,
            listing_id: reservation.listingMapId,
            status: reservation.status
          });
          
          console.log(`✅ Tarea faltante creada y reserva actualizada: ${task.id}`);
        } catch (error) {
          console.error(`Error creando tarea faltante para reserva existente:`, error);
          stats.errors.push(`Error creando tarea faltante para ${reservation.id}: ${error.message}`);
        }
      }
    }
  }
}

// MEJORADO: Nueva función para determinar si se debe crear una tarea
function shouldCreateTaskForReservation(reservation: HostawayReservation): boolean {
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

// MEJORADO: Nueva función para explicar por qué no se crea una tarea
function getTaskCreationReason(reservation: HostawayReservation): string {
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
