import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { AvantioReservation, SyncStats } from './types.ts';
import { 
  findPropertyByAvantioId, 
  getExistingReservation,
  insertReservation,
  createTaskForReservation,
  updateReservation,
  deleteTask,
  updateTaskDate
} from './database-operations.ts';
import { shouldCreateTaskForReservation, getTaskCreationReason } from './reservation-validator.ts';

export class ReservationProcessor {
  private supabase;

  constructor(supabaseUrl: string, supabaseServiceKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  async processReservation(
    reservation: AvantioReservation, 
    stats: SyncStats,
    reservationIndex: number,
    totalReservations: number
  ): Promise<void> {
    console.log(`\n🔄 PROCESANDO RESERVA ${reservation.id} (${reservationIndex + 1}/${totalReservations})`);
    console.log(`   - Alojamiento: ${reservation.accommodationName || 'N/A'} (ID: ${reservation.accommodationId})`);
    console.log(`   - Estado: ${reservation.status}`);
    console.log(`   - Check-out: ${reservation.departureDate}`);
    console.log(`   - Huésped: ${reservation.guestName}`);

    // Buscar la propiedad
    const property = await findPropertyByAvantioId(
      reservation.accommodationId, 
      reservation.accommodationName
    );
    
    if (!property) {
      const errorMsg = `Propiedad no encontrada: accommodationId ${reservation.accommodationId}, nombre: ${reservation.accommodationName || 'N/A'}`;
      console.warn(`⚠️ ${errorMsg}`);
      stats.errors.push(errorMsg);
      return;
    }

    console.log(`✅ Propiedad encontrada: ${property.nombre}`);

    // Verificar si la reserva está cancelada
    const isCancelled = reservation.status.toLowerCase() === 'cancelled' || 
                        reservation.status.toLowerCase() === 'canceled' ||
                        !!reservation.cancellationDate;

    // Verificar si ya existe la reserva
    const existingReservation = await getExistingReservation(reservation.id);

    if (existingReservation) {
      console.log(`📝 Reserva existente encontrada: ${existingReservation.id}`);
      
      if (isCancelled) {
        await this.handleCancelledReservation(reservation, existingReservation, property, stats);
      } else {
        await this.handleExistingReservation(reservation, existingReservation, property, stats);
      }
    } else {
      if (isCancelled) {
        // Nueva reserva ya cancelada - crear sin tarea
        console.log(`📝 Nueva reserva cancelada - creando sin tarea`);
        await this.createCancelledReservation(reservation, property, stats);
      } else {
        console.log(`🆕 Nueva reserva - Creando tarea`);
        await this.handleNewReservation(reservation, property, stats);
      }
    }

    stats.reservations_processed++;
  }

  private async handleNewReservation(
    reservation: AvantioReservation,
    property: any,
    stats: SyncStats
  ): Promise<void> {
    try {
      const shouldCreateTask = shouldCreateTaskForReservation(reservation);
      console.log(`🔍 ¿Crear tarea para reserva ${reservation.id}? ${shouldCreateTask}`);
      console.log(`📋 Motivo: ${getTaskCreationReason(reservation)}`);
      
      let taskId = null;
      
      if (shouldCreateTask) {
        const task = await createTaskForReservation(reservation, property);
        taskId = task.id;
        stats.tasks_created++;
        console.log(`✅ Tarea creada: ${task.id}`);
        
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

      await insertReservation(reservationData);
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
    }
  }

  private async handleExistingReservation(
    reservation: AvantioReservation,
    existingReservation: any,
    property: any,
    stats: SyncStats
  ): Promise<void> {
    try {
      // Verificar cambios en la fecha de checkout
      const dateChanged = existingReservation.departure_date !== reservation.departureDate;
      
      if (dateChanged && existingReservation.task_id) {
        console.log(`📅 Fecha de checkout cambió: ${existingReservation.departure_date} -> ${reservation.departureDate}`);
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
      }

      // Actualizar la reserva
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
    }
  }

  private async handleCancelledReservation(
    reservation: AvantioReservation,
    existingReservation: any,
    property: any,
    stats: SyncStats
  ): Promise<void> {
    try {
      console.log(`🚫 Procesando cancelación de reserva ${reservation.id}`);

      // Si tiene tarea asignada, eliminarla
      if (existingReservation.task_id) {
        console.log(`🗑️ Eliminando tarea asociada: ${existingReservation.task_id}`);
        
        // Primero limpiar la referencia
        await this.supabase
          .from('avantio_reservations')
          .update({ task_id: null })
          .eq('id', existingReservation.id);
        
        // Luego eliminar la tarea
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
      }

      // Actualizar la reserva como cancelada
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
    }
  }

  private async createCancelledReservation(
    reservation: AvantioReservation,
    property: any,
    stats: SyncStats
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
    }
  }
}
