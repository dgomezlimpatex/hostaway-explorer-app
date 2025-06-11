
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
    
    console.log(`📅 Rango de búsqueda: desde ${today} hasta ${endDate} (14 días desde hoy)`);

    // Obtener reservas para los próximos 14 días
    const reservations = await fetchAllHostawayReservations(token, today, endDate);

    console.log(`📊 Total de reservas obtenidas para los próximos 14 días: ${reservations.length}`);

    // Filtrar reservas para mañana para debugging específico
    const tomorrowReservations = reservations.filter(r => 
      r.departureDate === tomorrow || r.arrivalDate === tomorrow
    );
    console.log(`📅 Reservas para mañana (${tomorrow}): ${tomorrowReservations.length}`);
    tomorrowReservations.forEach(r => {
      console.log(`  - Reserva ${r.id}: llegada ${r.arrivalDate}, salida ${r.departureDate}, listingMapId: ${r.listingMapId}, status: ${r.status}, guest: ${r.guestName}`);
    });

    // Buscar reservas de propiedades específicas mencionadas
    const targetProperties = [
      'Downtown La Torre Penthouse',
      'Metropolitan Boutique Studio 3', 
      'Main Street Deluxe Apartment 1B'
    ];
    
    console.log(`🔍 Buscando reservas de propiedades específicas para mañana...`);
    const targetReservations = reservations.filter(r => 
      r.departureDate === tomorrow && 
      targetProperties.some(prop => r.guestName?.includes(prop) || String(r.listingMapId).includes('258'))
    );
    console.log(`🎯 Reservas de propiedades objetivo encontradas: ${targetReservations.length}`);

    // Filtrar y mostrar todas las reservas para hoy y mañana
    const todayAndTomorrowReservations = reservations.filter(r => 
      r.departureDate === today || r.departureDate === tomorrow ||
      r.arrivalDate === today || r.arrivalDate === tomorrow
    );
    console.log(`📋 Reservas para hoy y mañana (${today} y ${tomorrow}): ${todayAndTomorrowReservations.length}`);
    todayAndTomorrowReservations.forEach(r => {
      console.log(`  📍 Reserva ${r.id}: ${r.arrivalDate} → ${r.departureDate}, listing: ${r.listingMapId}, status: ${r.status}, guest: ${r.guestName}`);
    });

    for (const [index, reservation] of reservations.entries()) {
      try {
        stats.reservations_processed++;
        await processReservation(reservation, stats, index, reservations.length);
      } catch (error) {
        const errorMsg = `Error procesando reserva ${reservation.id}: ${error.message}`;
        console.error(`❌ ${errorMsg}`);
        stats.errors.push(errorMsg);
      }
    }

    // Actualizar log de sincronización
    await updateSyncLog(syncLog.id, {
      sync_completed_at: new Date().toISOString(),
      status: 'completed',
      ...stats
    });

    // Enviar email resumen
    await sendSyncSummaryEmail(stats);

    console.log(`🎉 Sincronización ${syncId} completada:`, stats);
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
