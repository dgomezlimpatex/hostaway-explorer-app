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
      tasks_deleted: 0,
      tasks_modified: 0,
      errors: [],
      tasks_details: [],
      tasks_deleted_details: [],
      tasks_modified_details: [],
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
    console.log(`🚀 INICIANDO SINCRONIZACIÓN SIMPLIFICADA (Log ID: ${syncLog.id})`);
  }

  async performSync(): Promise<void> {
    // PASO 1: Limpieza previa de duplicados existentes
    console.log(`🧹 PASO 1: Limpieza previa de duplicados`);
    await this.reservationProcessor.runPreSyncCleanup();

    // PASO 2: Obtener token de Hostaway
    console.log(`🔑 PASO 2: Obteniendo token de Hostaway`);
    const accessToken = await getHostawayToken();
    console.log('✅ Token obtenido exitosamente');

    // PASO 3: Calcular rango de fechas SIMPLIFICADO (HOY + 14 días)
    const today = new Date();
    const startDate = today.toISOString().split('T')[0]; // HOY
    const endDate = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // HOY + 14 días

    console.log(`📅 PASO 3: Período SIMPLIFICADO - Desde HOY (${startDate}) hasta ${endDate} (14 días)`);
    console.log(`📅 OBJETIVO: Buscar reservas que hacen CHECKOUT en este período`);

    // PASO 4: Obtener reservas de Hostaway (SOLO por checkout)
    console.log(`📥 PASO 4: Obteniendo reservas con checkout desde HOY hasta +14 días`);
    const reservations = await fetchAllHostawayReservations(accessToken, startDate, endDate);
    console.log(`📊 TOTAL DE RESERVAS ENCONTRADAS: ${reservations.length}`);

    if (reservations.length < 100) {
      console.log(`⚠️  ATENCIÓN: Solo se encontraron ${reservations.length} reservas. Se esperaban más de 150.`);
      console.log(`   - Verificar que las fechas son correctas: ${startDate} a ${endDate}`);
      console.log(`   - Verificar que Hostaway tiene reservas en este período`);
    }

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

    // PASO 6: Procesar reservas existentes sin tareas
    console.log(`🔄 PASO 6: Procesando reservas existentes sin tareas`);
    await this.processExistingReservationsWithoutTasks();

    console.log(`✅ SINCRONIZACIÓN COMPLETADA`);
    console.log(`📊 Estadísticas finales:`, this.stats);

    if (this.stats.reservations_processed < 100) {
      console.log(`⚠️  RESULTADO: Solo se procesaron ${this.stats.reservations_processed} reservas de ${reservations.length} encontradas`);
    }
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

  async processExistingReservationsWithoutTasks(): Promise<void> {
    // Obtener reservas existentes sin tareas que deberían tenerlas
    // CORREGIDO: Filtrar correctamente los status inválidos
    const { data: reservationsWithoutTasks, error } = await this.supabase
      .from('hostaway_reservations')
      .select(`
        *,
        properties:property_id(*)
      `)
      .is('task_id', null)
      .gte('departure_date', new Date().toISOString().split('T')[0])
      .not('status', 'in', '("cancelled","inquiry","declined","expired")'); // Filtrar múltiples status inválidos

    if (error) {
      console.error('Error obteniendo reservas sin tareas:', error);
      this.stats.errors.push(`Error obteniendo reservas sin tareas: ${error.message}`);
      return;
    }

    if (!reservationsWithoutTasks || reservationsWithoutTasks.length === 0) {
      console.log('✅ No hay reservas existentes sin tareas');
      return;
    }

    console.log(`📋 Encontradas ${reservationsWithoutTasks.length} reservas existentes sin tareas`);

    // Procesar cada reserva sin tarea
    for (let i = 0; i < reservationsWithoutTasks.length; i++) {
      const dbReservation = reservationsWithoutTasks[i];
      
      // Convertir formato de BD a formato Hostaway para reutilizar lógica
      const hostawayReservation = {
        id: dbReservation.hostaway_reservation_id,
        listingMapId: dbReservation.properties?.hostaway_listing_id || 0,
        listingName: dbReservation.properties?.nombre || '',
        status: dbReservation.status,
        departureDate: dbReservation.departure_date,
        arrivalDate: dbReservation.arrival_date,
        reservationDate: dbReservation.reservation_date,
        cancellationDate: dbReservation.cancellation_date,
        nights: dbReservation.nights || 1,
        adults: dbReservation.adults || 1,
        guestName: 'Cliente sin nombre' // No tenemos guest name en BD
      };

      try {
        console.log(`🔄 Creando tarea faltante para reserva ${dbReservation.hostaway_reservation_id} (${i + 1}/${reservationsWithoutTasks.length})`);
        
        const taskId = await this.reservationProcessor.createMissingTaskForExistingReservation(
          hostawayReservation, 
          dbReservation.properties, 
          this.stats
        );

        if (taskId) {
          // Actualizar la reserva con el task_id
          await this.supabase
            .from('hostaway_reservations')
            .update({ task_id: taskId })
            .eq('id', dbReservation.id);
          
          console.log(`✅ Tarea creada y reserva actualizada: ${taskId}`);
        }
      } catch (error) {
        console.error(`❌ Error procesando reserva existente ${dbReservation.hostaway_reservation_id}:`, error);
        this.stats.errors.push(`Error en reserva existente ${dbReservation.hostaway_reservation_id}: ${error.message}`);
      }
    }
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
