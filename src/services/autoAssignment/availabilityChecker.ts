
import { Task } from '@/types/calendar';
import { CleanerGroupAssignment } from '@/types/propertyGroups';

export class AvailabilityChecker {
  isCleanerAvailable(assignment: CleanerGroupAssignment, task: Task, existingTasks: Task[]): boolean {
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
