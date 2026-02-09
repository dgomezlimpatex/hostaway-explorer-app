import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { AvantioReservation } from './types.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Client ID for Turquoise Apartments SL
const TURQUOISE_CLIENT_ID = '669948a6-e5c3-4a73-a151-6ccca5c82adf';

/**
 * Helper: search property by codigo and auto-save avantio_accommodation_id
 */
async function findByCode(code: string, accommodationId?: string, accommodationName?: string) {
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('cliente_id', TURQUOISE_CLIENT_ID)
    .ilike('codigo', code);
  
  if (!error && data && data.length === 1) {
    const prop = data[0];
    console.log(`✅ Propiedad encontrada por código "${code}": ${prop.nombre}`);
    if (accommodationId && !prop.avantio_accommodation_id) {
      await supabase
        .from('properties')
        .update({ avantio_accommodation_id: accommodationId, avantio_accommodation_name: accommodationName })
        .eq('id', prop.id);
      console.log(`📝 avantio_accommodation_id actualizado para ${prop.nombre}`);
    }
    return prop;
  }
  return null;
}

/**
 * Find property by exact match - only Turquoise properties
 * Order: avantio_accommodation_id > exact name > exact code > name as code > strip C prefix
 */
export async function findPropertyByAvantioId(
  accommodationId: string, 
  accommodationName?: string,
  accommodationInternalName?: string
) {
  console.log(`🔍 Buscando propiedad: ID="${accommodationId}", nombre="${accommodationName || 'N/A'}", código="${accommodationInternalName || 'N/A'}"`);
  
  // 1. Search by avantio_accommodation_id (exact)
  if (accommodationId) {
    const { data: property, error } = await supabase
      .from('properties')
      .select('*')
      .eq('avantio_accommodation_id', accommodationId)
      .eq('cliente_id', TURQUOISE_CLIENT_ID)
      .maybeSingle();
    
    if (!error && property) {
      console.log(`✅ Propiedad encontrada por avantio_accommodation_id: ${property.nombre}`);
      return property;
    }
  }
  
  // 2. Search by exact name (case-insensitive, Turquoise only)
  if (accommodationName) {
    const { data: propertiesByName, error: nameError } = await supabase
      .from('properties')
      .select('*')
      .eq('cliente_id', TURQUOISE_CLIENT_ID)
      .ilike('nombre', accommodationName);
    
    if (!nameError && propertiesByName && propertiesByName.length === 1) {
      const foundProperty = propertiesByName[0];
      console.log(`✅ Propiedad encontrada por nombre exacto: ${foundProperty.nombre}`);
      
      // Auto-save avantio_accommodation_id for future lookups
      if (accommodationId && !foundProperty.avantio_accommodation_id) {
        await supabase
          .from('properties')
          .update({ 
            avantio_accommodation_id: accommodationId,
            avantio_accommodation_name: accommodationName 
          })
          .eq('id', foundProperty.id);
        console.log(`📝 avantio_accommodation_id actualizado para ${foundProperty.nombre}`);
      }
      
      return foundProperty;
    }
  }
  
  // 3. Search by exact code (internalName = codigo, Turquoise only)
  if (accommodationInternalName) {
    const found = await findByCode(accommodationInternalName, accommodationId, accommodationName);
    if (found) return found;
  }

  // 4. Try matching accommodationName directly as codigo
  if (accommodationName) {
    const found = await findByCode(accommodationName, accommodationId, accommodationName);
    if (found) return found;
  }

  // 5. Try stripping C prefix (CMD18.5 -> MD18.5)
  if (accommodationName) {
    const strippedCode = accommodationName.replace(/^C/, '');
    if (strippedCode !== accommodationName) {
      const found = await findByCode(strippedCode, accommodationId, accommodationName);
      if (found) return found;
    }
  }
  
  console.log(`❌ No se encontró propiedad: ID="${accommodationId}", nombre="${accommodationName || 'N/A'}", código="${accommodationInternalName || 'N/A'}"`);
  return null;
}

/**
 * Validate that property and client exist
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
  
  return { valid: errors.length === 0, errors };
}

/**
 * Create task for a reservation (cleaning on checkout day)
 */
export function getTaskPropertyName(propertyName: string, propertyCodigo: string, reservationStatus: string): string {
  const baseName = propertyCodigo ? `${propertyCodigo} ${propertyName}` : propertyName;
  const isRequested = reservationStatus.toUpperCase() === 'REQUESTED';
  return isRequested ? `POSIBLE - ${baseName}` : baseName;
}

export async function updateTaskPropertyName(taskId: string, propertyName: string) {
  console.log(`📝 Actualizando nombre de tarea ${taskId} a "${propertyName}"`);
  const { error } = await supabase
    .from('tasks')
    .update({ property: propertyName, updated_at: new Date().toISOString() })
    .eq('id', taskId);
  if (error) {
    console.error('❌ Error actualizando nombre de tarea:', error);
    throw error;
  }
}

export async function createTaskForReservation(reservation: AvantioReservation, property: any) {
  console.log(`📋 Creando tarea para reserva ${reservation.id} en propiedad ${property.nombre}`);
  
  const validation = await validatePropertyAndClient(property.id, property.cliente_id);
  if (!validation.valid) {
    throw new Error(`Validación fallida: ${validation.errors.join(', ')}`);
  }
  
  const startTime = '11:00';
  const durationMinutes = property.duracion_servicio || 60;
  const endHour = 11 + Math.floor(durationMinutes / 60);
  const endMinute = durationMinutes % 60;
  const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;

  const taskPropertyName = getTaskPropertyName(property.nombre, property.codigo, reservation.status);

  const taskData = {
    property: taskPropertyName,
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
    sede_id: property.sede_id,
    cleaner: null,
    cleaner_id: null,
    background_color: '#10B981'
  };

  const { data: task, error } = await supabase
    .from('tasks')
    .insert(taskData)
    .select()
    .single();

  if (error) {
    console.error('❌ Error creando tarea:', error);
    throw error;
  }

  console.log(`✅ Tarea creada: ${task.id} para fecha ${task.date}`);
  return task;
}

/**
 * Get existing reservation by Avantio ID
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
 * Insert new reservation
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
 * Update existing reservation
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
 * Delete task
 */
export async function deleteTask(taskId: string) {
  return await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId);
}

/**
 * Update task date and notify cleaner if assigned
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
    .update({ date: newDate, updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .select()
    .single();

  if (error) {
    console.error('❌ Error actualizando fecha de tarea:', error);
    throw error;
  }

  // Notify cleaner if assigned and date changed
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
      console.error(`❌ Error enviando email de cambio:`, emailError);
    }
  }

  console.log(`✅ Fecha de tarea actualizada: ${task.id} -> ${task.date}`);
  return task;
}

/**
 * Create sync log
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
 * Update sync log
 */
export async function updateSyncLog(syncLogId: string, updates: any) {
  await supabase
    .from('avantio_sync_logs')
    .update(updates)
    .eq('id', syncLogId);
}

/**
 * Log a sync error to avantio_sync_errors table
 */
export async function logSyncError(
  errorType: string,
  errorMessage: string,
  errorDetails?: Record<string, any>,
  syncLogId?: string | null
) {
  try {
    await supabase
      .from('avantio_sync_errors')
      .insert({
        sync_log_id: syncLogId || null,
        error_type: errorType,
        error_message: errorMessage,
        error_details: errorDetails || null,
        resolved: false
      });
    console.log(`📝 Error registrado en avantio_sync_errors: [${errorType}] ${errorMessage}`);
  } catch (err) {
    console.error('❌ Error registrando en avantio_sync_errors:', err);
  }
}
