
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

    console.log(`🤖 Iniciando asignación automática para ${taskIds.length} tareas`);

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

        console.log(`📋 Tarea encontrada: ${task.property} - ${task.date} (propertyId: ${task.propiedad_id})`);

        // Mapear datos de la base de datos al formato esperado
        const mappedTask: Task = {
          id: task.id,
          property: task.property,
          address: task.address,
          startTime: task.start_time,
          endTime: task.end_time,
          type: task.type,
          status: task.status as 'pending' | 'in-progress' | 'completed',
          checkOut: task.check_out,
          checkIn: task.check_in,
          cleaner: task.cleaner,
          backgroundColor: task.background_color,
          date: task.date,
          clienteId: task.cliente_id,
          propertyId: task.propiedad_id,
          duration: task.duracion,
          cost: task.coste,
          paymentMethod: task.metodo_pago,
          supervisor: task.supervisor,
          cleanerId: task.cleaner_id,
          created_at: task.created_at,
          updated_at: task.updated_at
        };

        // 2. Verificar si la tarea ya está asignada
        if (mappedTask.cleanerId) {
          console.log(`⚠️ Tarea ${taskId} ya está asignada a ${mappedTask.cleaner}`);
          results.push({ taskId, success: false, reason: 'Task already assigned' });
          continue;
        }

        // 3. Determinar si la propiedad pertenece a un grupo con auto-asignación
        if (!mappedTask.propertyId) {
          console.log(`⚠️ Tarea ${taskId} no tiene propertyId`);
          results.push({ taskId, success: false, reason: 'No property ID' });
          continue;
        }

        console.log(`🔍 Buscando grupo para propiedad: ${mappedTask.propertyId}`);

        const { data: groupAssignment, error: groupError } = await supabase
          .from('property_group_assignments')
          .select(`
            property_groups (*)
          `)
          .eq('property_id', mappedTask.propertyId)
          .single();

        if (groupError || !groupAssignment) {
          console.log(`⚠️ Propiedad ${mappedTask.propertyId} no está en ningún grupo con auto-asignación`);
          results.push({ taskId, success: false, reason: 'Property not in auto-assignment group' });
          continue;
        }

        const group = groupAssignment.property_groups as any;
        const propertyGroup: PropertyGroup = {
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

        // 4. Obtener trabajadoras asignadas al grupo
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

        console.log(`👥 Encontradas ${cleanerAssignments.length} trabajadoras en el grupo`);

        // 5. Obtener tareas existentes del día para verificar disponibilidad
        const { data: existingTasks, error: tasksError } = await supabase
          .from('tasks')
          .select('*')
          .eq('date', mappedTask.date);

        if (tasksError) {
          console.error(`❌ Error obteniendo tareas existentes: ${tasksError.message}`);
          results.push({ taskId, success: false, reason: 'Error fetching existing tasks' });
          continue;
        }

        console.log(`📅 Tareas existentes para ${mappedTask.date}: ${existingTasks?.length || 0}`);

        // 6. Calcular scores para cada trabajadora
        const cleanerScores = cleanerAssignments.map(assignment => {
          let score = 100;
          let reasons = [];

          // Factor de prioridad (más importante)
          const priorityBonus = (10 - assignment.priority) * 20;
          score += priorityBonus;
          reasons.push(`Priority ${assignment.priority} (+${priorityBonus})`);

          // Factor de carga de trabajo
          const cleanerTasks = existingTasks?.filter(t => t.cleaner_id === assignment.cleaner_id) || [];
          const workloadPenalty = cleanerTasks.length * 10;
          score -= workloadPenalty;
          reasons.push(`Workload ${cleanerTasks.length} (-${workloadPenalty})`);

          // Verificar límite diario
          if (cleanerTasks.length >= assignment.max_tasks_per_day) {
            score = 0;
            reasons.push('Daily limit reached');
          }

          // Verificar conflictos de horario
          const taskStart = new Date(`${mappedTask.date} ${mappedTask.startTime}`);
          const taskEnd = new Date(`${mappedTask.date} ${mappedTask.endTime}`);
          
          for (const existingTask of cleanerTasks) {
            const existingStart = new Date(`${existingTask.date} ${existingTask.start_time}`);
            const existingEnd = new Date(`${existingTask.date} ${existingTask.end_time}`);
            
            // Añadir tiempo de buffer
            const bufferMs = assignment.estimated_travel_time_minutes * 60 * 1000;
            existingStart.setTime(existingStart.getTime() - bufferMs);
            existingEnd.setTime(existingEnd.getTime() + bufferMs);
            
            // Verificar solapamiento
            if (taskStart < existingEnd && taskEnd > existingStart) {
              score = 0;
              reasons.push('Time conflict');
              break;
            }
          }

          return {
            cleanerId: assignment.cleaner_id,
            score: Math.max(score, 0),
            reason: reasons.join(', ')
          };
        });

        console.log(`🎯 Scores calculados:`, cleanerScores);

        // 7. Seleccionar la mejor trabajadora
        const bestCleaner = cleanerScores
          .filter(cs => cs.score > 0)
          .sort((a, b) => b.score - a.score)[0];

        if (!bestCleaner) {
          console.log(`⚠️ No hay trabajadoras disponibles para la tarea ${taskId}`);
          results.push({ taskId, success: false, reason: 'No available cleaners' });
          continue;
        }

        // 8. Obtener información de la trabajadora
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

        console.log(`👤 Trabajadora seleccionada: ${cleaner.name} (confianza: ${bestCleaner.score}%)`);

        // 9. Asignar la tarea
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

        // 10. Registrar el log de asignación
        await supabase
          .from('auto_assignment_logs')
          .insert({
            task_id: taskId,
            property_group_id: propertyGroup.id,
            assigned_cleaner_id: bestCleaner.cleanerId,
            algorithm_used: 'workload-balance-priority',
            assignment_reason: bestCleaner.reason,
            confidence_score: bestCleaner.score,
            was_manual_override: false
          });

        console.log(`✅ Tarea ${taskId} asignada a ${cleaner.name} (confianza: ${bestCleaner.score}%)`);
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
    console.log(`🎯 Asignación automática completada: ${successCount}/${taskIds.length} tareas asignadas`);

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
