import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { HostawayReservation } from './types.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function findPropertyByHostawayId(listingMapId: number, listingName?: string) {
  console.log(`🔍 Buscando propiedad con hostaway_listing_id: ${listingMapId}`);
  
  // Primer intento: buscar por hostaway_listing_id
  const { data: property, error } = await supabase
    .from('properties')
    .select('*')
    .eq('hostaway_listing_id', listingMapId)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.log(`❌ Error buscando propiedad por hostaway_listing_id ${listingMapId}:`, error);
    return null;
  }
  
  if (property) {
    console.log(`✅ Propiedad encontrada por ID: ${property.nombre} (ID: ${property.id})`);
    return property;
  }
  
  // Fallback: buscar por nombre si se proporciona
  if (listingName) {
    console.log(`🔄 Fallback: buscando propiedad por nombre: "${listingName}"`);
    
    const { data: propertiesByName, error: nameError } = await supabase
      .from('properties')
      .select('*')
      .ilike('nombre', `%${listingName}%`);
    
    if (nameError) {
      console.log(`❌ Error buscando propiedad por nombre:`, nameError);
      return null;
    }
    
    if (propertiesByName && propertiesByName.length > 0) {
      const foundProperty = propertiesByName[0];
      console.log(`✅ Propiedad encontrada por nombre: ${foundProperty.nombre} (ID: ${foundProperty.id})`);
      console.log(`📝 Recomendación: actualizar hostaway_listing_id a ${listingMapId} para esta propiedad`);
      return foundProperty;
    }
  }
  
  console.log(`❌ No se encontró propiedad con hostaway_listing_id: ${listingMapId} ni por nombre: ${listingName || 'N/A'}`);
  return null;
}

export async function validatePropertyAndClient(propertyId: string, clientId: string): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  // Validar que la propiedad existe
  const { data: property, error: propError } = await supabase
    .from('properties')
    .select('id, nombre')
    .eq('id', propertyId)
    .single();
    
  if (propError || !property) {
    errors.push(`Propiedad con ID ${propertyId} no existe`);
  }
  
  // Validar que el cliente existe
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, nombre')
    .eq('id', clientId)
    .single();
    
  if (clientError || !client) {
    errors.push(`Cliente con ID ${clientId} no existe`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export async function createTaskForReservation(reservation: HostawayReservation, property: any) {
  console.log(`📋 Creando tarea para reserva ${reservation.id} en propiedad ${property.nombre}`);
  console.log(`📋 Fecha de salida: ${reservation.departureDate}`);
  console.log(`📋 Duración del servicio: ${property.duracion_servicio} minutos`);
  
  // Validar integridad referencial antes de crear la tarea
  const validation = await validatePropertyAndClient(property.id, property.cliente_id);
  if (!validation.valid) {
    throw new Error(`Validación fallida: ${validation.errors.join(', ')}`);
  }
  
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

  console.log(`✅ Tarea creada exitosamente: ${task.id} para fecha ${task.date}`);
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
  // Validar integridad referencial antes de insertar
  if (reservationData.property_id && reservationData.cliente_id) {
    const validation = await validatePropertyAndClient(reservationData.property_id, reservationData.cliente_id);
    if (!validation.valid) {
      throw new Error(`Validación de integridad fallida: ${validation.errors.join(', ')}`);
    }
  }
  
  return await supabase
    .from('hostaway_reservations')
    .insert(reservationData);
}

export async function updateReservation(reservationId: string, reservationData: any) {
  // Validar integridad referencial antes de actualizar
  if (reservationData.property_id && reservationData.cliente_id) {
    const validation = await validatePropertyAndClient(reservationData.property_id, reservationData.cliente_id);
    if (!validation.valid) {
      throw new Error(`Validación de integridad fallida: ${validation.errors.join(', ')}`);
    }
  }
  
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

export async function updateTaskDate(taskId: string, newDate: string) {
  console.log(`📅 Actualizando fecha de tarea ${taskId} a ${newDate}`);
  
  // Primero obtener la tarea original para comparar
  const { data: originalTask, error: originalError } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .single();

  if (originalError) {
    console.error('❌ Error obteniendo tarea original:', originalError);
    throw originalError;
  }

  // Actualizar solo la fecha sin disparar notificaciones automáticas
  const { data: task, error } = await supabase
    .from('tasks')
    .update({ 
      date: newDate,
      updated_at: new Date().toISOString()
    })
    .eq('id', taskId)
    .select()
    .single();

  if (error) {
    console.error('❌ Error actualizando fecha de tarea:', error);
    throw error;
  }

  // Solo enviar email de cambio de horario si la tarea tiene limpiador asignado
  // y es una actualización de Hostaway (no una cancelación)
  if (originalTask.cleaner_id && originalTask.date !== newDate) {
    console.log(`📧 Enviando email de cambio de horario por sincronización Hostaway`);
    try {
      // Obtener información del limpiador
      const { data: cleaner, error: cleanerError } = await supabase
        .from('cleaners')
        .select('email, name')
        .eq('id', originalTask.cleaner_id)
        .single();

      if (!cleanerError && cleaner) {
        await supabase.functions.invoke('send-task-schedule-change-email', {
          body: {
            taskId: task.id,
            taskDate: task.date,
            taskStartTime: task.start_time,
            taskEndTime: task.end_time,
            propertyName: task.property,
            propertyAddress: task.address,
            cleanerName: cleaner.name,
            cleanerEmail: cleaner.email,
            originalDate: originalTask.date,
            originalStartTime: originalTask.start_time,
            originalEndTime: originalTask.end_time,
            reason: 'Actualización automática por cambio en reserva Hostaway'
          }
        });
        console.log(`✅ Email de cambio de horario enviado a ${cleaner.name}`);
      }
    } catch (emailError) {
      console.error(`❌ Error enviando email de cambio de horario:`, emailError);
      // No falla la operación si el email no se puede enviar
    }
  }

  console.log(`✅ Fecha de tarea actualizada exitosamente: ${task.id} -> ${task.date}`);
  return task;
}
