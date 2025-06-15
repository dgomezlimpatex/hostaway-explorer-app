
import { Task } from '@/types/calendar';
import { taskStorageService } from './storage/taskStorage';
import { taskAssignmentService } from './storage/taskAssignmentService';
import { taskCleanupService } from './storage/taskCleanupService';

// Main facade service that combines all task-related operations
export const taskStorageService = {
  // Basic CRUD operations
  getTasks: () => taskStorageService.getTasks(),
  createTask: (task: Omit<Task, 'id' | 'created_at' | 'updated_at'>) => taskStorageService.createTask(task),
  updateTask: (taskId: string, updates: Partial<Task>) => taskStorageService.updateTask(taskId, updates),
  deleteTask: (taskId: string) => taskCleanupService.deleteTask(taskId),

  // Bulk operations
  deleteAllTasks: () => taskCleanupService.deleteAllTasks(),

  // Assignment operations
  assignTask: (taskId: string, cleanerName: string, cleanerId?: string) => 
    taskAssignmentService.assignTask(taskId, cleanerName, cleanerId),
};
