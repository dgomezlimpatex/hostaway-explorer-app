
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

      // 2. Buscar por nombre de propiedad y fecha de checkout
      const { data: existingTasks } = await this.supabase
        .from('tasks')
        .select('id, property, date, cleaner, cleaner_id')
        .eq('property', propertyName)
        .eq('date', checkoutDate);

      if (existingTasks && existingTasks.length > 0) {
        console.log(`✅ DUPLICADO DETECTADO por propiedad y fecha: ${existingTasks.length} tarea(s) encontrada(s)`);
        existingTasks.forEach(task => {
          const assignmentStatus = task.cleaner_id ? `ASIGNADA a ${task.cleaner}` : 'SIN ASIGNAR';
          console.log(`   - Tarea ${task.id}: ${assignmentStatus}`);
        });
        return true;
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
      // Buscar tareas duplicadas por propiedad y fecha
      const { data: allTasks } = await this.supabase
        .from('tasks')
        .select('id, property, date, cleaner, cleaner_id, created_at')
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
        
        // Ordenar tareas: primero las asignadas, luego por fecha de creación
        const sortedTasks = tasks.sort((a, b) => {
          // Prioridad 1: Tareas asignadas
          if (a.cleaner_id && !b.cleaner_id) return -1;
          if (!a.cleaner_id && b.cleaner_id) return 1;
          
          // Prioridad 2: Fecha de creación (más antigua primero)
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
