import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { Resend } from "npm:resend@2.0.0";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const resendApiKey = Deno.env.get('RESEND_API_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const resend = new Resend(resendApiKey);

// Configuración Hostaway
const HOSTAWAY_ACCOUNT_ID = 80687;
const HOSTAWAY_API_BASE = 'https://api.hostaway.com/v1';

interface HostawayReservation {
  id: number;
  listingMapId: number;
  arrivalDate: string;
  departureDate: string;
  reservationDate: string;
  cancellationDate?: string;
  nights: number;
  status: string;
  guestName: string;
  adults: number;
}

interface HostawayProperty {
  id: number;
  internalName: string;
  listingMapId: number;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getHostawayToken(): Promise<string> {
  console.log('Obteniendo token de Hostaway...');
  
  // En producción, estos valores deberían venir de secrets de Supabase
  // Por ahora usamos valores de ejemplo que el usuario deberá configurar
  const clientId = Deno.env.get('HOSTAWAY_CLIENT_ID');
  const clientSecret = Deno.env.get('HOSTAWAY_CLIENT_SECRET');
  
  if (!clientId || !clientSecret) {
    throw new Error('Credenciales de Hostaway no configuradas');
  }

  const response = await fetch(`${HOSTAWAY_API_BASE}/accessTokens`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'general',
    }),
  });

  if (!response.ok) {
    throw new Error(`Error obteniendo token: ${response.statusText}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function fetchHostawayReservations(token: string, startDate: string, endDate: string): Promise<HostawayReservation[]> {
  console.log(`Obteniendo reservas de Hostaway desde ${startDate} hasta ${endDate}`);
  
  const url = new URL(`${HOSTAWAY_API_BASE}/reservations`);
  url.searchParams.append('accountId', HOSTAWAY_ACCOUNT_ID.toString());
  url.searchParams.append('arrivalStartDate', startDate);
  url.searchParams.append('arrivalEndDate', endDate);
  url.searchParams.append('includeResolved', 'true');
  url.searchParams.append('limit', '100');

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Error obteniendo reservas: ${response.statusText}`);
  }

  const data = await response.json();
  return data.result || [];
}

async function fetchHostawayProperties(token: string): Promise<HostawayProperty[]> {
  console.log('Obteniendo propiedades de Hostaway...');
  
  const url = new URL(`${HOSTAWAY_API_BASE}/listings`);
  url.searchParams.append('accountId', HOSTAWAY_ACCOUNT_ID.toString());

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Error obteniendo propiedades: ${response.statusText}`);
  }

  const data = await response.json();
  return data.result || [];
}

async function findPropertyByHostawayId(listingMapId: number) {
  const { data: property } = await supabase
    .from('properties')
    .select('*')
    .eq('hostaway_listing_id', listingMapId)
    .single();
  
  return property;
}

async function createTaskForReservation(reservation: HostawayReservation, property: any) {
  console.log(`Creando tarea para reserva ${reservation.id} en propiedad ${property.nombre}`);
  
  // Calcular hora de fin basada en la duración del servicio de la propiedad
  const startTime = '11:00';
  const durationMinutes = property.duracion_servicio || 60;
  const endHour = 11 + Math.floor(durationMinutes / 60);
  const endMinute = durationMinutes % 60;
  const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;

  const taskData = {
    property: property.nombre,
    address: property.direccion,
    date: reservation.departureDate,
    start_time: startTime,
    end_time: endTime,
    check_in: property.check_in_predeterminado,
    check_out: property.check_out_predeterminado,
    type: 'mantenimiento-airbnb',
    status: 'pending',
    duracion: property.duracion_servicio,
    coste: property.coste_servicio,
    propiedad_id: property.id,
    cliente_id: property.cliente_id,
    cleaner: null,
    cleaner_id: null,
    background_color: '#3B82F6'
  };

  const { data: task, error } = await supabase
    .from('tasks')
    .insert(taskData)
    .select()
    .single();

  if (error) {
    console.error('Error creando tarea:', error);
    throw error;
  }

  return task;
}

async function syncReservations() {
  const syncId = crypto.randomUUID();
  console.log(`Iniciando sincronización ${syncId}`);

  // Crear log de sincronización
  const { data: syncLog, error: logError } = await supabase
    .from('hostaway_sync_logs')
    .insert({
      sync_started_at: new Date().toISOString(),
      status: 'running'
    })
    .select()
    .single();

  if (logError) {
    console.error('Error creando log de sincronización:', logError);
    throw logError;
  }

  let stats = {
    reservations_processed: 0,
    new_reservations: 0,
    updated_reservations: 0,
    cancelled_reservations: 0,
    tasks_created: 0,
    errors: [] as string[]
  };

  try {
    const token = await getHostawayToken();
    
    // Sincronizar desde hace 7 días hasta dentro de 30 días
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);

    const reservations = await fetchHostawayReservations(
      token,
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );

    console.log(`Procesando ${reservations.length} reservas de Hostaway`);

    for (const reservation of reservations) {
      try {
        stats.reservations_processed++;

        // Buscar si ya existe esta reserva
        const { data: existingReservation } = await supabase
          .from('hostaway_reservations')
          .select('*, tasks(*)')
          .eq('hostaway_reservation_id', reservation.id)
          .single();

        // Buscar la propiedad correspondiente
        const property = await findPropertyByHostawayId(reservation.listingMapId);
        
        if (!property) {
          console.warn(`Propiedad no encontrada para listingMapId: ${reservation.listingMapId}`);
          stats.errors.push(`Propiedad no encontrada para listingMapId: ${reservation.listingMapId}`);
          continue;
        }

        const reservationData = {
          hostaway_reservation_id: reservation.id,
          property_id: property.id,
          cliente_id: property.cliente_id,
          arrival_date: reservation.arrivalDate,
          departure_date: reservation.departureDate,
          reservation_date: reservation.reservationDate,
          cancellation_date: reservation.cancellationDate || null,
          nights: reservation.nights,
          status: reservation.status,
          adults: reservation.adults,
          last_sync_at: new Date().toISOString()
        };

        if (!existingReservation) {
          // Nueva reserva
          console.log(`Nueva reserva encontrada: ${reservation.id}`);
          
          let taskId = null;
          
          // Solo crear tarea si la reserva está activa (no cancelada)
          if (reservation.status !== 'cancelled' && reservation.status !== 'inquiry') {
            try {
              const task = await createTaskForReservation(reservation, property);
              taskId = task.id;
              stats.tasks_created++;
            } catch (error) {
              console.error(`Error creando tarea para reserva ${reservation.id}:`, error);
              stats.errors.push(`Error creando tarea para reserva ${reservation.id}: ${error.message}`);
            }
          }

          await supabase
            .from('hostaway_reservations')
            .insert({
              ...reservationData,
              task_id: taskId
            });

          stats.new_reservations++;
        } else {
          // Reserva existente - verificar cambios
          const hasChanges = 
            existingReservation.status !== reservation.status ||
            existingReservation.departure_date !== reservation.departureDate ||
            existingReservation.cancellation_date !== (reservation.cancellationDate || null);

          if (hasChanges) {
            console.log(`Cambios detectados en reserva: ${reservation.id}`);

            // Verificar si fue cancelada
            if (reservation.status === 'cancelled' && existingReservation.status !== 'cancelled') {
              console.log(`Reserva cancelada: ${reservation.id}`);
              stats.cancelled_reservations++;

              // Eliminar tarea asociada si existe
              if (existingReservation.task_id) {
                await supabase
                  .from('tasks')
                  .delete()
                  .eq('id', existingReservation.task_id);
              }

              // Enviar email de cancelación
              try {
                await sendCancellationEmail(reservation, property);
              } catch (error) {
                console.error('Error enviando email de cancelación:', error);
                stats.errors.push(`Error enviando email de cancelación: ${error.message}`);
              }
            }

            // Actualizar reserva
            await supabase
              .from('hostaway_reservations')
              .update(reservationData)
              .eq('id', existingReservation.id);

            stats.updated_reservations++;
          }
        }
      } catch (error) {
        console.error(`Error procesando reserva ${reservation.id}:`, error);
        stats.errors.push(`Error procesando reserva ${reservation.id}: ${error.message}`);
      }
    }

    // Actualizar log de sincronización
    await supabase
      .from('hostaway_sync_logs')
      .update({
        sync_completed_at: new Date().toISOString(),
        status: 'completed',
        ...stats
      })
      .eq('id', syncLog.id);

    // Enviar email resumen
    await sendSyncSummaryEmail(stats);

    console.log(`Sincronización ${syncId} completada:`, stats);
    return { success: true, stats };

  } catch (error) {
    console.error(`Error en sincronización ${syncId}:`, error);
    
    // Actualizar log con error
    await supabase
      .from('hostaway_sync_logs')
      .update({
        sync_completed_at: new Date().toISOString(),
        status: 'failed',
        ...stats,
        errors: [...stats.errors, error.message]
      })
      .eq('id', syncLog.id);

    throw error;
  }
}

async function sendCancellationEmail(reservation: HostawayReservation, property: any) {
  const emailData = {
    from: 'Sistema de Gestión <noreply@limpatex.com>',
    to: ['dgomezlimpatex@gmail.com'],
    subject: '🚨 Cancelación de Reserva - Hostaway',
    html: `
      <h2>Cancelación de Reserva</h2>
      <p><strong>Propiedad:</strong> ${property.nombre}</p>
      <p><strong>Dirección:</strong> ${property.direccion}</p>
      <p><strong>Reserva ID:</strong> ${reservation.id}</p>
      <p><strong>Fecha de llegada:</strong> ${reservation.arrivalDate}</p>
      <p><strong>Fecha de salida:</strong> ${reservation.departureDate}</p>
      <p><strong>Huésped:</strong> ${reservation.guestName}</p>
      <p><strong>Fecha de cancelación:</strong> ${reservation.cancellationDate}</p>
      
      <p>La tarea de limpieza asociada ha sido eliminada automáticamente.</p>
    `,
  };

  await resend.emails.send(emailData);
}

async function sendSyncSummaryEmail(stats: any) {
  // Solo enviar si hay cambios significativos
  if (stats.new_reservations === 0 && stats.updated_reservations === 0 && stats.cancelled_reservations === 0) {
    console.log('No hay cambios significativos, omitiendo email resumen');
    return;
  }

  const emailData = {
    from: 'Sistema de Gestión <noreply@limpatex.com>',
    to: ['dgomezlimpatex@gmail.com'],
    subject: '📊 Resumen de Sincronización - Hostaway',
    html: `
      <h2>Resumen de Sincronización</h2>
      <p><strong>Fecha:</strong> ${new Date().toLocaleString()}</p>
      
      <h3>Estadísticas:</h3>
      <ul>
        <li><strong>Reservas procesadas:</strong> ${stats.reservations_processed}</li>
        <li><strong>Nuevas reservas:</strong> ${stats.new_reservations}</li>
        <li><strong>Reservas actualizadas:</strong> ${stats.updated_reservations}</li>
        <li><strong>Reservas canceladas:</strong> ${stats.cancelled_reservations}</li>
        <li><strong>Tareas creadas:</strong> ${stats.tasks_created}</li>
      </ul>
      
      ${stats.errors.length > 0 ? `
        <h3>Errores:</h3>
        <ul>
          ${stats.errors.map(error => `<li>${error}</li>`).join('')}
        </ul>
      ` : '<p>✅ No se encontraron errores</p>'}
    `,
  };

  await resend.emails.send(emailData);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Iniciando sincronización con Hostaway...');
    const result = await syncReservations();
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error('Error en la sincronización:', error);
    
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
