import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { AvantioReservation, SyncStats } from './types.ts';
import { 
  findPropertyByAvantioId, 
  getExistingReservation,
  insertReservation,
  createTaskForReservation,
  updateReservation,
  deleteTask,
  updateTaskDate,
  updateTaskPropertyName,
  getTaskPropertyName,
  logSyncError
} from './database-operations.ts';
import { shouldCreateTaskForReservation } from './reservation-validator.ts';

export class ReservationProcessor {
  private supabase;

  constructor(supabaseUrl: string, supabaseServiceKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  async processReservation(
    reservation: AvantioReservation, 
    stats: SyncStats,
    reservationIndex: number,
    totalReservations: number,
    syncLogId?: string | null
  ): Promise<void> {
    console.log(`\n🔄 PROCESANDO RESERVA ${reservation.id} (${reservationIndex + 1}/${totalReservations})`);
    console.log(`   - Alojamiento: ${reservation.accommodationName || 'N/A'} (ID: ${reservation.accommodationId})`);
    console.log(`   - Estado: ${reservation.status}`);
    console.log(`   - Check-out: ${reservation.departureDate}`);
    console.log(`   - Huésped: ${reservation.guestName}`);

    // Find property (exact match, Turquoise only)
    const property = await findPropertyByAvantioId(
      reservation.accommodationId, 
      reservation.accommodationName,
      reservation.accommodationInternalName
    );
    
    if (!property) {
      const errorMsg = `Propiedad no encontrada: nombre="${reservation.accommodationName || 'N/A'}", código="${reservation.accommodationInternalName || 'N/A'}", ID=${reservation.accommodationId}`;
      console.warn(`⚠️ ${errorMsg}`);
      stats.errors.push(errorMsg);
      
      await logSyncError('property_not_found', errorMsg, {
        accommodation_id: reservation.accommodationId,
        accommodation_name: reservation.accommodationName,
        accommodation_internal_name: reservation.accommodationInternalName,
        reservation_id: reservation.id,
        guest_name: reservation.guestName,
        departure_date: reservation.departureDate
      }, syncLogId);
      return;
    }

    console.log(`✅ Propiedad encontrada: ${property.nombre}`);

    const statusUpper = reservation.status.toUpperCase();
    const isCancelled = statusUpper === 'CANCELLED' || 
                        statusUpper === 'CANCELED' ||
                        statusUpper === 'UNAVAILABLE' ||
                        statusUpper === 'UNAVALIABLE' ||
                        !!reservation.cancellationDate;

    const existingReservation = await getExistingReservation(reservation.id);

    if (existingReservation) {
      if (isCancelled) {
        await this.handleCancelledReservation(reservation, existingReservation, property, stats, syncLogId);
      } else {
        await this.handleExistingReservation(reservation, existingReservation, property, stats, syncLogId);
      }
    } else {
      if (isCancelled) {
        await this.createCancelledReservation(reservation, property, stats, syncLogId);
      } else {
        await this.handleNewReservation(reservation, property, stats, syncLogId);
      }
    }

    stats.reservations_processed++;
  }

  private async handleNewReservation(
    reservation: AvantioReservation,
    property: any,
    stats: SyncStats,
    syncLogId?: string | null
  ): Promise<void> {
    try {
      const shouldCreate = shouldCreateTaskForReservation(reservation);
      let taskId = null;
      
      if (shouldCreate) {
        try {
          const task = await createTaskForReservation(reservation, property);
          taskId = task.id;
          stats.tasks_created++;
          
          if (!stats.tasks_details) stats.tasks_details = [];
          stats.tasks_details.push({
            reservation_id: reservation.id,
            property_name: property.nombre,
            task_id: task.id,
            task_date: reservation.departureDate,
            guest_name: reservation.guestName,
            accommodation_id: reservation.accommodationId,
            status: reservation.status
          });
        } catch (taskError) {
          const errorMsg = `Error creando tarea para reserva ${reservation.id}: ${taskError.message}`;
          stats.errors.push(errorMsg);
          await logSyncError('task_creation_failed', errorMsg, {
            reservation_id: reservation.id,
            property_name: property.nombre,
            departure_date: reservation.departureDate
          }, syncLogId);
        }
      }

      const reservationData = {
        avantio_reservation_id: reservation.id,
        property_id: property.id,
        cliente_id: property.cliente_id,
        guest_name: reservation.guestName,
        guest_email: reservation.guestEmail,
        arrival_date: reservation.arrivalDate,
        departure_date: reservation.departureDate,
        reservation_date: reservation.reservationDate,
        cancellation_date: reservation.cancellationDate || null,
        nights: reservation.nights,
        status: reservation.status,
        adults: reservation.adults,
        children: reservation.children || 0,
        accommodation_id: reservation.accommodationId,
        accommodation_name: reservation.accommodationName,
        total_amount: reservation.totalAmount,
        currency: reservation.currency,
        notes: reservation.notes,
        task_id: taskId,
        last_sync_at: new Date().toISOString()
      };

      const { error: insertError } = await insertReservation(reservationData);
      if (insertError) {
        throw insertError;
      }

      stats.new_reservations++;
      
      if (!stats.reservations_details) stats.reservations_details = [];
      stats.reservations_details.push({
        reservation_id: reservation.id,
        property_name: property.nombre,
        guest_name: reservation.guestName,
        accommodation_id: reservation.accommodationId,
        status: reservation.status,
        arrival_date: reservation.arrivalDate,
        departure_date: reservation.departureDate,
        action: 'created'
      });

      console.log(`✅ Nueva reserva creada exitosamente`);
    } catch (error) {
      const errorMsg = `Error creando nueva reserva ${reservation.id}: ${error.message}`;
      console.error(`❌ ${errorMsg}`);
      stats.errors.push(errorMsg);
      await logSyncError('reservation_save_failed', errorMsg, {
        reservation_id: reservation.id,
        property_name: property.nombre
      }, syncLogId);
    }
  }

  private async handleExistingReservation(
    reservation: AvantioReservation,
    existingReservation: any,
    property: any,
    stats: SyncStats,
    syncLogId?: string | null
  ): Promise<void> {
    try {
      // Check if checkout date changed
      const dateChanged = existingReservation.departure_date !== reservation.departureDate;
      
      if (dateChanged && existingReservation.task_id) {
        console.log(`📅 Fecha de checkout cambió: ${existingReservation.departure_date} -> ${reservation.departureDate}`);
        try {
          await updateTaskDate(existingReservation.task_id, reservation.departureDate);
          stats.tasks_modified++;
          
          if (!stats.tasks_modified_details) stats.tasks_modified_details = [];
          stats.tasks_modified_details.push({
            reservation_id: reservation.id,
            property_name: property.nombre,
            task_id: existingReservation.task_id,
            task_date: reservation.departureDate,
            guest_name: reservation.guestName,
            accommodation_id: reservation.accommodationId,
            status: reservation.status
          });
        } catch (taskError) {
          const errorMsg = `Error actualizando tarea para reserva ${reservation.id}: ${taskError.message}`;
          stats.errors.push(errorMsg);
          await logSyncError('task_update_failed', errorMsg, {
            reservation_id: reservation.id,
            task_id: existingReservation.task_id,
            old_date: existingReservation.departure_date,
            new_date: reservation.departureDate
          }, syncLogId);
        }
      }

      // If no task exists yet but should have one, create it
      if (!existingReservation.task_id && shouldCreateTaskForReservation(reservation)) {
        try {
          const task = await createTaskForReservation(reservation, property);
          stats.tasks_created++;
          
          // Update reservation with new task_id
          await updateReservation(existingReservation.id, { task_id: task.id });
          
          if (!stats.tasks_details) stats.tasks_details = [];
          stats.tasks_details.push({
            reservation_id: reservation.id,
            property_name: property.nombre,
            task_id: task.id,
            task_date: reservation.departureDate,
            guest_name: reservation.guestName,
            accommodation_id: reservation.accommodationId,
            status: reservation.status
          });
        } catch (taskError) {
          const errorMsg = `Error creando tarea faltante para reserva ${reservation.id}: ${taskError.message}`;
          stats.errors.push(errorMsg);
          await logSyncError('task_creation_failed', errorMsg, {
            reservation_id: reservation.id,
            property_name: property.nombre
          }, syncLogId);
        }
      }

      // Handle REQUESTED status changes on task name
      if (existingReservation.task_id) {
        const statusChanged = existingReservation.status?.toUpperCase() !== reservation.status.toUpperCase();
        if (statusChanged) {
          const expectedName = getTaskPropertyName(property.nombre, property.codigo, reservation.status);
          const currentTaskName = existingReservation.tasks?.property;
          if (currentTaskName && currentTaskName !== expectedName) {
            try {
              await updateTaskPropertyName(existingReservation.task_id, expectedName);
              console.log(`📝 Nombre de tarea actualizado: "${currentTaskName}" -> "${expectedName}"`);
              stats.tasks_modified++;
            } catch (taskError) {
              const errorMsg = `Error actualizando nombre de tarea para reserva ${reservation.id}: ${taskError.message}`;
              stats.errors.push(errorMsg);
            }
          }
        }
      }

      const reservationData = {
        guest_name: reservation.guestName,
        guest_email: reservation.guestEmail,
        arrival_date: reservation.arrivalDate,
        departure_date: reservation.departureDate,
        nights: reservation.nights,
        status: reservation.status,
        adults: reservation.adults,
        children: reservation.children || 0,
        total_amount: reservation.totalAmount,
        notes: reservation.notes,
        last_sync_at: new Date().toISOString()
      };

      await updateReservation(existingReservation.id, reservationData);
      stats.updated_reservations++;
      
      if (!stats.reservations_details) stats.reservations_details = [];
      stats.reservations_details.push({
        reservation_id: reservation.id,
        property_name: property.nombre,
        guest_name: reservation.guestName,
        accommodation_id: reservation.accommodationId,
        status: reservation.status,
        arrival_date: reservation.arrivalDate,
        departure_date: reservation.departureDate,
        action: 'updated'
      });

      console.log(`✅ Reserva actualizada`);
    } catch (error) {
      const errorMsg = `Error actualizando reserva ${reservation.id}: ${error.message}`;
      console.error(`❌ ${errorMsg}`);
      stats.errors.push(errorMsg);
      await logSyncError('reservation_save_failed', errorMsg, {
        reservation_id: reservation.id,
        property_name: property.nombre
      }, syncLogId);
    }
  }

  private async handleCancelledReservation(
    reservation: AvantioReservation,
    existingReservation: any,
    property: any,
    stats: SyncStats,
    syncLogId?: string | null
  ): Promise<void> {
    try {
      console.log(`🚫 Procesando cancelación de reserva ${reservation.id}`);

      if (existingReservation.task_id) {
        console.log(`🗑️ Eliminando tarea asociada: ${existingReservation.task_id}`);
        
        try {
          // Clear task reference first
          await this.supabase
            .from('avantio_reservations')
            .update({ task_id: null })
            .eq('id', existingReservation.id);
          
          await deleteTask(existingReservation.task_id);
          stats.tasks_cancelled++;
          
          if (!stats.tasks_cancelled_details) stats.tasks_cancelled_details = [];
          stats.tasks_cancelled_details.push({
            reservation_id: reservation.id,
            property_name: property.nombre,
            task_id: existingReservation.task_id,
            task_date: reservation.departureDate,
            guest_name: reservation.guestName,
            accommodation_id: reservation.accommodationId,
            status: 'cancelled'
          });
        } catch (taskError) {
          const errorMsg = `Error eliminando tarea ${existingReservation.task_id}: ${taskError.message}`;
          stats.errors.push(errorMsg);
          await logSyncError('task_deletion_failed', errorMsg, {
            reservation_id: reservation.id,
            task_id: existingReservation.task_id,
            property_name: property.nombre
          }, syncLogId);
        }
      }

      await updateReservation(existingReservation.id, {
        status: 'cancelled',
        cancellation_date: reservation.cancellationDate || new Date().toISOString(),
        last_sync_at: new Date().toISOString()
      });

      stats.cancelled_reservations++;
      
      if (!stats.reservations_details) stats.reservations_details = [];
      stats.reservations_details.push({
        reservation_id: reservation.id,
        property_name: property.nombre,
        guest_name: reservation.guestName,
        accommodation_id: reservation.accommodationId,
        status: 'cancelled',
        arrival_date: reservation.arrivalDate,
        departure_date: reservation.departureDate,
        action: 'cancelled'
      });

      console.log(`✅ Reserva cancelada procesada`);
    } catch (error) {
      const errorMsg = `Error procesando cancelación ${reservation.id}: ${error.message}`;
      console.error(`❌ ${errorMsg}`);
      stats.errors.push(errorMsg);
      await logSyncError('reservation_save_failed', errorMsg, {
        reservation_id: reservation.id,
        property_name: property.nombre
      }, syncLogId);
    }
  }

  private async createCancelledReservation(
    reservation: AvantioReservation,
    property: any,
    stats: SyncStats,
    syncLogId?: string | null
  ): Promise<void> {
    try {
      const reservationData = {
        avantio_reservation_id: reservation.id,
        property_id: property.id,
        cliente_id: property.cliente_id,
        guest_name: reservation.guestName,
        guest_email: reservation.guestEmail,
        arrival_date: reservation.arrivalDate,
        departure_date: reservation.departureDate,
        reservation_date: reservation.reservationDate,
        cancellation_date: reservation.cancellationDate || new Date().toISOString(),
        nights: reservation.nights,
        status: 'cancelled',
        adults: reservation.adults,
        children: reservation.children || 0,
        accommodation_id: reservation.accommodationId,
        accommodation_name: reservation.accommodationName,
        task_id: null,
        last_sync_at: new Date().toISOString()
      };

      await insertReservation(reservationData);
      stats.cancelled_reservations++;
      
      console.log(`✅ Reserva cancelada creada (sin tarea)`);
    } catch (error) {
      const errorMsg = `Error creando reserva cancelada ${reservation.id}: ${error.message}`;
      console.error(`❌ ${errorMsg}`);
      stats.errors.push(errorMsg);
      await logSyncError('reservation_save_failed', errorMsg, {
        reservation_id: reservation.id,
        property_name: property.nombre
      }, syncLogId);
    }
  }
}
