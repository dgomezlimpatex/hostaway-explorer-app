
import { supabase } from '@/integrations/supabase/client';
import { Task } from '@/types/calendar';
import { PropertyGroup, CleanerGroupAssignment, AssignmentPattern } from '@/types/propertyGroups';
import { propertyGroupStorage } from './storage/propertyGroupStorage';

interface AssignmentContext {
  task: Task;
  propertyGroup: PropertyGroup;
  cleanerAssignments: CleanerGroupAssignment[];
  existingTasks: Task[];
  patterns: AssignmentPattern[];
}

interface AssignmentResult {
  cleanerId: string | null;
  cleanerName: string | null;
  confidence: number;
  reason: string;
  algorithm: string;
}

class AutoAssignmentEngine {
  async assignTask(taskId: string): Promise<AssignmentResult> {
    try {
      // 1. Obtener la tarea
      const task = await this.getTask(taskId);
      if (!task) {
        throw new Error('Task not found');
      }

      // 2. Determinar si la propiedad pertenece a un grupo con auto-asignación
      const propertyGroup = await this.getPropertyGroup(task.propertyId);
      if (!propertyGroup || !propertyGroup.autoAssignEnabled) {
        return {
          cleanerId: null,
          cleanerName: null,
          confidence: 0,
          reason: 'Property not in auto-assignment group',
          algorithm: 'none'
        };
      }

      // 3. Obtener contexto para la asignación
      const context = await this.buildAssignmentContext(task, propertyGroup);

      // 4. Ejecutar algoritmo de saturación por prioridad mejorado
      const result = await this.executeAssignmentAlgorithm(context);

      // 5. Registrar el resultado
      await this.logAssignment(taskId, propertyGroup.id, result);

      // 6. Actualizar la tarea si se asignó
      if (result.cleanerId) {
        await this.updateTaskAssignment(taskId, result.cleanerId, result.cleanerName, result.confidence);
      }

      return result;
    } catch (error) {
      console.error('Error in auto assignment:', error);
      return {
        cleanerId: null,
        cleanerName: null,
        confidence: 0,
        reason: `Error: ${error.message}`,
        algorithm: 'error'
      };
    }
  }

  private async getTask(taskId: string): Promise<Task | null> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      property: data.property,
      address: data.address,
      startTime: data.start_time,
      endTime: data.end_time,
      type: data.type,
      status: data.status as 'pending' | 'in-progress' | 'completed',
      checkOut: data.check_out,
      checkIn: data.check_in,
      cleaner: data.cleaner,
      backgroundColor: data.background_color,
      date: data.date,
      clienteId: data.cliente_id,
      propertyId: data.propiedad_id,
      duration: data.duracion,
      cost: data.coste,
      paymentMethod: data.metodo_pago,
      supervisor: data.supervisor,
      cleanerId: data.cleaner_id,
      created_at: data.created_at,
      updated_at: data.updated_at
    };
  }

  private async getPropertyGroup(propertyId: string | null): Promise<PropertyGroup | null> {
    if (!propertyId) return null;

    const { data, error } = await supabase
      .from('property_group_assignments')
      .select(`
        property_groups (*)
      `)
      .eq('property_id', propertyId)
      .single();

    if (error || !data) return null;

    const group = data.property_groups as any;
    return {
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
  }

  private async buildAssignmentContext(task: Task, propertyGroup: PropertyGroup): Promise<AssignmentContext> {
    const [cleanerAssignments, existingTasks, patterns] = await Promise.all([
      propertyGroupStorage.getCleanerAssignments(propertyGroup.id),
      this.getExistingTasksForDate(task.date),
      this.getAssignmentPatterns(propertyGroup.id)
    ]);

    return {
      task,
      propertyGroup,
      cleanerAssignments: cleanerAssignments.filter(ca => ca.isActive),
      existingTasks,
      patterns
    };
  }

  private async getExistingTasksForDate(date: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('date', date);

    if (error || !data) return [];

    return data.map(row => ({
      id: row.id,
      property: row.property,
      address: row.address,
      startTime: row.start_time,
      endTime: row.end_time,
      type: row.type,
      status: row.status as 'pending' | 'in-progress' | 'completed',
      checkOut: row.check_out,
      checkIn: row.check_in,
      cleaner: row.cleaner,
      backgroundColor: row.background_color,
      date: row.date,
      clienteId: row.cliente_id,
      propertyId: row.propiedad_id,
      duration: row.duracion,
      cost: row.coste,
      paymentMethod: row.metodo_pago,
      supervisor: row.supervisor,
      cleanerId: row.cleaner_id,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));
  }

  private async getAssignmentPatterns(groupId: string): Promise<AssignmentPattern[]> {
    const { data, error } = await supabase
      .from('assignment_patterns')
      .select('*')
      .eq('property_group_id', groupId);

    if (error || !data) return [];

    return data.map(row => ({
      id: row.id,
      propertyGroupId: row.property_group_id,
      cleanerId: row.cleaner_id,
      dayOfWeek: row.day_of_week,
      hourOfDay: row.hour_of_day,
      avgCompletionTimeMinutes: row.avg_completion_time_minutes,
      successRate: row.success_rate,
      preferenceScore: row.preference_score,
      lastUpdated: row.last_updated,
      sampleSize: row.sample_size
    }));
  }

  private async executeAssignmentAlgorithm(context: AssignmentContext): Promise<AssignmentResult> {
    const { task, propertyGroup, cleanerAssignments, existingTasks } = context;

    console.log(`🎯 ALGORITMO SATURACIÓN V2 para tarea ${task.id} - ${task.startTime}`);

    // Algoritmo de saturación por prioridad mejorado
    const availableCleaners = cleanerAssignments
      .filter(ca => ca.isActive)
      .sort((a, b) => a.priority - b.priority); // Ordenar por prioridad

    if (availableCleaners.length === 0) {
      return {
        cleanerId: null,
        cleanerName: null,
        confidence: 0,
        reason: 'No available cleaners',
        algorithm: 'priority-saturation-v2'
      };
    }

    console.log(`👥 Trabajadoras disponibles por prioridad: ${availableCleaners.map(c => `P${c.priority}`).join(', ')}`);

    // Buscar la primera trabajadora disponible por orden de prioridad que pueda tomar la tarea
    for (const assignment of availableCleaners) {
      console.log(`🔍 Evaluando trabajadora prioridad ${assignment.priority}`);
      
      if (this.isCleanerAvailable(assignment, task, existingTasks)) {
        const cleanerTasks = existingTasks.filter(t => t.cleanerId === assignment.cleanerId);
        const cleanerInfo = await this.getCleanerInfo(assignment.cleanerId);

        const reason = `🏆 SATURACIÓN: Prioridad ${assignment.priority}, Carga: ${cleanerTasks.length}/${assignment.maxTasksPerDay}`;
        console.log(`✅ ASIGNANDO: ${reason}`);

        return {
          cleanerId: assignment.cleanerId,
          cleanerName: cleanerInfo?.name || null,
          confidence: 1000 - (assignment.priority * 100) + (assignment.maxTasksPerDay - cleanerTasks.length),
          reason,
          algorithm: 'priority-saturation-v2'
        };
      } else {
        console.log(`❌ Trabajadora prioridad ${assignment.priority} NO disponible`);
      }
    }

    return {
      cleanerId: null,
      cleanerName: null,
      confidence: 0,
      reason: 'No available cleaners after priority check',
      algorithm: 'priority-saturation-v2'
    };
  }

  private async getCleanerInfo(cleanerId: string) {
    const { data, error } = await supabase
      .from('cleaners')
      .select('name')
      .eq('id', cleanerId)
      .single();

    return data;
  }

  private async logAssignment(taskId: string, propertyGroupId: string, result: AssignmentResult): Promise<void> {
    await supabase
      .from('auto_assignment_logs')
      .insert({
        task_id: taskId,
        property_group_id: propertyGroupId,
        assigned_cleaner_id: result.cleanerId,
        algorithm_used: result.algorithm,
        assignment_reason: result.reason,
        confidence_score: result.confidence,
        was_manual_override: false
      });
  }

  private async updateTaskAssignment(taskId: string, cleanerId: string, cleanerName: string | null, confidence: number): Promise<void> {
    await supabase
      .from('tasks')
      .update({
        cleaner_id: cleanerId,
        cleaner: cleanerName,
        auto_assigned: true,
        assignment_confidence: confidence
      })
      .eq('id', taskId);
  }

  private isCleanerAvailable(assignment: CleanerGroupAssignment, task: Task, existingTasks: Task[]): boolean {
    const cleanerTasks = existingTasks.filter(t => t.cleanerId === assignment.cleanerId);
    
    // Verificar límite diario de tareas
    if (cleanerTasks.length >= assignment.maxTasksPerDay) {
      return false;
    }

    // Verificar conflictos de horario con lógica mejorada
    const taskStart = new Date(`${task.date} ${task.startTime}`);
    const taskEnd = new Date(`${task.date} ${task.endTime}`);
    
    for (const existingTask of cleanerTasks) {
      const existingStart = new Date(`${existingTask.date} ${existingTask.startTime}`);
      const existingEnd = new Date(`${existingTask.date} ${existingTask.endTime}`);
      
      // Añadir tiempo de buffer SOLO al final de la tarea existente
      const bufferMs = assignment.estimatedTravelTimeMinutes * 60 * 1000;
      const existingEndWithBuffer = new Date(existingEnd.getTime() + bufferMs);
      
      // Verificar solapamiento real: la nueva tarea NO puede empezar antes de que termine la existente + buffer
      // Pero SÍ puede empezar después de que termine la existente + buffer
      if (taskStart < existingEndWithBuffer && taskEnd > existingStart) {
        return false;
      }
    }

    return true;
  }
}

export const autoAssignmentEngine = new AutoAssignmentEngine();
