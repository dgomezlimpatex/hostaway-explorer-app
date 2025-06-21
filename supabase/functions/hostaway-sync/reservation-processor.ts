
import { HostawayReservation, SyncStats, ReservationDetail } from './types.ts';
import { 
  findPropertyByHostawayId, 
  getExistingReservation,
  insertReservation
} from './database-operations.ts';
import { handleNewReservationTask } from './task-service.ts';
import { handleReservationStatusChange, handleUnchangedReservation } from './reservation-status-handler.ts';

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
    await handleNewReservation(reservation, property, reservationData, stats);
  } else {
    await handleExistingReservation(reservation, existingReservation, property, reservationData, stats);
  }
}

/**
 * Handles processing of new reservations
 */
async function handleNewReservation(
  reservation: HostawayReservation,
  property: any,
  reservationData: any,
  stats: SyncStats
): Promise<void> {
  console.log(`🆕 Nueva reserva encontrada: ${reservation.id}`);
  
  // Crear tarea si es necesario
  const taskId = await handleNewReservationTask(reservation, property, stats);

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
}

/**
 * Handles processing of existing reservations
 */
async function handleExistingReservation(
  reservation: HostawayReservation,
  existingReservation: any,
  property: any,
  reservationData: any,
  stats: SyncStats
): Promise<void> {
  // Verificar cambios
  const hasChanges = 
    existingReservation.status !== reservation.status ||
    existingReservation.departure_date !== reservation.departureDate ||
    existingReservation.arrival_date !== reservation.arrivalDate ||
    existingReservation.cancellation_date !== (reservation.cancellationDate || null);

  if (hasChanges) {
    await handleReservationStatusChange(
      reservation, 
      existingReservation, 
      property, 
      reservationData, 
      stats
    );
  } else {
    await handleUnchangedReservation(
      reservation, 
      existingReservation, 
      property, 
      reservationData, 
      stats
    );
  }
}
