
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
    // PRIMERO: Limpiar duplicados REALES en toda la base de datos
    await this.cleanupAllDuplicatedTasks();
    
    // DESPUÉS: Detectar y reportar duplicados solo en el rango actual (sin eliminar automáticamente)
    await this.detectAndReportDuplicateTasks(startDateStr, endDateStr);
    
    if (this.stats.tasks_created > 0) {
      await this.executeAutoAssignment();
    } else {
      console.log('ℹ️ No se crearon nuevas tareas, saltando asignación automática');
    }

    // Generar resumen de cancelaciones
    await this.generateCancellationSummary();
  }

  private async cleanupAllDuplicatedTasks(): Promise<void> {
    console.log(`🧹 SISTEMA CORREGIDO: Limpiando TODAS las tareas duplicadas REALES en la base de datos...`);
    
    try {
      // Obtener TODAS las tareas, no solo del rango actual
      const { data: allTasks, error: tasksError } = await this.supabase
        .from('tasks')
        .select(`
          id,
          date,
          propiedad_id,
          start_time,
          end_time,
          created_at,
          property:properties!inner(nombre)
        `)
        .not('propiedad_id', 'is', null)
        .order('date, propiedad_id, start_time, created_at');

      if (tasksError) {
        console.error('❌ Error obteniendo todas las tareas:', tasksError);
        this.stats.errors.push(`Error obteniendo tareas: ${tasksError.message}`);
        return;
      }

      if (!allTasks || allTasks.length === 0) {
        console.log(`✅ No hay tareas en la base de datos`);
        return;
      }

      console.log(`📊 Total de tareas en la base de datos: ${allTasks.length}`);
      
      // Agrupar tareas por CLAVE ÚNICA: fecha + propiedad + hora de inicio + hora de fin
      const taskGroups = new Map<string, any[]>();
      
      allTasks.forEach(task => {
        // Crear clave única que incluye todos los campos relevantes
        const key = `${task.date}-${task.propiedad_id}-${task.start_time}-${task.end_time}`;
        
        if (!taskGroups.has(key)) {
          taskGroups.set(key, []);
        }
        taskGroups.get(key)!.push(task);
      });

      // Encontrar grupos con más de 1 tarea (duplicados REALES)
      const duplicateGroups = Array.from(taskGroups.entries())
        .filter(([_, tasks]) => tasks.length > 1);

      if (duplicateGroups.length === 0) {
        console.log(`✅ No se encontraron tareas duplicadas REALES en toda la base de datos`);
        return;
      }

      console.log(`⚠️ TAREAS DUPLICADAS REALES DETECTADAS: ${duplicateGroups.length} grupos`);
      
      let totalTasksRemoved = 0;

      // Procesar cada grupo de duplicados REALES
      for (const [key, tasks] of duplicateGroups) {
        const [dateStr, propiedadId, startTime, endTime] = key.split('-');
        const propertyName = tasks[0].property?.nombre || 'Desconocida';
        
        console.log(`🔄 DUPLICADO REAL encontrado: ${propertyName} el ${dateStr} de ${startTime} a ${endTime}`);
        console.log(`   - Total tareas duplicadas: ${tasks.length}`);
        console.log(`   - IDs: ${tasks.map(t => t.id).join(', ')}`);
        
        // MANTENER SOLO LA PRIMERA TAREA (más antigua por created_at)
        // Las tareas ya están ordenadas por created_at
        const taskToKeep = tasks[0];
        const tasksToRemove = tasks.slice(1);
        
        console.log(`   - Manteniendo tarea: ${taskToKeep.id} (primera creada: ${taskToKeep.created_at})`);
        console.log(`   - Eliminando ${tasksToRemove.length} tareas duplicadas`);
        
        // ELIMINAR las tareas duplicadas REALES
        for (const taskToRemove of tasksToRemove) {
          try {
            // Primero, limpiar referencias en hostaway_reservations
            await this.supabase
              .from('hostaway_reservations')
              .update({ task_id: null })
              .eq('task_id', taskToRemove.id);

            // Luego eliminar la tarea
            const { error: deleteError } = await this.supabase
              .from('tasks')
              .delete()
              .eq('id', taskToRemove.id);
              
            if (deleteError) {
              console.error(`❌ Error eliminando tarea duplicada ${taskToRemove.id}:`, deleteError);
              this.stats.errors.push(`Error eliminando tarea duplicada ${taskToRemove.id}: ${deleteError.message}`);
            } else {
              console.log(`   ✅ Eliminada tarea duplicada: ${taskToRemove.id}`);
              totalTasksRemoved++;
            }
          } catch (error) {
            console.error(`❌ Error eliminando tarea ${taskToRemove.id}:`, error);
            this.stats.errors.push(`Error eliminando tarea ${taskToRemove.id}: ${error.message}`);
          }
        }
        
        // Agregar al reporte
        const cleanupMsg = `DUPLICADO REAL LIMPIADO: ${tasks.length} tareas para ${propertyName} el ${dateStr} (${startTime}-${endTime}) - mantenida: ${taskToKeep.id}`;
        console.log(`✅ ${cleanupMsg}`);
        this.stats.errors.push(cleanupMsg);
      }
      
      console.log(`🎯 RESUMEN DE LIMPIEZA GENERAL:`);
      console.log(`   - Grupos con duplicados REALES: ${duplicateGroups.length}`);
      console.log(`   - Total tareas eliminadas: ${totalTasksRemoved}`);
      console.log(`   - Tareas mantenidas: ${duplicateGroups.length}`);
      
    } catch (error) {
      console.error('❌ Error en limpieza general de duplicados:', error);
      this.stats.errors.push(`Error en limpieza general de duplicados: ${error.message}`);
    }
  }

  private async detectAndReportDuplicateTasks(startDateStr: string, endDateStr: string): Promise<void> {
    console.log(`🔍 DETECCIÓN DE DUPLICADOS en rango de sincronización (${startDateStr} a ${endDateStr})...`);
    
    try {
      const { data: rangeTasks, error: tasksError } = await this.supabase
        .from('tasks')
        .select(`
          id,
          date,
          propiedad_id,
          start_time,
          end_time,
          created_at,
          property:properties!inner(nombre)
        `)
        .gte('date', startDateStr)
        .lte('date', endDateStr)
        .not('propiedad_id', 'is', null)
        .order('date, propiedad_id, start_time, created_at');

      if (tasksError) {
        console.error('❌ Error obteniendo tareas del rango:', tasksError);
        return;
      }

      if (!rangeTasks || rangeTasks.length === 0) {
        console.log(`✅ No hay tareas en el rango de sincronización`);
        return;
      }

      console.log(`📊 Tareas en rango de sincronización: ${rangeTasks.length}`);
      
      // Agrupar por clave única para detección
      const taskGroups = new Map<string, any[]>();
      
      rangeTasks.forEach(task => {
        const key = `${task.date}-${task.propiedad_id}-${task.start_time}-${task.end_time}`;
        
        if (!taskGroups.has(key)) {
          taskGroups.set(key, []);
        }
        taskGroups.get(key)!.push(task);
      });

      // Solo reportar, NO eliminar automáticamente
      const duplicateGroups = Array.from(taskGroups.entries())
        .filter(([_, tasks]) => tasks.length > 1);

      if (duplicateGroups.length === 0) {
        console.log(`✅ No se detectaron duplicados en el rango de sincronización`);
        return;
      }

      console.log(`⚠️ DUPLICADOS DETECTADOS EN RANGO: ${duplicateGroups.length} grupos (SOLO REPORTE)`);
      
      for (const [key, tasks] of duplicateGroups) {
        const [dateStr, propiedadId, startTime, endTime] = key.split('-');
        const propertyName = tasks[0].property?.nombre || 'Desconocida';
        
        const reportMsg = `DUPLICADO EN RANGO: ${tasks.length} tareas para ${propertyName} el ${dateStr} (${startTime}-${endTime}) - IDs: ${tasks.map(t => t.id.substring(0, 8)).join(', ')}`;
        console.log(`📋 ${reportMsg}`);
        this.stats.errors.push(reportMsg);
      }
      
    } catch (error) {
      console.error('❌ Error en detección de duplicados del rango:', error);
      this.stats.errors.push(`Error en detección de duplicados del rango: ${error.message}`);
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
