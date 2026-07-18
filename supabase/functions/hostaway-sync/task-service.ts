
import { HostawayReservation, SyncStats, TaskDetail } from './types.ts';
import { createTaskForReservation, deleteTaskIfPending } from './database-operations.ts';
import { shouldCreateTaskForReservation, getTaskCreationReason } from './reservation-validator.ts';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Creates a task for a new reservation if conditions are met
 */
export async function handleNewReservationTask(
  reservation: HostawayReservation,
  property: any,
  stats: SyncStats
): Promise<string | null> {
  const shouldCreateTask = shouldCreateTaskForReservation(reservation);
  
  console.log(`📋 ¿Crear tarea? Status: ${reservation.status}, válido: ${shouldCreateTask}`);
  console.log(`📋 Motivo: ${getTaskCreationReason(reservation)}`);
  
  if (!shouldCreateTask) {
    console.log(`⏭️ No se crea tarea para reserva: ${getTaskCreationReason(reservation)}`);
    return null;
  }

  console.log(`📋 Creando tarea para reserva activa (status: ${reservation.status})...`);
  console.log(`📋 Fecha de la tarea: ${reservation.departureDate} (departure date)`);
  
  try {
    const task = await createTaskForReservation(reservation, property);
    stats.tasks_created++;
    
    // Agregar detalles de la tarea creada
    if (!stats.tasks_details) stats.tasks_details = [];
    stats.tasks_details.push({
      reservation_id: reservation.id,
      property_name: property.nombre,
      task_id: task.id,
      task_date: reservation.departureDate,
      guest_name: reservation.guestName,
      listing_id: reservation.listingMapId,
      status: reservation.status
    });
    
    console.log(`✅ Tarea creada con ID: ${task.id} para fecha: ${reservation.departureDate}`);
    console.log(`✅ Detalles de la tarea: ${task.property} - ${task.start_time} a ${task.end_time}`);
    return task.id;
  } catch (error) {
    const errorMsg = `Error creando tarea para reserva ${reservation.id} (${property.nombre}, ${reservation.guestName}): ${error.message}`;
    console.error(`❌ ${errorMsg}`);
    stats.errors.push(errorMsg);
    return null;
  }
}

/**
 * Handles task deletion for cancelled reservations
 */
export async function handleCancelledReservationTask(
  existingReservation: any,
  stats: SyncStats
): Promise<void> {
  if (existingReservation.task_id) {
    try {
      const deleted = await deletePendingTaskAndSendCancellationEmail(existingReservation.task_id);
      if (deleted) {
        stats.tasks_cancelled++;
        console.log(`🗑️ Tarea pendiente eliminada: ${existingReservation.task_id}`);
      } else {
        console.log(`🛡️ Tarea ${existingReservation.task_id} conservada: ya comenzó, terminó o su estado no es seguro para borrar`);
      }
    } catch (error) {
      console.error(`Error eliminando tarea ${existingReservation.task_id}:`, error);
      stats.errors.push(`No se pudo aplicar de forma segura la cancelación a la tarea ${existingReservation.task_id}: ${error.message}`);
    }
  }
}

/**
 * Creates a missing task for an existing reservation
 */
export async function createMissingTask(
  reservation: HostawayReservation,
  property: any,
  stats: SyncStats
): Promise<string | null> {
  if (!shouldCreateTaskForReservation(reservation)) {
    return null;
  }

  console.log(`🔄 Creando tarea faltante para reserva: ${reservation.id}`);
  try {
    const task = await createTaskForReservation(reservation, property);
    stats.tasks_created++;
    
    // Agregar detalles de la tarea creada
    if (!stats.tasks_details) stats.tasks_details = [];
    stats.tasks_details.push({
      reservation_id: reservation.id,
      property_name: property.nombre,
      task_id: task.id,
      task_date: reservation.departureDate,
      guest_name: reservation.guestName,
      listing_id: reservation.listingMapId,
      status: reservation.status
    });
    
    console.log(`✅ Tarea faltante creada: ${task.id}`);
    return task.id;
  } catch (error) {
    console.error(`Error creando tarea faltante:`, error);
    stats.errors.push(`Error creando tarea faltante para ${reservation.id}: ${error.message}`);
    return null;
  }
}

/**
 * Sends cancellation email to assigned cleaner before deleting task
 */
async function deletePendingTaskAndSendCancellationEmail(taskId: string): Promise<boolean> {
  try {
    // Obtener información completa de la tarea y la limpiadora asignada
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select(`
        *,
        cleaners!tasks_cleaner_id_fkey(
          id,
          name,
          email,
          user_id
        ),
        properties!tasks_propiedad_id_fkey(
          nombre,
          direccion
        )
      `)
      .eq('id', taskId)
      .single();

    if (taskError) {
      throw taskError;
    }

    if (!task) {
      console.log(`⚠️ Tarea ${taskId} no encontrada; no se intenta un borrado destructivo`);
      return false;
    }

    const deleted = await deleteTaskIfPending(taskId);
    if (!deleted) return false;

    // Solo enviar email si hay una limpiadora asignada
    if (!task.cleaner_id || !task.cleaners) {
      console.log(`ℹ️ Tarea ${taskId} no tiene limpiadora asignada, no se envía email`);
      return true;
    }

    console.log(`📧 Enviando email de cancelación a limpiadora: ${task.cleaners.name}`);

    // Enviar email usando la edge function existente
    const { error: emailError } = await supabase.functions.invoke('send-task-unassignment-email', {
      body: {
        taskId: task.id,
        cleanerEmail: task.cleaners.email,
        cleanerName: task.cleaners.name,
        taskData: {
          date: task.date,
          start_time: task.start_time,
          end_time: task.end_time,
          property: task.properties?.nombre || task.property,
          address: task.properties?.direccion || task.address
        },
        reason: 'cancelled'
      }
    });

    if (emailError) {
      console.error(`❌ Error enviando email de cancelación a ${task.cleaners.name}:`, emailError);
    } else {
      console.log(`✅ Email de cancelación enviado exitosamente a ${task.cleaners.name}`);
    }

    return true;

  } catch (error) {
    console.error(`❌ Error general enviando email de cancelación:`, error);
    throw error;
  }
}
