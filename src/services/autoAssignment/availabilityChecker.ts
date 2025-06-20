
import { Task } from '@/types/calendar';
import { CleanerGroupAssignment } from '@/types/propertyGroups';

export class AvailabilityChecker {
  isCleanerAvailable(assignment: CleanerGroupAssignment, task: Task, existingTasks: Task[]): boolean {
    const cleanerTasks = existingTasks.filter(t => t.cleanerId === assignment.cleanerId);
    
    // Verificar límite diario de tareas
    if (cleanerTasks.length >= assignment.maxTasksPerDay) {
      console.log(`❌ Trabajadora alcanzó límite diario: ${cleanerTasks.length}/${assignment.maxTasksPerDay}`);
      return false;
    }

    // Si no hay tareas existentes, está disponible
    if (cleanerTasks.length === 0) {
      console.log(`✅ Trabajadora sin tareas asignadas, disponible para nueva tarea`);
      return true;
    }

    // Verificar conflictos de horario - LÓGICA CORREGIDA
    const taskStart = new Date(`${task.date} ${task.startTime}`);
    const taskEnd = new Date(`${task.date} ${task.endTime}`);
    
    for (const existingTask of cleanerTasks) {
      const existingStart = new Date(`${existingTask.date} ${existingTask.startTime}`);
      const existingEnd = new Date(`${existingTask.date} ${existingTask.endTime}`);
      
      // Añadir tiempo de buffer al final de la tarea existente
      const bufferMs = assignment.estimatedTravelTimeMinutes * 60 * 1000;
      const existingEndWithBuffer = new Date(existingEnd.getTime() + bufferMs);
      
      console.log(`🔍 Comparando tiempos:
        Nueva: ${taskStart.toLocaleTimeString()} - ${taskEnd.toLocaleTimeString()}
        Existente: ${existingStart.toLocaleTimeString()} - ${existingEnd.toLocaleTimeString()}
        Con buffer: ${existingStart.toLocaleTimeString()} - ${existingEndWithBuffer.toLocaleTimeString()}`);
      
      // LÓGICA CORREGIDA: Verificar solapamiento real
      // La nueva tarea tiene conflicto SI:
      // 1. Empieza antes de que termine la existente + buffer Y
      // 2. Termina después de que empiece la existente
      const hasOverlap = (taskStart < existingEndWithBuffer) && (taskEnd > existingStart);
      
      if (hasOverlap) {
        console.log(`❌ CONFLICTO detectado entre tareas`);
        return false;
      }
    }

    console.log(`✅ Sin conflictos, trabajadora disponible`);
    return true;
  }
}
