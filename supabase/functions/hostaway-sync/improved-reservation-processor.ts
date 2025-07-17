
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
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

export class ImprovedReservationProcessor {
  private duplicateChecker: DuplicatePreventionService;
  private supabase;

  constructor(supabaseUrl: string, supabaseServiceKey: string) {
    this.duplicateChecker = new DuplicatePreventionService(supabaseUrl, supabaseServiceKey);
    // Crear cliente Supabase para operaciones directas
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
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

    // VERIFICACIÓN CRÍTICA: Si la reserva está cancelada, limpiar task_id ANTES de verificar duplicados
    const isCurrentlyCancelled = reservation.status === 'cancelled' || reservation.cancellationDate;
    
    if (isCurrentlyCancelled) {
      console.log(`🚫 RESERVA CANCELADA DETECTADA: ${reservation.id} - Verificando si tiene tarea asignada`);
      
      const existingReservation = await getExistingReservation(reservation.id);
      
      if (existingReservation && existingReservation.task_id) {
        console.log(`🗑️ ELIMINANDO TAREA DE RESERVA CANCELADA: ${existingReservation.task_id}`);
        
        try {
          const taskId = existingReservation.task_id;
          
          // PASO 1: Limpiar task_id de la reserva PRIMERO
          await this.supabase
            .from('hostaway_reservations')
            .update({ 
              task_id: null,
              status: reservation.status,
              cancellation_date: reservation.cancellationDate || null,
              last_sync_at: new Date().toISOString()
            })
            .eq('id', existingReservation.id);
            
          console.log(`✅ task_id limpiado de la reserva: ${reservation.id}`);
          
          // PASO 2: Verificar si otras reservas usan la misma tarea
          const { data: otherReservations, error: checkError } = await this.supabase
            .from('hostaway_reservations')
            .select('id')
            .eq('task_id', taskId);
            
          if (checkError) {
            console.error(`❌ Error verificando otras reservas:`, checkError);
          } else if (otherReservations && otherReservations.length === 0) {
            // PASO 3: Solo eliminar la tarea si no hay otras reservas usándola
            const { error: deleteError } = await this.supabase
              .from('tasks')
              .delete()
              .eq('id', taskId);
              
            if (deleteError) {
              console.error(`❌ Error eliminando tarea ${taskId}:`, deleteError);
              stats.errors.push(`Error eliminando tarea cancelada ${taskId}: ${deleteError.message}`);
            } else {
              console.log(`✅ Tarea eliminada: ${taskId}`);
            }
          } else {
            console.log(`⚠️ Tarea ${taskId} no eliminada - está siendo usada por ${otherReservations?.length || 0} otras reservas`);
          }
          
          stats.cancelled_reservations++;
          
          // Agregar detalles de cancelación
          if (!stats.reservations_details) stats.reservations_details = [];
          stats.reservations_details.push({
            reservation_id: reservation.id,
            property_name: property.nombre,
            guest_name: reservation.guestName,
            listing_id: reservation.listingMapId,
            status: reservation.status,
            arrival_date: reservation.arrivalDate,
            departure_date: reservation.departureDate,
            action: 'cancelled'
          });
          
          console.log(`✅ Reserva cancelada procesada correctamente: ${reservation.id}`);
        } catch (error) {
          console.error(`❌ Error procesando reserva cancelada ${reservation.id}:`, error);
          stats.errors.push(`Error procesando cancelación ${reservation.id}: ${error.message}`);
        }
      }
      
      // Para reservas canceladas, no crear nuevas tareas ni continuar procesando
      if (!existingReservation) {
        // Si es una nueva reserva cancelada, crearla sin tarea
        console.log(`📝 Creando nueva reserva cancelada sin tarea: ${reservation.id}`);
        
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
          task_id: null,
          last_sync_at: new Date().toISOString()
        };

        await insertReservation(reservationData);
        stats.cancelled_reservations++;
        
        // Agregar detalles de reserva cancelada
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
      }
      
      stats.reservations_processed++;
      return; // Salir temprano para reservas canceladas
    }

    // VERIFICACIÓN CRÍTICA: Comprobar duplicados SOLO para reservas NO canceladas
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
    // VERIFICACIÓN CRÍTICA: Si la reserva está cancelada pero tiene tarea, eliminarla
    const isCurrentlyCancelled = reservation.status === 'cancelled' || reservation.cancellationDate;
    
    if (isCurrentlyCancelled && existingReservation.task_id) {
      console.log(`🚫 DETECTADA RESERVA CANCELADA CON TAREA: ${reservation.id}`);
      console.log(`   - Status: ${reservation.status}`);
      console.log(`   - Cancellation Date: ${reservation.cancellationDate || 'NULL'}`);
      console.log(`   - Task ID a eliminar: ${existingReservation.task_id}`);
      
      // Eliminar la tarea incorrecta
      try {
        const { error: deleteError } = await this.supabase
          .from('tasks')
          .delete()
          .eq('id', existingReservation.task_id);
          
        if (deleteError) {
          console.error(`❌ Error eliminando tarea ${existingReservation.task_id}:`, deleteError);
          stats.errors.push(`Error eliminando tarea cancelada ${existingReservation.task_id}: ${deleteError.message}`);
        } else {
          console.log(`✅ Tarea cancelada eliminada: ${existingReservation.task_id}`);
          
          // Registrar la tarea eliminada en las estadísticas
          stats.tasks_deleted++;
          if (!stats.tasks_deleted_details) stats.tasks_deleted_details = [];
          stats.tasks_deleted_details.push({
            reservation_id: reservation.id,
            property_name: property.nombre,
            task_id: existingReservation.task_id,
            task_date: reservation.departureDate,
            guest_name: reservation.guestName,
            listing_id: reservation.listingMapId,
            status: reservation.status,
            action: 'deleted'
          });
          
          // Limpiar task_id de la reserva
          await this.supabase
            .from('hostaway_reservations')
            .update({ 
              task_id: null,
              status: reservation.status,
              cancellation_date: reservation.cancellationDate || null,
              last_sync_at: new Date().toISOString()
            })
            .eq('id', existingReservation.id);
            
          stats.cancelled_reservations++;
          
          // Agregar detalles de cancelación
          if (!stats.reservations_details) stats.reservations_details = [];
          stats.reservations_details.push({
            reservation_id: reservation.id,
            property_name: property.nombre,
            guest_name: reservation.guestName,
            listing_id: reservation.listingMapId,
            status: reservation.status,
            arrival_date: reservation.arrivalDate,
            departure_date: reservation.departureDate,
            action: 'cancelled'
          });
          
          console.log(`✅ Reserva cancelada procesada correctamente: ${reservation.id}`);
        }
      } catch (error) {
        console.error(`❌ Error procesando reserva cancelada ${reservation.id}:`, error);
        stats.errors.push(`Error procesando cancelación ${reservation.id}: ${error.message}`);
      }
      
      return; // Salir temprano, no procesar más cambios
    }

    // Crear datos de reserva actualizados para reservas NO canceladas
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
