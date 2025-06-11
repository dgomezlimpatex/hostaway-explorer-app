
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { HostawayReservation } from './types.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function findPropertyByHostawayId(listingMapId: number) {
  console.log(`🔍 Buscando propiedad con hostaway_listing_id: ${listingMapId}`);
  
  const { data: property, error } = await supabase
    .from('properties')
    .select('*')
    .eq('hostaway_listing_id', listingMapId)
    .single();
  
  if (error) {
    console.log(`❌ Error buscando propiedad por hostaway_listing_id ${listingMapId}:`, error);
    return null;
  }
  
  if (property) {
    console.log(`✅ Propiedad encontrada: ${property.nombre} (ID: ${property.id})`);
  } else {
    console.log(`❌ No se encontró propiedad con hostaway_listing_id: ${listingMapId}`);
  }
  
  return property;
}

export async function createTaskForReservation(reservation: HostawayReservation, property: any) {
  console.log(`📋 Creando tarea para reserva ${reservation.id} en propiedad ${property.nombre}`);
  console.log(`📋 Fecha de salida: ${reservation.departureDate}`);
  console.log(`📋 Duración del servicio: ${property.duracion_servicio} minutos`);
  
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

  console.log(`📋 Datos de la tarea a crear:`, taskData);

  const { data: task, error } = await supabase
    .from('tasks')
    .insert(taskData)
    .select()
    .single();

  if (error) {
    console.error('❌ Error creando tarea:', error);
    throw error;
  }

  console.log(`✅ Tarea creada exitosamente: ${task.id}`);
  return task;
}

export async function getPropertiesWithHostaway() {
  const { data: propertiesWithHostaway, error: propError } = await supabase
    .from('properties')
    .select('id, nombre, hostaway_listing_id')
    .not('hostaway_listing_id', 'is', null);

  if (propError) {
    console.error('❌ Error obteniendo propiedades:', propError);
  } else {
    console.log(`📊 Propiedades con hostaway_listing_id: ${propertiesWithHostaway?.length || 0}`);
    propertiesWithHostaway?.forEach(prop => {
      console.log(`  - ${prop.nombre}: hostaway_listing_id = ${prop.hostaway_listing_id}`);
    });
  }

  return { data: propertiesWithHostaway, error: propError };
}

export async function createSyncLog() {
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

  return syncLog;
}

export async function updateSyncLog(syncLogId: string, updates: any) {
  await supabase
    .from('hostaway_sync_logs')
    .update(updates)
    .eq('id', syncLogId);
}

export async function getExistingReservation(reservationId: number) {
  const { data: existingReservation } = await supabase
    .from('hostaway_reservations')
    .select('*, tasks(*)')
    .eq('hostaway_reservation_id', reservationId)
    .single();

  return existingReservation;
}

export async function insertReservation(reservationData: any) {
  return await supabase
    .from('hostaway_reservations')
    .insert(reservationData);
}

export async function updateReservation(reservationId: string, reservationData: any) {
  return await supabase
    .from('hostaway_reservations')
    .update(reservationData)
    .eq('id', reservationId);
}

export async function deleteTask(taskId: string) {
  return await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId);
}
