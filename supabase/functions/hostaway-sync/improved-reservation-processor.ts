
import { HostawayReservation, SyncStats } from './types.ts';
import { 
  findPropertyByHostawayId, 
  getExistingReservation,
  insertReservation,
  createTaskForReservation
} from './database-operations.ts';
import { DuplicatePreventionService } from './duplicate-prevention.ts';

export class ImprovedReservationProcessor {
  private duplicateChecker: DuplicatePreventionService;

  constructor(supabaseUrl: string, supabaseServiceKey: string) {
    this.duplicateChecker = new DuplicatePreventionService(supabaseUrl, supabaseServiceKey);
  }

  async processReservation(
    reservation: HostawayReservation, 
    stats: SyncStats,
    reservationIndex: number,
    totalReservations: number
  ): Promise<void> {
    console.log(`\n🔄 PROCESANDO RESERVA ${reservation.id} (${reservationIndex + 1}/${totalReservations})`);
    console.log(`   - Propiedad: ${reservation.listingName || 'N/A'} (ID: ${reservation.listingMapId})`);
    console.log(`   - Estado: ${reservation.status}`);
    console.log(`   - Check-out: ${reservation.departureDate}`);
    console.log(`   - Huésped: ${reservation.guestName}`);

    // Buscar la propiedad
    const property = await findPropertyByHostawayId(
      reservation.listingMapId, 
      reservation.listingName || undefined
    );
    
    if (!property) {
      const errorMsg = `Propiedad no encontrada: listingMapId ${reservation.listingMapId}, nombre: ${reservation.listingName || 'N/A'}`;
      console.warn(`⚠️ ${errorMsg}`);
      stats.errors.push(errorMsg);
      return;
    }

    console.log(`✅ Propiedad encontrada: ${property.nombre}`);

    // VERIFICACIÓN CRÍTICA: Comprobar duplicados ANTES de crear cualquier cosa
    const isDuplicate = await this.duplicateChecker.checkForExistingTask(
      reservation.id,
      property.nombre,
      reservation.departureDate
    );

    if (isDuplicate) {
      console.log(`🚫 RESERVA DUPLICADA - SALTANDO CREACIÓN`);
      return;
    }

    // Verificar si ya existe la reserva en nuestra base de datos
    const existingReservation = await getExistingReservation(reservation.id);

    if (existingReservation) {
      console.log(`📝 Reserva existente encontrada: ${existingReservation.id}`);
      await this.handleExistingReservation(reservation, existingReservation, property, stats);
    } else {
      console.log(`🆕 Nueva reserva - Creando tarea`);
      await this.handleNewReservation(reservation, property, stats);
    }

    stats.reservations_processed++;
  }

  private async handleNewReservation(
    reservation: HostawayReservation,
    property: any,
    stats: SyncStats
  ): Promise<void> {
    try {
      // Crear la tarea primero
      const task = await createTaskForReservation(reservation, property);
      console.log(`✅ Tarea creada: ${task.id}`);

      // Crear la reserva con referencia a la tarea
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
        task_id: task.id,
        last_sync_at: new Date().toISOString()
      };

      await insertReservation(reservationData);
      
      stats.new_reservations++;
      stats.tasks_created++;
      
      // Agregar detalles
      if (!stats.tasks_details) stats.tasks_details = [];
      if (!stats.reservations_details) stats.reservations_details = [];
      
      stats.tasks_details.push({
        reservation_id: reservation.id,
        property_name: property.nombre,
        task_id: task.id,
        task_date: reservation.departureDate,
        guest_name: reservation.guestName,
        listing_id: reservation.listingMapId,
        status: reservation.status
      });

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

      console.log(`✅ Nueva reserva y tarea creadas exitosamente`);

    } catch (error) {
      const errorMsg = `Error creando nueva reserva ${reservation.id}: ${error.message}`;
      console.error(`❌ ${errorMsg}`);
      stats.errors.push(errorMsg);
    }
  }

  private async handleExistingReservation(
    reservation: HostawayReservation,
    existingReservation: any,
    property: any,
    stats: SyncStats
  ): Promise<void> {
    // Verificar si hay cambios significativos
    const hasChanges = 
      existingReservation.status !== reservation.status ||
      existingReservation.departure_date !== reservation.departureDate ||
      existingReservation.arrival_date !== reservation.arrivalDate;

    if (hasChanges) {
      console.log(`📝 Actualizando reserva existente`);
      // Aquí podrías implementar la lógica de actualización
      stats.updated_reservations++;
    } else {
      console.log(`✅ Reserva sin cambios`);
    }
  }

  async runPreSyncCleanup(): Promise<void> {
    console.log(`🧹 EJECUTANDO LIMPIEZA PREVIA A LA SINCRONIZACIÓN...`);
    await this.duplicateChecker.cleanupExistingDuplicates();
  }

  async createMissingTaskForExistingReservation(
    reservation: HostawayReservation,
    property: any,
    stats: SyncStats
  ): Promise<string | null> {
    console.log(`📋 Creando tarea faltante para reserva existente: ${reservation.id}`);
    console.log(`📋 Propiedad: ${property.nombre}, Status: ${reservation.status}`);
    
    // Verificar si debe crear tarea
    const validStatuses = ['confirmed', 'new', 'modified', 'awaiting_payment'];
    const invalidStatuses = ['cancelled', 'inquiry', 'declined', 'expired'];
    
    const statusLower = reservation.status.toLowerCase();
    
    if (invalidStatuses.includes(statusLower)) {
      console.log(`⏭️ No se crea tarea para status: ${reservation.status}`);
      return null;
    }
    
    if (!validStatuses.includes(statusLower)) {
      console.log(`⚠️ Status desconocido: ${reservation.status}, creando tarea por precaución`);
    }

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
      
      console.log(`✅ Tarea faltante creada: ${task.id} para fecha: ${reservation.departureDate}`);
      return task.id;
    } catch (error) {
      const errorMsg = `Error creando tarea faltante para reserva ${reservation.id}: ${error.message}`;
      console.error(`❌ ${errorMsg}`);
      stats.errors.push(errorMsg);
      return null;
    }
  }
}
