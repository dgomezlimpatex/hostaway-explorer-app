
import { propertyGroupStorage } from '../storage/propertyGroupStorage';
import { DatabaseService } from './databaseService';
import { AssignmentContext } from './types';
import { Task } from '@/types/calendar';
import { PropertyGroup } from '@/types/propertyGroups';

export class ContextBuilder {
  constructor(private databaseService: DatabaseService) {}

  async buildAssignmentContext(task: Task, propertyGroup: PropertyGroup): Promise<AssignmentContext> {
    const [cleanerAssignments, existingTasks, patterns] = await Promise.all([
      propertyGroupStorage.getCleanerAssignments(propertyGroup.id),
      this.databaseService.getExistingTasksForDate(task.date),
      this.databaseService.getAssignmentPatterns(propertyGroup.id)
    ]);

    return {
      task,
      propertyGroup,
      cleanerAssignments: cleanerAssignments.filter(ca => ca.isActive),
      existingTasks,
      patterns
    };
  }
}
