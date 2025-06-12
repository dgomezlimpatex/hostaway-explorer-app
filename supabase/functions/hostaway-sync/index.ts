
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getHostawayToken, fetchAllHostawayReservations } from './hostaway-api.ts';
import { getPropertiesWithHostaway, createSyncLog, updateSyncLog } from './database-operations.ts';
import { sendSyncSummaryEmail } from './email-service.ts';
import { getDateRange, logDateInfo } from './date-utils.ts';
import { processReservation } from './reservation-processor.ts';
import { SyncStats } from './types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function syncReservations() {
  const syncId = crypto.randomUUID();
  console.log(`🚀 Iniciando sincronización ${syncId}`);

  const { today, tomorrow, endDate, madridTime } = getDateRange();
  logDateInfo(today, tomorrow, madridTime);

  // Verificar cuántas propiedades tienen hostaway_listing_id
  await getPropertiesWithHostaway();

  // Crear log de sincronización
  const syncLog = await createSyncLog();

  let stats: SyncStats = {
    reservations_processed: 0,
    new_reservations: 0,
    updated_reservations: 0,
    cancelled_reservations: 0,
    tasks_created: 0,
    errors: []
  };

  try {
    const token = await getHostawayToken();
    
    console.log(`📅 RANGO DE BÚSQUEDA MEJORADO: desde ${today} hasta ${endDate} (30 días desde hoy)`);
    console.log(`🎯 Nota: Se buscarán reservas tanto por fecha de llegada como de salida para capturar todas las posibles`);

    // Obtener reservas para los próximos 30 días (mejorado para capturar tanto llegadas como salidas)
    const reservations = await fetchAllHostawayReservations(token, today, endDate);

    console.log(`📊 TOTAL DE RESERVAS OBTENIDAS: ${reservations.length}`);

    // Análisis detallado para el sábado 14 de junio (día mencionado por el usuario)
    const saturdayReservations = reservations.filter(r => 
      r.departureDate === '2025-06-14' || r.arrivalDate === '2025-06-14'
    );
    console.log(`🎯 ANÁLISIS ESPECÍFICO PARA SÁBADO 14/06/2025:`);
    console.log(`   - Total reservas encontradas: ${saturdayReservations.length}`);
    console.log(`   - Detalle por status:`);
    
    const statusCount = {};
    saturdayReservations.forEach(r => {
      statusCount[r.status] = (statusCount[r.status] || 0) + 1;
      console.log(`     • ${r.id}: ${r.status} | ${r.arrivalDate} → ${r.departureDate} | ${r.listingMapId} | ${r.guestName}`);
    });
    
    Object.entries(statusCount).forEach(([status, count]) => {
      console.log(`   - ${status}: ${count} reservas`);
    });

    // Filtrar reservas para mañana para debugging específico
    const tomorrowReservations = reservations.filter(r => 
      r.departureDate === tomorrow || r.arrivalDate === tomorrow
    );
    console.log(`📅 Reservas para mañana (${tomorrow}): ${tomorrowReservations.length}`);
    tomorrowReservations.forEach(r => {
      console.log(`  - Reserva ${r.id}: llegada ${r.arrivalDate}, salida ${r.departureDate}, listingMapId: ${r.listingMapId}, status: ${r.status}, guest: ${r.guestName}`);
    });

    // Filtrar y mostrar todas las reservas para hoy y mañana
    const todayAndTomorrowReservations = reservations.filter(r => 
      r.departureDate === today || r.departureDate === tomorrow ||
      r.arrivalDate === today || r.arrivalDate === tomorrow
    );
    console.log(`📋 Reservas para hoy y mañana (${today} y ${tomorrow}): ${todayAndTomorrowReservations.length}`);
    todayAndTomorrowReservations.forEach(r => {
      console.log(`  📍 Reserva ${r.id}: ${r.arrivalDate} → ${r.departureDate}, listing: ${r.listingMapId}, status: ${r.status}, guest: ${r.guestName}`);
    });

    // Procesar todas las reservas
    console.log(`🔄 INICIANDO PROCESAMIENTO DE ${reservations.length} RESERVAS...`);
    let tasksCreatedCount = 0;
    for (const [index, reservation] of reservations.entries()) {
      try {
        const statsBefore = { ...stats };
        stats.reservations_processed++;
        await processReservation(reservation, stats, index, reservations.length);
        
        // Contabilizar si se creó una tarea
        if (stats.tasks_created > statsBefore.tasks_created) {
          tasksCreatedCount++;
          console.log(`✅ Tarea #${tasksCreatedCount} creada para reserva ${reservation.id}`);
        }
      } catch (error) {
        const errorMsg = `Error procesando reserva ${reservation.id}: ${error.message}`;
        console.error(`❌ ${errorMsg}`);
        stats.errors.push(errorMsg);
      }
    }

    // Resumen final con enfoque en el sábado 14
    console.log(`🎯 RESUMEN FINAL PARA SÁBADO 14/06/2025:`);
    const saturday14Tasks = saturdayReservations.filter(r => {
      const validStatuses = ['confirmed', 'new', 'modified', 'awaiting_payment'];
      return validStatuses.includes(r.status.toLowerCase()) || 
             !['cancelled', 'inquiry', 'declined', 'expired'].includes(r.status.toLowerCase());
    });
    console.log(`   - Reservas que deberían generar tareas: ${saturday14Tasks.length}`);
    saturday14Tasks.forEach(r => {
      console.log(`     • ${r.id} (${r.status}): ${r.guestName} en listing ${r.listingMapId}`);
    });

    // Actualizar log de sincronización
    await updateSyncLog(syncLog.id, {
      sync_completed_at: new Date().toISOString(),
      status: 'completed',
      ...stats
    });

    // Enviar email resumen
    await sendSyncSummaryEmail(stats);

    console.log(`🎉 Sincronización ${syncId} completada:`, stats);
    console.log(`📊 ESTADÍSTICAS FINALES:`);
    console.log(`   - Reservas procesadas: ${stats.reservations_processed}`);
    console.log(`   - Nuevas reservas: ${stats.new_reservations}`);
    console.log(`   - Reservas actualizadas: ${stats.updated_reservations}`);
    console.log(`   - Tareas creadas: ${stats.tasks_created}`);
    console.log(`   - Errores: ${stats.errors.length}`);
    
    return { success: true, stats };

  } catch (error) {
    console.error(`💥 Error en sincronización ${syncId}:`, error);
    
    // Actualizar log con error
    await updateSyncLog(syncLog.id, {
      sync_completed_at: new Date().toISOString(),
      status: 'failed',
      ...stats,
      errors: [...stats.errors, error.message]
    });

    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Iniciando sincronización con Hostaway...');
    const result = await syncReservations();
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error('💥 Error en la sincronización:', error);
    
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }
});
