
import { HostawayReservation, SyncStats } from './types.ts';
import { 
  findPropertyByHostawayId, 
  getExistingReservation,
  insertReservation,
  createTaskForReservation
} from './database-operations.ts';
import { shouldCreateTaskForReservation, getTaskCreationReason } from './reservation-validator.ts';
import { handleReservationStatusChange, handleUnchangedReservation } from './reservation-status-handler.ts';
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
      // VALIDACIÓN CRÍTICA: Verificar si debe crear tarea
      const shouldCreateTask = shouldCreateTaskForReservation(reservation);
      console.log(`🔍 ¿Crear tarea para reserva ${reservation.id}? ${shouldCreateTask}`);
      console.log(`📋 Motivo: ${getTaskCreationReason(reservation)}`);
      
      let taskId = null;
      
      if (shouldCreateTask) {
        // Crear la tarea solo si pasa la validación
        const task = await createTaskForReservation(reservation, property);
        taskId = task.id;
        stats.tasks_created++;
        console.log(`✅ Tarea creada: ${task.id}`);
        
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
      } else {
        console.log(`⏭️ NO se crea tarea: ${getTaskCreationReason(reservation)}`);
      }

      // Crear la reserva con referencia a la tarea (o sin tarea si es cancelada)
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
        task_id: taskId, // Puede ser null para reservas canceladas
        last_sync_at: new Date().toISOString()
      };

      await insertReservation(reservationData);
      
      stats.new_reservations++;
      
      // Agregar detalles de reserva
      if (!stats.reservations_details) stats.reservations_details = [];

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

      if (taskId) {
        console.log(`✅ Nueva reserva y tarea creadas exitosamente`);
      } else {
        console.log(`✅ Nueva reserva creada (sin tarea por estado: ${reservation.status})`);
      }

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
    // Crear datos de reserva actualizados
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

    // Verificar si hay cambios significativos
    const hasChanges = 
      existingReservation.status !== reservation.status ||
      existingReservation.departure_date !== reservation.departureDate ||
      existingReservation.arrival_date !== reservation.arrivalDate ||
      existingReservation.cancellation_date !== (reservation.cancellationDate || null);

    if (hasChanges) {
      console.log(`📝 Cambios detectados - usando handleReservationStatusChange`);
      await handleReservationStatusChange(
        reservation, 
        existingReservation, 
        property, 
        reservationData, 
        stats
      );
    } else {
      console.log(`✅ Sin cambios - usando handleUnchangedReservation`);
      await handleUnchangedReservation(
        reservation, 
        existingReservation, 
        property, 
        reservationData, 
        stats
      );
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
    console.log(`📋 Evaluando tarea faltante para reserva existente: ${reservation.id}`);
    console.log(`📋 Propiedad: ${property.nombre}, Status: ${reservation.status}`);
    
    // USAR LA VALIDACIÓN CORRECTA Y COMPLETA
    const shouldCreateTask = shouldCreateTaskForReservation(reservation);
    console.log(`🔍 ¿Crear tarea faltante? ${shouldCreateTask}`);
    console.log(`📋 Motivo: ${getTaskCreationReason(reservation)}`);
    
    if (!shouldCreateTask) {
      console.log(`⏭️ No se crea tarea: ${getTaskCreationReason(reservation)}`);
      return null;
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
