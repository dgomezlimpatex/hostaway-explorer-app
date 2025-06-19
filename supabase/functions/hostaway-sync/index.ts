
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

    console.log(`🚀 Iniciando sincronización optimizada con Hostaway (Log ID: ${syncLog.id})`);

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

      // OPTIMIZADO: Calcular rango de fechas más pequeño (solo próximas 3 semanas)
      const now = new Date();
      const startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 días atrás
      const endDate = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000); // 21 días adelante (3 semanas)
      
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      // Obtener reservas de Hostaway con rango optimizado
      console.log(`📥 Obteniendo reservas de Hostaway desde ${startDateStr} hasta ${endDateStr} (rango optimizado)...`);
      const reservations = await fetchAllHostawayReservations(accessToken, startDateStr, endDateStr);
      console.log(`📊 Obtenidas ${reservations.length} reservas de Hostaway (rango optimizado vs ~1200+ anteriormente)`);

      // Filtrar reservas relevantes para reducir procesamiento
      const relevantReservations = reservations.filter(reservation => {
        const arrivalDate = new Date(reservation.arrivalDate);
        const departureDate = new Date(reservation.departureDate);
        const cutoffDate = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000); // 3 semanas
        
        // Solo procesar reservas que tienen salida en las próximas 3 semanas o llegada reciente
        return departureDate <= cutoffDate || arrivalDate >= startDate;
      });

      console.log(`🎯 Reservas relevantes a procesar: ${relevantReservations.length} de ${reservations.length} total`);

      // Procesar cada reserva relevante
      for (let i = 0; i < relevantReservations.length; i++) {
        const reservation = relevantReservations[i];
        try {
          await processReservation(reservation, stats, i, relevantReservations.length);
          stats.reservations_processed++;
        } catch (error) {
          console.error(`❌ Error procesando reserva ${reservation.id}:`, error);
          stats.errors.push(`Error en reserva ${reservation.id}: ${error.message}`);
        }
      }

      // Ejecutar asignación automática para las nuevas tareas
      if (stats.tasks_created > 0) {
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

      // Actualizar log con resultados exitosos
      await supabase
        .from('hostaway_sync_logs')
        .update({
          sync_completed_at: new Date().toISOString(),
          status: 'completed',
          ...stats
        })
        .eq('id', syncLog.id);

      console.log('✅ Sincronización optimizada completada exitosamente');
      console.log(`📊 Estadísticas finales:`, stats);

      return new Response(JSON.stringify({
        success: true,
        message: 'Sincronización optimizada completada exitosamente',
        stats,
        optimization: {
          dateRange: `${startDateStr} a ${endDateStr}`,
          totalReservations: reservations.length,
          relevantReservations: relevantReservations.length,
          optimization: 'Reducido de ~90 días a 28 días (3 semanas + 1 semana atrás)'
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
