
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

export class DuplicatePreventionService {
  private supabase;

  constructor(supabaseUrl: string, supabaseServiceKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  /**
   * Verifica si ya existe una tarea para una reserva específica
   * Compara: ID de reserva, nombre de propiedad y fecha de checkout
   */
  async checkForExistingTask(
    hostawayReservationId: number,
    propertyName: string,
    checkoutDate: string
  ): Promise<boolean> {
    console.log(`🔍 VERIFICANDO DUPLICADO: Reserva ${hostawayReservationId}, Propiedad: ${propertyName}, Fecha: ${checkoutDate}`);
    
    try {
      // 1. Buscar por ID de reserva en hostaway_reservations
      const { data: existingReservation } = await this.supabase
        .from('hostaway_reservations')
        .select('task_id')
        .eq('hostaway_reservation_id', hostawayReservationId)
        .single();

      if (existingReservation?.task_id) {
        // Verificar que la tarea asociada existe
        const { data: existingTask } = await this.supabase
          .from('tasks')
          .select('id, property, date')
          .eq('id', existingReservation.task_id)
          .single();

        if (existingTask) {
          console.log(`✅ DUPLICADO DETECTADO por ID de reserva: Tarea ${existingTask.id} ya existe`);
          return true;
        }
      }

      // 2. Buscar por nombre de propiedad y fecha de checkout - CON VERIFICACIÓN DE STATUS
      const { data: existingTasks } = await this.supabase
        .from('tasks')
        .select(`
          id, property, date, cleaner, cleaner_id,
          hostaway_reservations!inner(hostaway_reservation_id, status)
        `)
        .eq('property', propertyName)
        .eq('date', checkoutDate);

      if (existingTasks && existingTasks.length > 0) {
        console.log(`🔍 ENCONTRADAS ${existingTasks.length} tarea(s) existente(s) para ${propertyName} - ${checkoutDate}`);
        
        // Verificar si alguna tarea es de una reserva VÁLIDA (no cancelada)
        const validTasks = existingTasks.filter(task => {
          const reservation = task.hostaway_reservations;
          const status = reservation?.status?.toLowerCase() || '';
          const isValid = !['cancelled', 'inquiry', 'declined', 'expired'].includes(status);
          
          console.log(`   - Tarea ${task.id}: Reserva ${reservation?.hostaway_reservation_id}, Status: ${reservation?.status}, Válida: ${isValid}`);
          return isValid;
        });

        if (validTasks.length > 0) {
          console.log(`✅ DUPLICADO DETECTADO: Ya existe ${validTasks.length} tarea(s) VÁLIDA(s)`);
          return true;
        } else {
          console.log(`⚠️ Solo hay tareas de reservas CANCELADAS - Se permite crear nueva tarea`);
          return false;
        }
      }

      console.log(`✅ NO hay duplicados - Tarea nueva válida`);
      return false;

    } catch (error) {
      console.error(`❌ Error verificando duplicados:`, error);
      // En caso de error, ser conservador y asumir que no hay duplicado
      return false;
    }
  }

  /**
   * Limpia duplicados existentes basándose en criterios simples
   */
  async cleanupExistingDuplicates(): Promise<void> {
    console.log(`🧹 LIMPIANDO DUPLICADOS EXISTENTES...`);
    
    try {
      // Buscar tareas duplicadas por propiedad y fecha CON STATUS DE RESERVA
      const { data: allTasks } = await this.supabase
        .from('tasks')
        .select(`
          id, property, date, cleaner, cleaner_id, created_at,
          hostaway_reservations(hostaway_reservation_id, status)
        `)
        .order('property, date, created_at');

      if (!allTasks || allTasks.length === 0) {
        console.log(`✅ No hay tareas para limpiar`);
        return;
      }

      // Agrupar por propiedad + fecha
      const taskGroups = new Map<string, any[]>();
      
      allTasks.forEach(task => {
        const key = `${task.property}-${task.date}`;
        if (!taskGroups.has(key)) {
          taskGroups.set(key, []);
        }
        taskGroups.get(key)!.push(task);
      });

      // Encontrar grupos con duplicados
      const duplicateGroups = Array.from(taskGroups.entries())
        .filter(([_, tasks]) => tasks.length > 1);

      if (duplicateGroups.length === 0) {
        console.log(`✅ No se encontraron duplicados`);
        return;
      }

      console.log(`⚠️ DUPLICADOS ENCONTRADOS: ${duplicateGroups.length} grupos`);
      
      let totalRemoved = 0;

      for (const [key, tasks] of duplicateGroups) {
        const [propertyName, date] = key.split('-');
        console.log(`🔄 Procesando duplicados: ${propertyName} - ${date}`);
        
        // Ordenar tareas: NUEVA LÓGICA con prioridad por status de reserva
        const sortedTasks = tasks.sort((a, b) => {
          // Obtener status de las reservas
          const statusA = a.hostaway_reservations?.status?.toLowerCase() || '';
          const statusB = b.hostaway_reservations?.status?.toLowerCase() || '';
          
          const invalidStatuses = ['cancelled', 'inquiry', 'declined', 'expired'];
          const isValidA = !invalidStatuses.includes(statusA);
          const isValidB = !invalidStatuses.includes(statusB);
          
          // Prioridad 1: Tareas de reservas VÁLIDAS sobre canceladas
          if (isValidA && !isValidB) return -1;
          if (!isValidA && isValidB) return 1;
          
          // Prioridad 2: Tareas asignadas sobre no asignadas
          if (a.cleaner_id && !b.cleaner_id) return -1;
          if (!a.cleaner_id && b.cleaner_id) return 1;
          
          // Prioridad 3: Fecha de creación (más antigua primero)
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });

        // Mantener la primera tarea (prioridad: asignada > más antigua)
        const taskToKeep = sortedTasks[0];
        const tasksToRemove = sortedTasks.slice(1);

        console.log(`   - MANTENER: ${taskToKeep.id} (${taskToKeep.cleaner_id ? 'ASIGNADA' : 'SIN ASIGNAR'})`);
        
        // Eliminar duplicados
        for (const taskToRemove of tasksToRemove) {
          console.log(`   - ELIMINAR: ${taskToRemove.id} (${taskToRemove.cleaner_id ? 'ASIGNADA' : 'SIN ASIGNAR'})`);
          
          // Limpiar referencias en hostaway_reservations
          await this.supabase
            .from('hostaway_reservations')
            .update({ task_id: null })
            .eq('task_id', taskToRemove.id);

          // Eliminar tarea
          const { error: deleteError } = await this.supabase
            .from('tasks')
            .delete()
            .eq('id', taskToRemove.id);

          if (deleteError) {
            console.error(`❌ Error eliminando tarea ${taskToRemove.id}:`, deleteError);
          } else {
            totalRemoved++;
          }
        }
      }

      console.log(`✅ LIMPIEZA COMPLETADA: ${totalRemoved} tareas duplicadas eliminadas`);

    } catch (error) {
      console.error(`❌ Error en limpieza de duplicados:`, error);
    }
  }
}
