import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { SyncStats } from './types.ts';
import { fetchAllAvantioReservations } from './avantio-api.ts';
import { ReservationProcessor } from './reservation-processor.ts';
import { createSyncLog, updateSyncLog } from './database-operations.ts';

export class SyncOrchestrator {
  private supabase;
  private processor: ReservationProcessor;
  private syncLogId: string | null = null;
  private stats: SyncStats = {
    reservations_processed: 0,
    new_reservations: 0,
    updated_reservations: 0,
    cancelled_reservations: 0,
    tasks_created: 0,
    tasks_cancelled: 0,
    tasks_modified: 0,
    errors: [],
    tasks_details: [],
    tasks_cancelled_details: [],
    tasks_modified_details: [],
    reservations_details: []
  };

  constructor(supabaseUrl: string, supabaseServiceKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    this.processor = new ReservationProcessor(supabaseUrl, supabaseServiceKey);
  }

  async initializeSyncLog(): Promise<void> {
    const syncLog = await createSyncLog();
    this.syncLogId = syncLog.id;
    console.log(`📝 Log de sincronización iniciado: ${this.syncLogId}`);
  }

  getSyncLogId(): string | null {
    return this.syncLogId;
  }

  async performSync(token: string): Promise<void> {
    console.log('🚀 Iniciando sincronización con Avantio PMS v1...');
    
    // Fetch all reservations using real API (pagination + detail included)
    const reservations = await fetchAllAvantioReservations(token);
    
    console.log(`📊 Total de reservas a procesar: ${reservations.length}`);
    
    // Process each reservation
    for (let i = 0; i < reservations.length; i++) {
      try {
        await this.processor.processReservation(
          reservations[i],
          this.stats,
          i,
          reservations.length,
          this.syncLogId
        );
      } catch (error) {
        console.error(`❌ Error procesando reserva ${reservations[i].id}:`, error);
        this.stats.errors.push(`Error en reserva ${reservations[i].id}: ${error.message}`);
      }
    }
    
    // REPAIR: Check for reservations in DB with NULL task_id that should have tasks
    await this.repairMissingTasks();
    
    console.log('✅ Sincronización completada');
  }

  private async repairMissingTasks(): Promise<void> {
    console.log('🔧 Verificando reservas sin tarea asignada...');
    
    const today = new Date().toISOString().slice(0, 10);
    
    const { data: orphanedReservations, error } = await this.supabase
      .from('avantio_reservations')
      .select('*, properties!avantio_reservations_property_id_fkey(*)')
      .is('task_id', null)
      .not('status', 'in', '("cancelled","CANCELLED","UNAVAILABLE")')
      .gte('departure_date', today)
      .not('property_id', 'is', null);

    if (error) {
      console.error('❌ Error buscando reservas huérfanas:', error);
      return;
    }

    if (!orphanedReservations || orphanedReservations.length === 0) {
      console.log('✅ No hay reservas sin tarea');
      return;
    }

    console.log(`⚠️ Encontradas ${orphanedReservations.length} reservas sin tarea. Reparando...`);

    for (const reservation of orphanedReservations) {
      if (!reservation.properties) continue;
      
      try {
        const { createTaskForReservation } = await import('./database-operations.ts');
        
        const avantioReservation = {
          id: reservation.avantio_reservation_id,
          accommodationId: reservation.accommodation_id || '',
          accommodationName: reservation.accommodation_name || '',
          accommodationInternalName: '',
          status: reservation.status,
          arrivalDate: reservation.arrival_date,
          departureDate: reservation.departure_date,
          reservationDate: reservation.reservation_date || '',
          cancellationDate: reservation.cancellation_date || '',
          nights: reservation.nights || 1,
          adults: reservation.adults || 2,
          children: reservation.children || 0,
          guestName: reservation.guest_name,
        };

        const { shouldCreateTaskForReservation } = await import('./reservation-validator.ts');
        if (!shouldCreateTaskForReservation(avantioReservation)) continue;

        const task = await createTaskForReservation(avantioReservation, reservation.properties);
        
        await this.supabase
          .from('avantio_reservations')
          .update({ task_id: task.id })
          .eq('id', reservation.id);

        this.stats.tasks_created++;
        if (!this.stats.tasks_details) this.stats.tasks_details = [];
        this.stats.tasks_details.push({
          reservation_id: reservation.avantio_reservation_id,
          property_name: reservation.properties.nombre,
          task_id: task.id,
          task_date: reservation.departure_date,
          guest_name: reservation.guest_name,
          accommodation_id: reservation.accommodation_id || '',
          status: `REPAIRED-${reservation.status}`
        });

        console.log(`✅ Tarea reparada: ${task.id} para reserva ${reservation.avantio_reservation_id} (${reservation.properties.nombre})`);
      } catch (repairError) {
        console.error(`❌ Error reparando reserva ${reservation.avantio_reservation_id}:`, repairError);
        this.stats.errors.push(`Error reparando tarea para ${reservation.avantio_reservation_id}: ${repairError.message}`);
      }
    }
  }

  async finalizeSyncLog(success: boolean, error?: Error): Promise<void> {
    if (!this.syncLogId) return;

    const updates: any = {
      sync_completed_at: new Date().toISOString(),
      status: success ? 'completed' : 'failed',
      reservations_processed: this.stats.reservations_processed,
      new_reservations: this.stats.new_reservations,
      updated_reservations: this.stats.updated_reservations,
      cancelled_reservations: this.stats.cancelled_reservations,
      tasks_created: this.stats.tasks_created,
      tasks_cancelled: this.stats.tasks_cancelled,
      tasks_modified: this.stats.tasks_modified,
      errors: this.stats.errors.length > 0 ? this.stats.errors : null,
      tasks_details: this.stats.tasks_details?.length ? this.stats.tasks_details : null,
      tasks_cancelled_details: this.stats.tasks_cancelled_details?.length ? this.stats.tasks_cancelled_details : null,
      tasks_modified_details: this.stats.tasks_modified_details?.length ? this.stats.tasks_modified_details : null,
      reservations_details: this.stats.reservations_details?.length ? this.stats.reservations_details : null
    };

    if (error) {
      updates.errors = [...(updates.errors || []), error.message];
    }

    await updateSyncLog(this.syncLogId, updates);
    console.log(`📝 Log de sincronización finalizado: ${this.syncLogId}`);

    // Send error notification email if sync failed or had errors
    if (!success || this.stats.errors.length > 0) {
      await this.sendErrorNotificationEmail(success, error);
    }
  }

  private async sendErrorNotificationEmail(success: boolean, error?: Error): Promise<void> {
    try {
      const errorSummary = !success 
        ? `Sincronización FALLIDA: ${error?.message || 'Error desconocido'}`
        : `Sincronización completada con ${this.stats.errors.length} errores`;

      const errorDetails = this.stats.errors.slice(0, 20).join('\n');

      console.log(`📧 Enviando email de notificación de errores...`);
      
      await this.supabase.functions.invoke('send-avantio-error-email', {
        body: {
          syncLogId: this.syncLogId,
          success,
          errorSummary,
          errorDetails,
          stats: {
            reservations_processed: this.stats.reservations_processed,
            new_reservations: this.stats.new_reservations,
            updated_reservations: this.stats.updated_reservations,
            tasks_created: this.stats.tasks_created,
            tasks_cancelled: this.stats.tasks_cancelled,
            tasks_modified: this.stats.tasks_modified,
            errors_count: this.stats.errors.length
          },
          tasks_details: this.stats.tasks_details || [],
          tasks_cancelled_details: this.stats.tasks_cancelled_details || [],
          tasks_modified_details: this.stats.tasks_modified_details || [],
          timestamp: new Date().toISOString()
        }
      });
      console.log(`✅ Email de notificación enviado`);
    } catch (emailError) {
      console.error(`❌ Error enviando email de notificación:`, emailError);
    }
  }

  getStats(): SyncStats {
    return this.stats;
  }
}
