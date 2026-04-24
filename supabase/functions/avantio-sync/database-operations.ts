import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { AvantioReservation } from './types.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Client ID for Turquoise Apartments SL
const TURQUOISE_CLIENT_ID = '669948a6-e5c3-4a73-a151-6ccca5c82adf';

// In-memory cache of all Turquoise properties, populated once per sync.
// Eliminates thousands of redundant SELECT queries during reservation processing.
let propertiesCache: any[] | null = null;
let cacheById: Map<string, any> = new Map();
let cacheByName: Map<string, any> = new Map();
let cacheByCode: Map<string, any> = new Map();

// In-memory cache of existing avantio_reservations, keyed by avantio_reservation_id.
// Avoids one SELECT query per reservation processed.
let reservationsCache: Map<string, any> = new Map();

// In-memory cache of existing tasks for the sync window, keyed by `${propiedad_id}_${date}`.
// Avoids one SELECT query per new task creation (deduplication check).
let tasksCache: Map<string, any> = new Map();

export async function preloadReservationsAndTasksCache(fromDate: string, toDate: string) {
  console.log('🗄️ Precargando caché de reservas y tareas...');
  reservationsCache.clear();
  tasksCache.clear();

  // Load ALL avantio_reservations in window with pagination (Supabase default limit is 1000).
  // CRITICAL: without pagination, missing rows fall back to per-reservation DB queries → CPU exhaustion.
  const PAGE = 1000;
  let from = 0;
  let totalLoaded = 0;
  while (true) {
    const { data: page, error: rErr } = await supabase
      .from('avantio_reservations')
      .select('*, tasks(*)')
      .gte('departure_date', fromDate)
      .lte('departure_date', toDate)
      .range(from, from + PAGE - 1);

    if (rErr) {
      console.error('❌ Error precargando reservas:', rErr);
      break;
    }
    if (!page || page.length === 0) break;

    for (const r of page) {
      reservationsCache.set(String(r.avantio_reservation_id), r);
    }
    totalLoaded += page.length;
    if (page.length < PAGE) break;
    from += PAGE;
  }

  // Load all green (Avantio) tasks in the sync window for dedup
  const { data: tasks, error: tErr } = await supabase
    .from('tasks')
    .select('id, propiedad_id, date, property')
    .eq('background_color', '#10B981')
    .gte('date', fromDate)
    .lte('date', toDate)
    .neq('status', 'cancelled');

  if (tErr) {
    console.error('❌ Error precargando tareas:', tErr);
  } else if (tasks) {
    for (const t of tasks) {
      if (t.propiedad_id && t.date) {
        tasksCache.set(`${t.propiedad_id}_${t.date}`, t);
      }
    }
  }

  console.log(`✅ Caché reservas/tareas: ${totalLoaded} reservas, ${tasksCache.size} tareas`);
}

export function clearReservationsAndTasksCache() {
  reservationsCache.clear();
  tasksCache.clear();
}

export function getCachedReservation(avantioReservationId: string) {
  return reservationsCache.get(String(avantioReservationId)) || null;
}

/**
 * Preload all Turquoise properties into memory.
 * MUST be called once at the start of each sync to avoid CPU exhaustion.
 */
export async function preloadPropertiesCache() {
  console.log('🗄️ Precargando caché de propiedades...');
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('cliente_id', TURQUOISE_CLIENT_ID);

  if (error) {
    console.error('❌ Error precargando propiedades:', error);
    throw error;
  }

  propertiesCache = data || [];
  cacheById.clear();
  cacheByName.clear();
  cacheByCode.clear();

  for (const prop of propertiesCache) {
    if (prop.avantio_accommodation_id) {
      cacheById.set(String(prop.avantio_accommodation_id), prop);
    }
    if (prop.nombre) {
      cacheByName.set(prop.nombre.toLowerCase().trim(), prop);
    }
    if (prop.codigo) {
      cacheByCode.set(prop.codigo.toLowerCase().trim(), prop);
    }
  }

  console.log(`✅ Caché cargado: ${propertiesCache.length} propiedades (${cacheById.size} con avantio_id, ${cacheByCode.size} con código)`);
}

/**
 * Clear the cache (called at end of sync to free memory).
 */
export function clearPropertiesCache() {
  propertiesCache = null;
  cacheById.clear();
  cacheByName.clear();
  cacheByCode.clear();
}

/**
 * Find property by exact match using IN-MEMORY CACHE.
 * Order: avantio_accommodation_id > exact name > exact code > name as code > strip C prefix
 *
 * NOTE: Cache must be preloaded with preloadPropertiesCache() before calling this.
 * Background updates of avantio_accommodation_id are fire-and-forget to avoid CPU stalls.
 */
export async function findPropertyByAvantioId(
  accommodationId: string,
  accommodationName?: string,
  accommodationInternalName?: string
) {
  if (!propertiesCache) {
    console.warn('⚠️ Caché no precargado, recargando...');
    await preloadPropertiesCache();
  }

  // 1. Search by avantio_accommodation_id (exact)
  if (accommodationId) {
    const prop = cacheById.get(String(accommodationId));
    if (prop) return prop;
  }

  // Helper: persist avantio_accommodation_id in background (fire-and-forget)
  const persistAvantioId = (prop: any, accId: string, accName?: string) => {
    if (!accId || prop.avantio_accommodation_id) return;
    // Update cache immediately
    prop.avantio_accommodation_id = accId;
    cacheById.set(String(accId), prop);
    // Persist to DB in background (non-blocking)
    supabase
      .from('properties')
      .update({ avantio_accommodation_id: accId, avantio_accommodation_name: accName || prop.nombre })
      .eq('id', prop.id)
      .then(() => {})
      .catch((err) => console.error(`❌ Error persistiendo avantio_id para ${prop.nombre}:`, err));
  };

  // 2. Search by exact name (case-insensitive)
  if (accommodationName) {
    const prop = cacheByName.get(accommodationName.toLowerCase().trim());
    if (prop) {
      persistAvantioId(prop, accommodationId, accommodationName);
      return prop;
    }
  }

  // 3. Search by exact code
  if (accommodationInternalName) {
    const prop = cacheByCode.get(accommodationInternalName.toLowerCase().trim());
    if (prop) {
      persistAvantioId(prop, accommodationId, accommodationName);
      return prop;
    }
  }

  // 4. Try matching accommodationName directly as codigo
  if (accommodationName) {
    const prop = cacheByCode.get(accommodationName.toLowerCase().trim());
    if (prop) {
      persistAvantioId(prop, accommodationId, accommodationName);
      return prop;
    }
  }

  // 5. Try stripping C prefix (CMD18.5 -> MD18.5)
  if (accommodationName) {
    const stripped = accommodationName.replace(/^C/, '').toLowerCase().trim();
    if (stripped !== accommodationName.toLowerCase().trim()) {
      const prop = cacheByCode.get(stripped);
      if (prop) {
        persistAvantioId(prop, accommodationId, accommodationName);
        return prop;
      }
    }
  }

  console.log(`❌ Propiedad no encontrada: ID="${accommodationId}", nombre="${accommodationName || 'N/A'}", código="${accommodationInternalName || 'N/A'}"`);
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
  // DEDUPLICATION: Check in-memory cache first (set populated by preloadReservationsAndTasksCache)
  const cacheKey = `${property.id}_${reservation.departureDate}`;
  const cachedTask = tasksCache.get(cacheKey);
  if (cachedTask) {
    return cachedTask;
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
    type: 'limpieza-turistica',
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

  // Add to cache so subsequent reservations for the same property/date reuse it
  tasksCache.set(cacheKey, task);
  return task;
}

/**
 * Get existing reservation by Avantio ID.
 * Uses in-memory cache populated by preloadReservationsAndTasksCache to avoid per-reservation queries.
 */
export async function getExistingReservation(reservationId: string) {
  const cached = reservationsCache.get(String(reservationId));
  if (cached !== undefined) return cached;

  // Fallback to DB query if not in cache (shouldn't happen for in-window data)
  const { data: existingReservation } = await supabase
    .from('avantio_reservations')
    .select('*, tasks(*)')
    .eq('avantio_reservation_id', reservationId)
    .single();

  return existingReservation;
}

/**
 * Insert new reservation (validation skipped — property already verified via cache lookup)
 */
export async function insertReservation(reservationData: any) {
  return await supabase
    .from('avantio_reservations')
    .insert(reservationData);
}

/**
 * Update existing reservation (validation skipped — property already verified via cache lookup)
 */
export async function updateReservation(reservationId: string, reservationData: any) {
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
export async function createSyncLog(triggerMeta?: { triggered_by?: string; schedule_name?: string }) {
  const { data: syncLog, error: logError } = await supabase
    .from('avantio_sync_logs')
    .insert({
      sync_started_at: new Date().toISOString(),
      status: 'running',
      triggered_by: triggerMeta?.triggered_by ?? 'manual',
      schedule_name: triggerMeta?.schedule_name ?? null,
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
