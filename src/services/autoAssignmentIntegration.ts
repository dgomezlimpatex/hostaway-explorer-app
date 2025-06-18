
import { autoAssignmentEngine } from './autoAssignmentEngine';
import { supabase } from '@/integrations/supabase/client';

class AutoAssignmentIntegration {
  // Hook que se ejecuta después de crear una tarea desde Hostaway
  async processNewTask(taskId: string): Promise<void> {
    console.log(`Processing auto-assignment for task ${taskId}`);
    
    try {
      const result = await autoAssignmentEngine.assignTask(taskId);
      
      if (result.cleanerId) {
        console.log(`Task ${taskId} auto-assigned to ${result.cleanerName} (confidence: ${result.confidence}%)`);
      } else {
        console.log(`Task ${taskId} could not be auto-assigned: ${result.reason}`);
      }
    } catch (error) {
      console.error(`Error in auto-assignment for task ${taskId}:`, error);
    }
  }

  // Procesar múltiples tareas (útil para batch processing)
  async processBatchTasks(taskIds: string[]): Promise<void> {
    console.log(`Processing auto-assignment for ${taskIds.length} tasks`);
    
    for (const taskId of taskIds) {
      await this.processNewTask(taskId);
      // Pequeña pausa para evitar sobrecarga
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Actualizar patrones de aprendizaje basados en tareas completadas
  async updateLearningPatterns(): Promise<void> {
    console.log('Updating learning patterns from completed tasks');
    
    try {
      // Obtener tareas completadas recientes para actualizar patrones
      const { data: completedTasks, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('status', 'completed')
        .not('cleaner_id', 'is', null)
        .not('propiedad_id', 'is', null)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Últimos 30 días

      if (error) {
        console.error('Error fetching completed tasks:', error);
        return;
      }

      if (!completedTasks || completedTasks.length === 0) {
        console.log('No completed tasks found for pattern learning');
        return;
      }

      // Procesar cada tarea para actualizar patrones
      for (const task of completedTasks) {
        await this.updateTaskPattern(task);
      }

      console.log(`Updated learning patterns for ${completedTasks.length} completed tasks`);
    } catch (error) {
      console.error('Error updating learning patterns:', error);
    }
  }

  private async updateTaskPattern(task: any): Promise<void> {
    try {
      // Verificar si la propiedad pertenece a un grupo
      const { data: groupData, error: groupError } = await supabase
        .from('property_group_assignments')
        .select('property_group_id')
        .eq('property_id', task.propiedad_id)
        .single();

      if (groupError || !groupData) {
        return; // La propiedad no está en ningún grupo
      }

      const taskDate = new Date(task.date);
      const dayOfWeek = taskDate.getDay();
      const hourOfDay = parseInt(task.start_time.split(':')[0]);

      // Buscar patrón existente
      const { data: existingPattern, error: patternError } = await supabase
        .from('assignment_patterns')
        .select('*')
        .eq('property_group_id', groupData.property_group_id)
        .eq('cleaner_id', task.cleaner_id)
        .eq('day_of_week', dayOfWeek)
        .eq('hour_of_day', hourOfDay)
        .single();

      if (patternError && patternError.code !== 'PGRST116') {
        console.error('Error fetching pattern:', patternError);
        return;
      }

      // Calcular métricas de la tarea
      const startTime = new Date(`${task.date} ${task.start_time}`);
      const endTime = new Date(`${task.date} ${task.end_time}`);
      const completionTime = Math.round((endTime.getTime() - startTime.getTime()) / 60000); // minutos

      if (existingPattern) {
        // Actualizar patrón existente
        const newSampleSize = existingPattern.sample_size + 1;
        const newAvgCompletionTime = Math.round(
          ((existingPattern.avg_completion_time_minutes || 0) * existingPattern.sample_size + completionTime) / newSampleSize
        );

        await supabase
          .from('assignment_patterns')
          .update({
            avg_completion_time_minutes: newAvgCompletionTime,
            sample_size: newSampleSize,
            preference_score: Math.min(100, (existingPattern.preference_score || 50) + 2), // Incrementar preferencia
            last_updated: new Date().toISOString()
          })
          .eq('id', existingPattern.id);
      } else {
        // Crear nuevo patrón
        await supabase
          .from('assignment_patterns')
          .insert({
            property_group_id: groupData.property_group_id,
            cleaner_id: task.cleaner_id,
            day_of_week: dayOfWeek,
            hour_of_day: hourOfDay,
            avg_completion_time_minutes: completionTime,
            sample_size: 1,
            preference_score: 60, // Puntuación inicial positiva
            success_rate: 100
          });
      }
    } catch (error) {
      console.error('Error updating task pattern:', error);
    }
  }
}

export const autoAssignmentIntegration = new AutoAssignmentIntegration();
