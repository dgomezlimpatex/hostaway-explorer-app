import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { AvantioReservation } from './types.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Buscar propiedad por ID de Avantio o nombre
 */
export async function findPropertyByAvantioId(accommodationId: string, accommodationName?: string) {
  console.log(`🔍 Buscando propiedad con avantio_accommodation_id: ${accommodationId}`);
  
  // Primer intento: buscar por avantio_accommodation_id
  const { data: property, error } = await supabase
    .from('properties')
    .select('*')
    .eq('avantio_accommodation_id', accommodationId)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.log(`❌ Error buscando propiedad por avantio_accommodation_id ${accommodationId}:`, error);
    return null;
  }
  
  if (property) {
    console.log(`✅ Propiedad encontrada por ID: ${property.nombre} (ID: ${property.id})`);
    return property;
  }
  
  // Fallback: buscar por nombre si se proporciona
  if (accommodationName) {
    console.log(`🔄 Fallback: buscando propiedad por nombre: "${accommodationName}"`);
    
    const { data: propertiesByName, error: nameError } = await supabase
      .from('properties')
      .select('*')
      .ilike('nombre', `%${accommodationName}%`);
    
    if (nameError) {
      console.log(`❌ Error buscando propiedad por nombre:`, nameError);
      return null;
    }
    
    if (propertiesByName && propertiesByName.length > 0) {
      const foundProperty = propertiesByName[0];
      console.log(`✅ Propiedad encontrada por nombre: ${foundProperty.nombre} (ID: ${foundProperty.id})`);
      console.log(`📝 Recomendación: actualizar avantio_accommodation_id a ${accommodationId} para esta propiedad`);
      return foundProperty;
    }
  }
  
  console.log(`❌ No se encontró propiedad con avantio_accommodation_id: ${accommodationId} ni por nombre: ${accommodationName || 'N/A'}`);
  return null;
}

/**
 * Validar que propiedad y cliente existen
 */
export async function validatePropertyAndClient(propertyId: string, clientId: string): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  const { data: property, error: propError } = await supabase
    .from('properties')
    .select('id, nombre')
    .eq('id', propertyId)
    .single();
    
  if (propError || !property) {
    errors.push(`Propiedad con ID ${propertyId} no existe`);
  }
  
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

/**
 * Crear tarea para una reserva
 * La limpieza se programa para el día del checkout
 */
export async function createTaskForReservation(reservation: AvantioReservation, property: any) {
  console.log(`📋 Creando tarea para reserva ${reservation.id} en propiedad ${property.nombre}`);
  console.log(`📋 Fecha de salida (checkout): ${reservation.departureDate}`);
  console.log(`📋 Huésped: ${reservation.guestName}`);
  
  // Validar integridad referencial
  const validation = await validatePropertyAndClient(property.id, property.cliente_id);
  if (!validation.valid) {
    throw new Error(`Validación fallida: ${validation.errors.join(', ')}`);
  }
  
  // Calcular horarios basados en la propiedad
  const startTime = '11:00';
  const durationMinutes = property.duracion_servicio || 60;
  const endHour = 11 + Math.floor(durationMinutes / 60);
  const endMinute = durationMinutes % 60;
  const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;

  const taskData = {
    property: property.nombre,
    address: property.direccion,
    date: reservation.departureDate, // La tarea es el día del checkout
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
    sede_id: property.sede_id,
    cleaner: null, // Tarea sin asignar
    cleaner_id: null,
    background_color: '#10B981', // Verde para distinguir de Hostaway
    notas: `Reserva Avantio: ${reservation.guestName}`
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

/**
 * Obtener reserva existente
 */
export async function getExistingReservation(reservationId: string) {
  const { data: existingReservation } = await supabase
    .from('avantio_reservations')
    .select('*, tasks(*)')
    .eq('avantio_reservation_id', reservationId)
    .single();

  return existingReservation;
}

/**
 * Insertar nueva reserva
 */
export async function insertReservation(reservationData: any) {
  if (reservationData.property_id && reservationData.cliente_id) {
    const validation = await validatePropertyAndClient(reservationData.property_id, reservationData.cliente_id);
    if (!validation.valid) {
      throw new Error(`Validación de integridad fallida: ${validation.errors.join(', ')}`);
    }
  }
  
  return await supabase
    .from('avantio_reservations')
    .insert(reservationData);
}

/**
 * Actualizar reserva existente
 */
export async function updateReservation(reservationId: string, reservationData: any) {
  if (reservationData.property_id && reservationData.cliente_id) {
    const validation = await validatePropertyAndClient(reservationData.property_id, reservationData.cliente_id);
    if (!validation.valid) {
      throw new Error(`Validación de integridad fallida: ${validation.errors.join(', ')}`);
    }
  }
  
  return await supabase
    .from('avantio_reservations')
    .update(reservationData)
    .eq('id', reservationId);
}

/**
 * Eliminar tarea
 */
export async function deleteTask(taskId: string) {
  return await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId);
}

/**
 * Actualizar fecha de tarea
 */
export async function updateTaskDate(taskId: string, newDate: string) {
  console.log(`📅 Actualizando fecha de tarea ${taskId} a ${newDate}`);
  
  const { data: originalTask, error: originalError } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .single();

  if (originalError) {
    console.error('❌ Error obteniendo tarea original:', originalError);
    throw originalError;
  }

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

  // Enviar notificación si hay limpiador asignado
  if (originalTask.cleaner_id && originalTask.date !== newDate) {
    console.log(`📧 Enviando email de cambio de horario por sincronización Avantio`);
    try {
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
            reason: 'Actualización automática por cambio en reserva Avantio'
          }
        });
        console.log(`✅ Email de cambio de horario enviado a ${cleaner.name}`);
      }
    } catch (emailError) {
      console.error(`❌ Error enviando email de cambio de horario:`, emailError);
    }
  }

  console.log(`✅ Fecha de tarea actualizada exitosamente: ${task.id} -> ${task.date}`);
  return task;
}

/**
 * Crear log de sincronización
 */
export async function createSyncLog() {
  const { data: syncLog, error: logError } = await supabase
    .from('avantio_sync_logs')
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

/**
 * Actualizar log de sincronización
 */
export async function updateSyncLog(syncLogId: string, updates: any) {
  await supabase
    .from('avantio_sync_logs')
    .update(updates)
    .eq('id', syncLogId);
}
