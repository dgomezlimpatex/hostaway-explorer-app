
import { Task } from '@/types/calendar';
import { CleanerGroupAssignment } from '@/types/propertyGroups';

export class AvailabilityChecker {
  isCleanerAvailable(assignment: CleanerGroupAssignment, task: Task, existingTasks: Task[]): boolean {
    const cleanerTasks = existingTasks.filter(t => t.cleanerId === assignment.cleanerId);
    
    console.log(`🔍 Verificando disponibilidad trabajadora ${assignment.cleanerId.slice(0,8)} (P${assignment.priority})`);
    console.log(`   - Tareas actuales: ${cleanerTasks.length}/${assignment.maxTasksPerDay}`);
    console.log(`   - Nueva tarea: ${task.startTime}-${task.endTime}`);
    
    // Verificar límite diario de tareas
    if (cleanerTasks.length >= assignment.maxTasksPerDay) {
      console.log(`❌ Límite diario alcanzado: ${cleanerTasks.length}/${assignment.maxTasksPerDay}`);
      return false;
    }

    // Si no hay tareas existentes, está disponible
    if (cleanerTasks.length === 0) {
      console.log(`✅ Sin tareas previas, DISPONIBLE`);
      return true;
    }

    // Verificar si puede hacer la tarea secuencialmente
    const taskStart = new Date(`${task.date} ${task.startTime}`);
    const taskEnd = new Date(`${task.date} ${task.endTime}`);
    
    // Ordenar tareas existentes por hora de inicio
    const sortedTasks = cleanerTasks.sort((a, b) => {
      const timeA = new Date(`${a.date} ${a.startTime}`).getTime();
      const timeB = new Date(`${b.date} ${b.startTime}`).getTime();
      return timeA - timeB;
    });

    console.log(`   - Tareas existentes: ${sortedTasks.map(t => `${t.startTime}-${t.endTime}`).join(', ')}`);

    // Verificar si puede insertarse entre tareas existentes o al final
    for (let i = 0; i <= sortedTasks.length; i++) {
      let canFitHere = false;
      let slotDescription = '';
      
      if (i === 0) {
        // Antes de la primera tarea
        if (sortedTasks.length === 0) {
          canFitHere = true;
          slotDescription = 'única tarea del día';
        } else {
          const firstTaskStart = new Date(`${sortedTasks[0].date} ${sortedTasks[0].startTime}`);
          const bufferMs = assignment.estimatedTravelTimeMinutes * 60 * 1000;
          canFitHere = taskEnd.getTime() + bufferMs <= firstTaskStart.getTime();
          slotDescription = `antes de ${sortedTasks[0].startTime}`;
        }
      } else if (i === sortedTasks.length) {
        // Después de la última tarea
        const lastTask = sortedTasks[i - 1];
        const lastTaskEnd = new Date(`${lastTask.date} ${lastTask.endTime}`);
        const bufferMs = assignment.estimatedTravelTimeMinutes * 60 * 1000;
        canFitHere = taskStart.getTime() >= lastTaskEnd.getTime() + bufferMs;
        slotDescription = `después de ${lastTask.endTime}`;
      } else {
        // Entre dos tareas
        const prevTask = sortedTasks[i - 1];
        const nextTask = sortedTasks[i];
        const prevTaskEnd = new Date(`${prevTask.date} ${prevTask.endTime}`);
        const nextTaskStart = new Date(`${nextTask.date} ${nextTask.startTime}`);
        const bufferMs = assignment.estimatedTravelTimeMinutes * 60 * 1000;
        
        canFitHere = taskStart.getTime() >= prevTaskEnd.getTime() + bufferMs &&
                     taskEnd.getTime() + bufferMs <= nextTaskStart.getTime();
        slotDescription = `entre ${prevTask.endTime} y ${nextTask.startTime}`;
      }
      
      console.log(`   - Posición ${i} (${slotDescription}): ${canFitHere ? '✅ CABE' : '❌ no cabe'}`);
      
      if (canFitHere) {
        console.log(`✅ PUEDE hacer la tarea en posición ${i}`);
        return true;
      }
    }

    console.log(`❌ NO puede insertar la tarea en ninguna posición disponible`);
    return false;
  }
}
