
import { DatabaseService } from './databaseService';
import { ContextBuilder } from './contextBuilder';
import { AssignmentAlgorithm } from './assignmentAlgorithm';
import { AvailabilityChecker } from './availabilityChecker';
import { AssignmentResult } from './types';

class AutoAssignmentEngine {
  private databaseService: DatabaseService;
  private contextBuilder: ContextBuilder;
  private availabilityChecker: AvailabilityChecker;
  private assignmentAlgorithm: AssignmentAlgorithm;

  constructor() {
    this.databaseService = new DatabaseService();
    this.contextBuilder = new ContextBuilder(this.databaseService);
    this.availabilityChecker = new AvailabilityChecker();
    this.assignmentAlgorithm = new AssignmentAlgorithm(this.databaseService, this.availabilityChecker);
  }

  async assignTask(taskId: string): Promise<AssignmentResult> {
    try {
      // 1. Obtener la tarea
      const task = await this.databaseService.getTask(taskId);
      if (!task) {
        throw new Error('Task not found');
      }

      // 2. Determinar si la propiedad pertenece a un grupo con auto-asignación
      const propertyGroup = await this.databaseService.getPropertyGroup(task.propertyId);
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
      const context = await this.contextBuilder.buildAssignmentContext(task, propertyGroup);

      // 4. Ejecutar algoritmo de saturación por prioridad mejorado
      const result = await this.assignmentAlgorithm.executeAssignmentAlgorithm(context);

      // 5. Registrar el resultado
      await this.databaseService.logAssignment(taskId, propertyGroup.id, result);

      // 6. Actualizar la tarea si se asignó
      if (result.cleanerId) {
        await this.databaseService.updateTaskAssignment(taskId, result.cleanerId, result.cleanerName, result.confidence);
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
}

export const autoAssignmentEngine = new AutoAssignmentEngine();
