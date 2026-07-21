import { DatabaseService } from './databaseService';
import { AssignmentResult } from './types';

class AutoAssignmentEngine {
  private databaseService = new DatabaseService();

  async assignTask(taskId: string): Promise<AssignmentResult> {
    try {
      // La selección, revalidación, asignación, metadata y log ocurren en una única RPC.
      return await this.databaseService.autoAssignTask(taskId);
    } catch (error) {
      console.error('Error in transactional auto assignment:', error);
      return {
        cleanerId: null,
        cleanerName: null,
        confidence: 0,
        reason: `Error: ${error instanceof Error ? error.message : String(error)}`,
        algorithm: 'error',
      };
    }
  }
}

export const autoAssignmentEngine = new AutoAssignmentEngine();
