import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { SyncStats } from './types.ts';
import { getHostawayToken, fetchAllHostawayReservations } from './hostaway-api.ts';
import { processReservation } from './reservation-processor.ts';

export class SyncOrchestrator {
  private supabase;
  private stats: SyncStats;
  private syncLogId: string;

  constructor(supabaseUrl: string, supabaseServiceKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
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
    console.log(`🚀 Iniciando sincronización CORREGIDA con Hostaway (Log ID: ${syncLog.id})`);
  }

  async performSync(): Promise<void> {
    // Obtener token de acceso
    console.log('🔑 Obteniendo token de acceso de Hostaway...');
    const accessToken = await getHostawayToken();
    console.log('✅ Token obtenido exitosamente');

    // Calcular rango optimizado
    const now = new Date();
    const startDate = now;
    const endDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    console.log(`📅 RANGO OPTIMIZADO: ${startDateStr} hasta ${endDateStr} (solo HOY + 14 días)`);
    console.log(`✅ ELIMINADOS: días pasados que no son útiles`);

    // Obtener reservas de Hostaway
    console.log(`📥 Obteniendo reservas de Hostaway con rango corregido...`);
    const reservations = await fetchAllHostawayReservations(accessToken, startDateStr, endDateStr);
    console.log(`📊 Obtenidas ${reservations.length} reservas de Hostaway (rango optimizado)`);
    console.log(`🎯 Todas las reservas son relevantes: ${reservations.length} (filtrado optimizado en API)`);

    // Procesar cada reserva
    for (let i = 0; i < reservations.length; i++) {
      const reservation = reservations[i];
      try {
        await processReservation(reservation, this.stats, i, reservations.length);
        this.stats.reservations_processed++;
      } catch (error) {
        console.error(`❌ Error procesando reserva ${reservation.id}:`, error);
        this.stats.errors.push(`Error en reserva ${reservation.id}: ${error.message}`);
      }
    }

    await this.performPostSyncOperations(startDateStr, endDateStr);
  }

  private async performPostSyncOperations(startDateStr: string, endDateStr: string): Promise<void> {
    // Detectar tareas duplicadas
    if (this.stats.tasks_created > 0) {
      await this.detectDuplicateTasks(startDateStr, endDateStr);
      await this.executeAutoAssignment();
    } else {
      console.log('ℹ️ No se crearon nuevas tareas, saltando asignación automática');
    }

    // Generar resumen de cancelaciones
    await this.generateCancellationSummary();
  }

  private async detectDuplicateTasks(startDateStr: string, endDateStr: string): Promise<void> {
    console.log(`🔍 Verificando tareas duplicadas...`);
    
    try {
      const { data: allTasks, error: tasksError } = await this.supabase
        .from('tasks')
        .select(`
          id,
          date,
          propiedad_id,
          property:properties!inner(nombre)
        `)
        .gte('date', startDateStr)
        .lte('date', endDateStr)
        .not('propiedad_id', 'is', null);

      if (tasksError) {
        console.error('❌ Error obteniendo tareas:', tasksError);
        this.stats.errors.push(`Error obteniendo tareas: ${tasksError.message}`);
      } else if (allTasks && allTasks.length > 0) {
        console.log(`📊 Total de tareas encontradas: ${allTasks.length}`);
        
        const taskGroups = new Map<string, any[]>();
        
        allTasks.forEach(task => {
          const key = `${task.date}-${task.propiedad_id}`;
          if (!taskGroups.has(key)) {
            taskGroups.set(key, []);
          }
          taskGroups.get(key)!.push(task);
        });

        const duplicates = Array.from(taskGroups.entries())
          .filter(([_, tasks]) => tasks.length > 1)
          .map(([key, tasks]) => {
            const [date, propiedadId] = key.split('-');
            return {
              date,
              propiedad_id: propiedadId,
              task_count: tasks.length,
              property_name: tasks[0].property?.nombre || 'Desconocida',
              task_ids: tasks.map(t => t.id)
            };
          });

        if (duplicates.length > 0) {
          console.log(`⚠️ TAREAS DUPLICADAS DETECTADAS: ${duplicates.length} grupos`);
          duplicates.forEach(dup => {
            const warningMsg = `DUPLICADO: ${dup.task_count} tareas para ${dup.property_name} el ${dup.date} (IDs: ${dup.task_ids.join(', ')})`;
            console.log(`⚠️ ${warningMsg}`);
            this.stats.errors.push(warningMsg);
          });
          
          console.log(`📋 Detalles de duplicados encontrados:`);
          duplicates.forEach(dup => {
            console.log(`   - ${dup.property_name}: ${dup.task_count} tareas en ${dup.date}`);
            console.log(`   - IDs de tareas: ${dup.task_ids.join(', ')}`);
          });
        } else {
          console.log(`✅ No se encontraron tareas duplicadas`);
        }
      }
    } catch (error) {
      console.error('❌ Error en verificación de duplicados:', error);
      this.stats.errors.push(`Error en verificación de duplicados: ${error.message}`);
    }
  }

  private async executeAutoAssignment(): Promise<void> {
    console.log(`🤖 Ejecutando asignación automática para ${this.stats.tasks_created} nuevas tareas...`);
    
    const taskIds = this.stats.tasks_details?.map(td => td.task_id) || [];
    
    if (taskIds.length > 0) {
      console.log(`🎯 Task IDs para asignación automática:`, taskIds);
      
      try {
        const { data: autoAssignResult, error: autoAssignError } = await this.supabase.functions.invoke('auto-assign-tasks', {
          body: { taskIds }
        });

        if (autoAssignError) {
          console.error('❌ Error en asignación automática:', autoAssignError);
          this.stats.errors.push(`Error en asignación automática: ${autoAssignError.message}`);
        } else {
          console.log('✅ Asignación automática completada:', autoAssignResult);
          
          if (autoAssignResult?.summary) {
            console.log(`📈 Resumen de asignación automática: ${autoAssignResult.summary.assigned}/${autoAssignResult.summary.total} tareas asignadas`);
          }
        }
      } catch (error) {
        console.error('❌ Error ejecutando asignación automática:', error);
        this.stats.errors.push(`Error ejecutando asignación automática: ${error.message}`);
      }
    } else {
      console.log('⚠️ No se encontraron task IDs para asignación automática');
    }
  }

  private async generateCancellationSummary(): Promise<void> {
    const cancelledReservations = this.stats.reservations_details?.filter(r => r.action === 'cancelled') || [];
    
    if (cancelledReservations.length > 0) {
      console.log(`📋 RESUMEN DE CANCELACIONES: ${cancelledReservations.length} reservas canceladas`);
      cancelledReservations.forEach(reservation => {
        const summaryLine = `- ${reservation.property_name} (${reservation.departure_date}): ${reservation.guest_name}`;
        console.log(`❌ ${summaryLine}`);
      });
    } else {
      console.log('✅ No hubo cancelaciones en esta sincronización');
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
