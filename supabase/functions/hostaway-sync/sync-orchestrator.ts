import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { SyncStats } from './types.ts';
import { getHostawayToken, fetchAllHostawayReservations } from './hostaway-api.ts';
import { ImprovedReservationProcessor } from './improved-reservation-processor.ts';

export class SyncOrchestrator {
  private supabase;
  private stats: SyncStats;
  private syncLogId: string;
  private reservationProcessor: ImprovedReservationProcessor;

  constructor(supabaseUrl: string, supabaseServiceKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    this.reservationProcessor = new ImprovedReservationProcessor(supabaseUrl, supabaseServiceKey);
    this.stats = {
      reservations_processed: 0,
      new_reservations: 0,
      updated_reservations: 0,
      cancelled_reservations: 0,
      tasks_created: 0,
      errors: [],
      tasks_details: [],
      reservations_details: []
    };
  }

  async initializeSyncLog(): Promise<void> {
    const { data: syncLog, error: logError } = await this.supabase
      .from('hostaway_sync_logs')
      .insert({
        sync_started_at: new Date().toISOString(),
        status: 'running'
      })
      .select()
      .single();

    if (logError) {
      console.error('Error creating sync log:', logError);
      throw logError;
    }

    this.syncLogId = syncLog.id;
    console.log(`🚀 INICIANDO SINCRONIZACIÓN MEJORADA (Log ID: ${syncLog.id})`);
  }

  async performSync(): Promise<void> {
    // PASO 1: Limpieza previa de duplicados existentes
    console.log(`🧹 PASO 1: Limpieza previa de duplicados`);
    await this.reservationProcessor.runPreSyncCleanup();

    // PASO 2: Obtener token de Hostaway
    console.log(`🔑 PASO 2: Obteniendo token de Hostaway`);
    const accessToken = await getHostawayToken();
    console.log('✅ Token obtenido exitosamente');

    // PASO 3: Calcular rango de fechas más amplio (3 semanas en lugar de 2)
    const now = new Date();
    const startDate = now;
    const endDate = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000); // 3 semanas
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    console.log(`📅 PASO 3: Rango de fechas EXPANDIDO: ${startDateStr} hasta ${endDateStr} (3 semanas)`);

    // PASO 4: Obtener reservas de Hostaway
    console.log(`📥 PASO 4: Obteniendo reservas de Hostaway con búsqueda expandida`);
    const reservations = await fetchAllHostawayReservations(accessToken, startDateStr, endDateStr);
    console.log(`📊 TOTAL DE RESERVAS ENCONTRADAS: ${reservations.length}`);

    // PASO 5: Procesar cada reserva con verificación de duplicados
    console.log(`🔄 PASO 5: Procesando ${reservations.length} reservas con verificación de duplicados`);
    for (let i = 0; i < reservations.length; i++) {
      const reservation = reservations[i];
      try {
        await this.reservationProcessor.processReservation(reservation, this.stats, i, reservations.length);
      } catch (error) {
        console.error(`❌ Error procesando reserva ${reservation.id}:`, error);
        this.stats.errors.push(`Error en reserva ${reservation.id}: ${error.message}`);
      }
    }

    console.log(`✅ SINCRONIZACIÓN COMPLETADA`);
    console.log(`📊 Estadísticas finales:`, this.stats);
  }

  async finalizeSyncLog(success: boolean, error?: Error): Promise<void> {
    const updateData = {
      sync_completed_at: new Date().toISOString(),
      status: success ? 'completed' : 'error',
      ...this.stats
    };

    if (error) {
      this.stats.errors.push(`Error general: ${error.message}`);
      updateData.errors = this.stats.errors;
    }

    await this.supabase
      .from('hostaway_sync_logs')
      .update(updateData)
      .eq('id', this.syncLogId);
  }

  getStats(): SyncStats {
    return this.stats;
  }

  getCancellationSummary(): string {
    const cancelledReservations = this.stats.reservations_details?.filter(r => r.action === 'cancelled') || [];
    
    if (cancelledReservations.length > 0) {
      let summary = '';
      cancelledReservations.forEach(reservation => {
        const summaryLine = `- ${reservation.property_name} (${reservation.departure_date}): ${reservation.guest_name}`;
        summary += summaryLine + '\n';
      });
      return summary;
    }
    
    return 'No hubo cancelaciones';
  }
}
