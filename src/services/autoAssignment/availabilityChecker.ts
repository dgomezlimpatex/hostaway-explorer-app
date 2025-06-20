
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

    // Verificar si puede hacer la tarea secuencialmente - LÓGICA MEJORADA
    const taskStart = new Date(`${task.date} ${task.startTime}`);
    const taskEnd = new Date(`${task.date} ${task.endTime}`);
    
    console.log(`🔍 Verificando disponibilidad para tarea ${taskStart.toLocaleTimeString()}-${taskEnd.toLocaleTimeString()}`);
    
    // Ordenar tareas existentes por hora de inicio
    const sortedTasks = cleanerTasks.sort((a, b) => {
      const timeA = new Date(`${a.date} ${a.startTime}`).getTime();
      const timeB = new Date(`${b.date} ${b.startTime}`).getTime();
      return timeA - timeB;
    });

    // Verificar si puede insertarse entre tareas existentes o al final
    for (let i = 0; i <= sortedTasks.length; i++) {
      let canFitHere = false;
      
      if (i === 0) {
        // Antes de la primera tarea
        if (sortedTasks.length === 0) {
          canFitHere = true;
        } else {
          const firstTaskStart = new Date(`${sortedTasks[0].date} ${sortedTasks[0].startTime}`);
          const bufferMs = assignment.estimatedTravelTimeMinutes * 60 * 1000;
          canFitHere = taskEnd.getTime() + bufferMs <= firstTaskStart.getTime();
        }
      } else if (i === sortedTasks.length) {
        // Después de la última tarea
        const lastTask = sortedTasks[i - 1];
        const lastTaskEnd = new Date(`${lastTask.date} ${lastTask.endTime}`);
        const bufferMs = assignment.estimatedTravelTimeMinutes * 60 * 1000;
        canFitHere = taskStart.getTime() >= lastTaskEnd.getTime() + bufferMs;
      } else {
        // Entre dos tareas
        const prevTask = sortedTasks[i - 1];
        const nextTask = sortedTasks[i];
        const prevTaskEnd = new Date(`${prevTask.date} ${prevTask.endTime}`);
        const nextTaskStart = new Date(`${nextTask.date} ${nextTask.startTime}`);
        const bufferMs = assignment.estimatedTravelTimeMinutes * 60 * 1000;
        
        canFitHere = taskStart.getTime() >= prevTaskEnd.getTime() + bufferMs &&
                     taskEnd.getTime() + bufferMs <= nextTaskStart.getTime();
      }
      
      if (canFitHere) {
        console.log(`✅ Puede insertar tarea en posición ${i} de ${sortedTasks.length} tareas existentes`);
        return true;
      }
    }

    console.log(`❌ No puede insertar la tarea en ninguna posición disponible`);
    return false;
  }
}
