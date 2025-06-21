
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { HostawayReservation, SyncStats } from './types.ts';
import { getHostawayToken, fetchAllHostawayReservations } from './hostaway-api.ts';
import { processReservation } from './reservation-processor.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Iniciar log de sincronización
    const { data: syncLog, error: logError } = await supabase
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

    console.log(`🚀 Iniciando sincronización CORREGIDA con Hostaway (Log ID: ${syncLog.id})`);

    const stats: SyncStats = {
      reservations_processed: 0,
      new_reservations: 0,
      updated_reservations: 0,
      cancelled_reservations: 0,
      tasks_created: 0,
      errors: [],
      tasks_details: [],
      reservations_details: []
    };

    try {
      // Obtener token de acceso
      console.log('🔑 Obteniendo token de acceso de Hostaway...');
      const accessToken = await getHostawayToken();
      console.log('✅ Token obtenido exitosamente');

      // CORREGIDO: Calcular rango optimizado - HOY + 14 días (no días pasados)
      const now = new Date();
      const startDate = now; // HOY (sin días atrás)
      const endDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 días adelante
      
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      console.log(`📅 RANGO OPTIMIZADO: ${startDateStr} hasta ${endDateStr} (solo HOY + 14 días)`);
      console.log(`✅ ELIMINADOS: días pasados que no son útiles`);

      // Obtener reservas de Hostaway con rango optimizado
      console.log(`📥 Obteniendo reservas de Hostaway con rango corregido...`);
      const reservations = await fetchAllHostawayReservations(accessToken, startDateStr, endDateStr);
      console.log(`📊 Obtenidas ${reservations.length} reservas de Hostaway (rango optimizado vs ~1200+ anteriormente)`);

      // MEJORADO: No necesitamos filtrar más porque ya buscamos solo por departureDate en el rango correcto
      console.log(`🎯 Todas las reservas son relevantes: ${reservations.length} (filtrado optimizado en API)`);

      // Procesar cada reserva
      for (let i = 0; i < reservations.length; i++) {
        const reservation = reservations[i];
        try {
          await processReservation(reservation, stats, i, reservations.length);
          stats.reservations_processed++;
        } catch (error) {
          console.error(`❌ Error procesando reserva ${reservation.id}:`, error);
          stats.errors.push(`Error en reserva ${reservation.id}: ${error.message}`);
        }
      }

      // CORREGIDO: Detectar tareas duplicadas usando consulta corregida
      if (stats.tasks_created > 0) {
        console.log(`🔍 Verificando tareas duplicadas...`);
        
        try {
          // Obtener todas las tareas en el rango de fechas
          const { data: allTasks, error: tasksError } = await supabase
            .from('tasks')
            .select('date, propiedad_id, property:properties!inner(nombre)')
            .gte('date', startDateStr)
            .lte('date', endDateStr)
            .not('propiedad_id', 'is', null);

          if (tasksError) {
            console.error('❌ Error obteniendo tareas:', tasksError);
            stats.errors.push(`Error obteniendo tareas: ${tasksError.message}`);
          } else if (allTasks && allTasks.length > 0) {
            // Agrupar manualmente para detectar duplicados
            const taskGroups = new Map<string, any[]>();
            
            allTasks.forEach(task => {
              const key = `${task.date}-${task.propiedad_id}`;
              if (!taskGroups.has(key)) {
                taskGroups.set(key, []);
              }
              taskGroups.get(key)!.push(task);
            });

            // Buscar grupos con más de una tarea
            const duplicates = Array.from(taskGroups.entries())
              .filter(([_, tasks]) => tasks.length > 1)
              .map(([key, tasks]) => ({
                date: key.split('-')[0],
                propiedad_id: key.split('-')[1],
                task_count: tasks.length,
                property_name: tasks[0].property?.nombre || 'Desconocida'
              }));

            if (duplicates.length > 0) {
              console.log(`⚠️ TAREAS DUPLICADAS DETECTADAS: ${duplicates.length} grupos`);
              duplicates.forEach(dup => {
                const warningMsg = `DUPLICADO: ${dup.task_count} tareas para ${dup.property_name} el ${dup.date}`;
                console.log(`⚠️ ${warningMsg}`);
                stats.errors.push(warningMsg);
              });
            } else {
              console.log(`✅ No se encontraron tareas duplicadas`);
            }
          }
        } catch (error) {
          console.error('❌ Error en verificación de duplicados:', error);
          stats.errors.push(`Error en verificación de duplicados: ${error.message}`);
        }

        // Ejecutar asignación automática para las nuevas tareas
        console.log(`🤖 Ejecutando asignación automática para ${stats.tasks_created} nuevas tareas...`);
        
        // Obtener las tareas creadas en esta sincronización
        const taskIds = stats.tasks_details?.map(td => td.task_id) || [];
        
        if (taskIds.length > 0) {
          console.log(`🎯 Task IDs para asignación automática:`, taskIds);
          
          try {
            // Llamar al servicio de asignación automática
            const { data: autoAssignResult, error: autoAssignError } = await supabase.functions.invoke('auto-assign-tasks', {
              body: { taskIds }
            });

            if (autoAssignError) {
              console.error('❌ Error en asignación automática:', autoAssignError);
              stats.errors.push(`Error en asignación automática: ${autoAssignError.message}`);
            } else {
              console.log('✅ Asignación automática completada:', autoAssignResult);
              
              // Agregar información de asignación automática a las estadísticas
              if (autoAssignResult?.summary) {
                console.log(`📈 Resumen de asignación automática: ${autoAssignResult.summary.assigned}/${autoAssignResult.summary.total} tareas asignadas`);
              }
            }
          } catch (error) {
            console.error('❌ Error ejecutando asignación automática:', error);
            stats.errors.push(`Error ejecutando asignación automática: ${error.message}`);
          }
        } else {
          console.log('⚠️ No se encontraron task IDs para asignación automática');
        }
      } else {
        console.log('ℹ️ No se crearon nuevas tareas, saltando asignación automática');
      }

      // NUEVO: Generar resumen de cancelaciones
      const cancelledReservations = stats.reservations_details?.filter(r => r.action === 'cancelled') || [];
      let cancellationSummary = '';
      
      if (cancelledReservations.length > 0) {
        console.log(`📋 RESUMEN DE CANCELACIONES: ${cancelledReservations.length} reservas canceladas`);
        cancelledReservations.forEach(reservation => {
          const summaryLine = `- ${reservation.property_name} (${reservation.departure_date}): ${reservation.guest_name}`;
          console.log(`❌ ${summaryLine}`);
          cancellationSummary += summaryLine + '\n';
        });
      } else {
        console.log('✅ No hubo cancelaciones en esta sincronización');
        cancellationSummary = 'No hubo cancelaciones';
      }

      // Actualizar log con resultados exitosos
      await supabase
        .from('hostaway_sync_logs')
        .update({
          sync_completed_at: new Date().toISOString(),
          status: 'completed',
          ...stats
        })
        .eq('id', syncLog.id);

      console.log('✅ Sincronización CORREGIDA completada exitosamente');
      console.log(`📊 Estadísticas finales:`, stats);

      return new Response(JSON.stringify({
        success: true,
        message: 'Sincronización corregida completada exitosamente',
        stats,
        cancellationSummary,
        optimization: {
          dateRange: `${startDateStr} a ${endDateStr}`,
          totalReservations: reservations.length,
          corrections: [
            'Solo búsqueda por departureDate (fecha de salida)',
            'Rango optimizado: HOY + 14 días (sin días pasados)',
            'Detección manual de tareas duplicadas (corregida)',
            'Resumen detallado de cancelaciones'
          ]
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });

    } catch (error) {
      console.error('❌ Error durante la sincronización:', error);
      stats.errors.push(`Error general: ${error.message}`);

      // Actualizar log con error
      await supabase
        .from('hostaway_sync_logs')
        .update({
          sync_completed_at: new Date().toISOString(),
          status: 'error',
          ...stats
        })
        .eq('id', syncLog.id);

      return new Response(JSON.stringify({
        success: false,
        error: error.message,
        stats
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

  } catch (error) {
    console.error('❌ Error crítico:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
