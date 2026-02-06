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
    
    console.log('✅ Sincronización completada');
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
  }

  getStats(): SyncStats {
    return this.stats;
  }
}
