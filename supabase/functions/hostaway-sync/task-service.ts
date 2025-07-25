
import { HostawayReservation, SyncStats, TaskDetail } from './types.ts';
import { createTaskForReservation, deleteTask } from './database-operations.ts';
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
      // Primero obtener información de la tarea y limpiadora asignada antes de eliminarla
      await sendTaskCancellationEmail(existingReservation.task_id);
      
      // Luego eliminar la tarea
      await deleteTask(existingReservation.task_id);
      console.log(`🗑️ Tarea eliminada: ${existingReservation.task_id}`);
    } catch (error) {
      console.error(`Error eliminando tarea ${existingReservation.task_id}:`, error);
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
async function sendTaskCancellationEmail(taskId: string): Promise<void> {
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
      console.error(`❌ Error obteniendo información de tarea ${taskId}:`, taskError);
      return;
    }

    if (!task) {
      console.log(`⚠️ Tarea ${taskId} no encontrada para envío de email`);
      return;
    }

    // Solo enviar email si hay una limpiadora asignada
    if (!task.cleaner_id || !task.cleaners) {
      console.log(`ℹ️ Tarea ${taskId} no tiene limpiadora asignada, no se envía email`);
      return;
    }

    console.log(`📧 Enviando email de cancelación a limpiadora: ${task.cleaners.name}`);

    // Enviar email usando la edge function existente
    const { error: emailError } = await supabase.functions.invoke('send-task-unassignment-email', {
      body: {
        taskId: task.id,
        taskDate: task.date,
        taskStartTime: task.start_time,
        taskEndTime: task.end_time,
        propertyName: task.properties?.nombre || task.property,
        propertyAddress: task.properties?.direccion || task.address,
        cleanerName: task.cleaners.name,
        cleanerEmail: task.cleaners.email,
        reason: 'cancelled'
      }
    });

    if (emailError) {
      console.error(`❌ Error enviando email de cancelación a ${task.cleaners.name}:`, emailError);
    } else {
      console.log(`✅ Email de cancelación enviado exitosamente a ${task.cleaners.name}`);
    }

  } catch (error) {
    console.error(`❌ Error general enviando email de cancelación:`, error);
  }
}
