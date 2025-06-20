
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

    console.log(`🎯 ALGORITMO SATURACIÓN V4 CORREGIDO para tarea ${task.id} - ${task.startTime}`);

    // Algoritmo de saturación por prioridad CORREGIDO
    const availableCleaners = cleanerAssignments
      .filter(ca => ca.isActive)
      .sort((a, b) => a.priority - b.priority); // Ordenar por prioridad (1, 2, 3...)

    if (availableCleaners.length === 0) {
      return {
        cleanerId: null,
        cleanerName: null,
        confidence: 0,
        reason: 'No available cleaners',
        algorithm: 'priority-saturation-v4'
      };
    }

    console.log(`👥 Trabajadoras por prioridad: ${availableCleaners.map(c => `P${c.priority}-${c.cleanerId.slice(0,8)}`).join(', ')}`);

    // SATURACIÓN REAL: Probar CADA trabajadora por orden de prioridad
    for (const assignment of availableCleaners) {
      console.log(`🔍 Evaluando trabajadora prioridad ${assignment.priority} (${assignment.cleanerId.slice(0,8)})`);
      
      if (this.availabilityChecker.isCleanerAvailable(assignment, task, existingTasks)) {
        const cleanerTasks = existingTasks.filter(t => t.cleanerId === assignment.cleanerId);
        const cleanerInfo = await this.databaseService.getCleanerInfo(assignment.cleanerId);

        const reason = `🏆 SATURACIÓN V4: Prioridad ${assignment.priority}, Carga: ${cleanerTasks.length}/${assignment.maxTasksPerDay}`;
        console.log(`✅ ASIGNANDO a prioridad ${assignment.priority}: ${reason}`);

        return {
          cleanerId: assignment.cleanerId,
          cleanerName: cleanerInfo?.name || null,
          confidence: 1000 - (assignment.priority * 100) + (assignment.maxTasksPerDay - cleanerTasks.length),
          reason,
          algorithm: 'priority-saturation-v4'
        };
      } else {
        console.log(`❌ Trabajadora prioridad ${assignment.priority} NO disponible para esta tarea`);
      }
    }

    return {
      cleanerId: null,
      cleanerName: null,
      confidence: 0,
      reason: 'No available cleaners after priority check',
      algorithm: 'priority-saturation-v4'
    };
  }
}
