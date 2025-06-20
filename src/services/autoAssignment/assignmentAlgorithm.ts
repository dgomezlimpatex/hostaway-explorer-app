
import { AssignmentContext, AssignmentResult } from './types';
import { DatabaseService } from './databaseService';
import { AvailabilityChecker } from './availabilityChecker';

export class AssignmentAlgorithm {
  constructor(
    private databaseService: DatabaseService,
    private availabilityChecker: AvailabilityChecker
  ) {}

  async executeAssignmentAlgorithm(context: AssignmentContext): Promise<AssignmentResult> {
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
      
      if (this.availabilityChecker.isCleanerAvailable(assignment, task, existingTasks)) {
        const cleanerTasks = existingTasks.filter(t => t.cleanerId === assignment.cleanerId);
        const cleanerInfo = await this.databaseService.getCleanerInfo(assignment.cleanerId);

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
}
