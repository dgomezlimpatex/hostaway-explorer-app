
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Task {
  id: string;
  property: string;
  address: string;
  startTime: string;
  endTime: string;
  type: string;
  status: 'pending' | 'in-progress' | 'completed';
  checkOut: string;
  checkIn: string;
  cleaner?: string;
  backgroundColor?: string;
  date: string;
  clienteId?: string;
  propertyId?: string;
  duration?: number;
  cost?: number;
  paymentMethod?: string;
  supervisor?: string;
  cleanerId?: string;
  created_at: string;
  updated_at: string;
}

interface PropertyGroup {
  id: string;
  name: string;
  description?: string;
  checkOutTime: string;
  checkInTime: string;
  isActive: boolean;
  autoAssignEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CleanerGroupAssignment {
  id: string;
  propertyGroupId: string;
  cleanerId: string;
  priority: number;
  maxTasksPerDay: number;
  estimatedTravelTimeMinutes: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { taskIds } = await req.json();

    if (!taskIds || !Array.isArray(taskIds)) {
      console.error('❌ taskIds array is required');
      throw new Error('taskIds array is required');
    }

    console.log(`🤖 Iniciando asignación automática V4 SATURACIÓN CORREGIDA para ${taskIds.length} tareas`);

    const results = [];

    for (const taskId of taskIds) {
      try {
        console.log(`🔄 Procesando tarea: ${taskId}`);
        
        // 1. Obtener la tarea
        const { data: task, error: taskError } = await supabase
          .from('tasks')
          .select('*')
          .eq('id', taskId)
          .single();

        if (taskError || !task) {
          console.error(`❌ Tarea no encontrada: ${taskId}`, taskError);
          results.push({ taskId, success: false, reason: 'Task not found' });
          continue;
        }

        console.log(`📋 Tarea encontrada: ${task.property} - ${task.date} ${task.start_time}-${task.end_time} (propertyId: ${task.propiedad_id})`);

        // Verificar si la tarea ya está asignada
        if (task.cleaner_id) {
          console.log(`⚠️ Tarea ${taskId} ya está asignada a ${task.cleaner}`);
          results.push({ taskId, success: false, reason: 'Task already assigned' });
          continue;
        }

        // Determinar si la propiedad pertenece a un grupo con auto-asignación
        if (!task.propiedad_id) {
          console.log(`⚠️ Tarea ${taskId} no tiene propertyId`);
          results.push({ taskId, success: false, reason: 'No property ID' });
          continue;
        }

        console.log(`🔍 Buscando grupo para propiedad: ${task.propiedad_id}`);

        const { data: groupAssignment, error: groupError } = await supabase
          .from('property_group_assignments')
          .select(`
            property_groups (*)
          `)
          .eq('property_id', task.propiedad_id)
          .single();

        if (groupError || !groupAssignment) {
          console.log(`⚠️ Propiedad ${task.propiedad_id} no está en ningún grupo con auto-asignación`);
          results.push({ taskId, success: false, reason: 'Property not in auto-assignment group' });
          continue;
        }

        const group = groupAssignment.property_groups as any;
        const propertyGroup = {
          id: group.id,
          name: group.name,
          description: group.description,
          checkOutTime: group.check_out_time,
          checkInTime: group.check_in_time,
          isActive: group.is_active,
          autoAssignEnabled: group.auto_assign_enabled,
          createdAt: group.created_at,
          updatedAt: group.updated_at
        };

        console.log(`🏢 Grupo encontrado: ${propertyGroup.name} (auto-assign: ${propertyGroup.autoAssignEnabled})`);

        if (!propertyGroup.autoAssignEnabled) {
          console.log(`⚠️ Grupo ${propertyGroup.name} no tiene auto-asignación habilitada`);
          results.push({ taskId, success: false, reason: 'Auto-assignment disabled for group' });
          continue;
        }

        // Obtener trabajadoras asignadas al grupo
        const { data: cleanerAssignments, error: cleanerError } = await supabase
          .from('cleaner_group_assignments')
          .select('*')
          .eq('property_group_id', propertyGroup.id)
          .eq('is_active', true)
          .order('priority', { ascending: true });

        if (cleanerError || !cleanerAssignments || cleanerAssignments.length === 0) {
          console.log(`⚠️ No hay trabajadoras asignadas al grupo ${propertyGroup.name}`);
          results.push({ taskId, success: false, reason: 'No cleaners assigned to group' });
          continue;
        }

        console.log(`👥 Encontradas ${cleanerAssignments.length} trabajadoras en el grupo:`);
        cleanerAssignments.forEach(ca => {
          console.log(`   - Prioridad ${ca.priority}: ${ca.cleaner_id.slice(0,8)} (max: ${ca.max_tasks_per_day} tareas/día)`);
        });

        // Obtener TODAS las tareas del día para evaluar disponibilidad
        const { data: allDayTasks, error: tasksError } = await supabase
          .from('tasks')
          .select('*')
          .eq('date', task.date);

        if (tasksError) {
          console.error(`❌ Error obteniendo tareas existentes: ${tasksError.message}`);
          results.push({ taskId, success: false, reason: 'Error fetching existing tasks' });
          continue;
        }

        console.log(`📅 Tareas totales para ${task.date}: ${allDayTasks?.length || 0}`);

        // Función CORREGIDA para verificar disponibilidad
        const canCleanerTakeTask = (assignment: any, taskToAssign: any, existingTasks: any[]) => {
          const cleanerTasks = existingTasks.filter(t => t.cleaner_id === assignment.cleaner_id && t.id !== taskToAssign.id);
          
          console.log(`🔍 Verificando trabajadora P${assignment.priority} (${assignment.cleaner_id.slice(0,8)}):`);
          console.log(`   - Tareas actuales: ${cleanerTasks.length}/${assignment.max_tasks_per_day}`);
          console.log(`   - Nueva tarea: ${taskToAssign.start_time}-${taskToAssign.end_time}`);
          
          // Verificar límite diario
          if (cleanerTasks.length >= assignment.max_tasks_per_day) {
            console.log(`❌ P${assignment.priority}: Límite diario alcanzado (${cleanerTasks.length}/${assignment.max_tasks_per_day})`);
            return false;
          }

          // Si no hay tareas existentes, está disponible
          if (cleanerTasks.length === 0) {
            console.log(`✅ P${assignment.priority}: Sin tareas previas, DISPONIBLE`);
            return true;
          }

          // Verificar si puede hacer la tarea secuencialmente
          const taskStart = new Date(`${taskToAssign.date} ${taskToAssign.start_time}`);
          const taskEnd = new Date(`${taskToAssign.date} ${taskToAssign.end_time}`);
          
          // Ordenar tareas existentes por hora de inicio
          const sortedTasks = cleanerTasks.sort((a, b) => {
            const timeA = new Date(`${a.date} ${a.start_time}`).getTime();
            const timeB = new Date(`${b.date} ${b.start_time}`).getTime();
            return timeA - timeB;
          });

          console.log(`   - Tareas existentes: ${sortedTasks.map(t => `${t.start_time}-${t.end_time}`).join(', ')}`);

          // Verificar si puede insertarse entre tareas existentes o al final
          for (let i = 0; i <= sortedTasks.length; i++) {
            let canFitHere = false;
            let slotDescription = '';
            
            if (i === 0) {
              // Antes de la primera tarea
              if (sortedTasks.length === 0) {
                canFitHere = true;
                slotDescription = 'única tarea';
              } else {
                const firstTaskStart = new Date(`${sortedTasks[0].date} ${sortedTasks[0].start_time}`);
                const bufferMs = assignment.estimated_travel_time_minutes * 60 * 1000;
                canFitHere = taskEnd.getTime() + bufferMs <= firstTaskStart.getTime();
                slotDescription = `antes de ${sortedTasks[0].start_time}`;
              }
            } else if (i === sortedTasks.length) {
              // Después de la última tarea
              const lastTask = sortedTasks[i - 1];
              const lastTaskEnd = new Date(`${lastTask.date} ${lastTask.end_time}`);
              const bufferMs = assignment.estimated_travel_time_minutes * 60 * 1000;
              canFitHere = taskStart.getTime() >= lastTaskEnd.getTime() + bufferMs;
              slotDescription = `después de ${lastTask.end_time}`;
            } else {
              // Entre dos tareas
              const prevTask = sortedTasks[i - 1];
              const nextTask = sortedTasks[i];
              const prevTaskEnd = new Date(`${prevTask.date} ${prevTask.end_time}`);
              const nextTaskStart = new Date(`${nextTask.date} ${nextTask.start_time}`);
              const bufferMs = assignment.estimated_travel_time_minutes * 60 * 1000;
              
              canFitHere = taskStart.getTime() >= prevTaskEnd.getTime() + bufferMs &&
                           taskEnd.getTime() + bufferMs <= nextTaskStart.getTime();
              slotDescription = `entre ${prevTask.end_time} y ${nextTask.start_time}`;
            }
            
            console.log(`   - Posición ${i} (${slotDescription}): ${canFitHere ? '✅ CABE' : '❌ no cabe'}`);
            
            if (canFitHere) {
              console.log(`✅ P${assignment.priority} PUEDE hacer la tarea en posición ${i}`);
              return true;
            }
          }

          console.log(`❌ P${assignment.priority}: NO puede insertar la tarea`);
          return false;
        };

        // ALGORITMO DE SATURACIÓN POR PRIORIDAD V4 - CORREGIDO
        let bestCleaner = null;
        
        console.log(`🎯 INICIANDO SATURACIÓN V4 CORREGIDA - SATURAR POR PRIORIDAD`);
        
        // BUSCAR TRABAJADORA POR ORDEN DE PRIORIDAD (saturación real)
        for (const assignment of cleanerAssignments) {
          console.log(`🔍 Evaluando trabajadora PRIORIDAD ${assignment.priority} (${assignment.cleaner_id.slice(0,8)})`);
          
          if (canCleanerTakeTask(assignment, task, allDayTasks || [])) {
            const cleanerTasks = (allDayTasks || []).filter(t => t.cleaner_id === assignment.cleaner_id);
            
            bestCleaner = {
              cleanerId: assignment.cleaner_id,
              score: 1000 - (assignment.priority * 100) + (assignment.max_tasks_per_day - cleanerTasks.length),
              reason: `🏆 SATURACIÓN V4: Prioridad ${assignment.priority}, Carga actual: ${cleanerTasks.length}/${assignment.max_tasks_per_day}`
            };
            
            console.log(`✅ ASIGNANDO a PRIORIDAD ${assignment.priority} (${cleanerTasks.length} tareas actuales)`);
            break; // IMPORTANTE: Asignar a la primera disponible por prioridad (saturación)
          } else {
            console.log(`❌ PRIORIDAD ${assignment.priority} no disponible, probando siguiente...`);
          }
        }

        if (!bestCleaner) {
          console.log(`⚠️ No hay trabajadoras disponibles para la tarea ${taskId}`);
          results.push({ taskId, success: false, reason: 'No available cleaners' });
          continue;
        }

        // Obtener información de la trabajadora
        const { data: cleaner, error: cleanerInfoError } = await supabase
          .from('cleaners')
          .select('name')
          .eq('id', bestCleaner.cleanerId)
          .single();

        if (cleanerInfoError || !cleaner) {
          console.error(`❌ Error obteniendo info de trabajadora: ${cleanerInfoError?.message}`);
          results.push({ taskId, success: false, reason: 'Cleaner not found' });
          continue;
        }

        console.log(`👤 Trabajadora seleccionada: ${cleaner.name} (${bestCleaner.reason})`);

        // Asignar la tarea
        const { error: assignError } = await supabase
          .from('tasks')
          .update({
            cleaner_id: bestCleaner.cleanerId,
            cleaner: cleaner.name,
            auto_assigned: true,
            assignment_confidence: bestCleaner.score
          })
          .eq('id', taskId);

        if (assignError) {
          console.error(`❌ Error asignando tarea: ${assignError.message}`);
          results.push({ taskId, success: false, reason: 'Assignment failed' });
          continue;
        }

        // Registrar el log de asignación
        await supabase
          .from('auto_assignment_logs')
          .insert({
            task_id: taskId,
            property_group_id: propertyGroup.id,
            assigned_cleaner_id: bestCleaner.cleanerId,
            algorithm_used: 'priority-saturation-v4-corrected',
            assignment_reason: bestCleaner.reason,
            confidence_score: bestCleaner.score,
            was_manual_override: false
          });

        console.log(`✅ Tarea ${taskId} asignada a ${cleaner.name} (${bestCleaner.reason})`);
        results.push({ 
          taskId, 
          success: true, 
          cleanerId: bestCleaner.cleanerId,
          cleanerName: cleaner.name,
          confidence: bestCleaner.score,
          reason: bestCleaner.reason
        });

      } catch (error) {
        console.error(`❌ Error procesando tarea ${taskId}:`, error);
        results.push({ taskId, success: false, reason: error.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`🎯 SATURACIÓN V4 CORREGIDA COMPLETADA: ${successCount}/${taskIds.length} tareas asignadas`);

    return new Response(JSON.stringify({
      success: true,
      results,
      summary: {
        total: taskIds.length,
        assigned: successCount,
        failed: taskIds.length - successCount
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('❌ Error en asignación automática:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
