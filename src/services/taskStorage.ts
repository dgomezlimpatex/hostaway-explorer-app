
import { Task } from '@/types/calendar';
import { taskStorageService as baseTaskStorage } from './storage/taskStorage';
import { taskAssignmentService } from './storage/taskAssignmentService';
import { taskCleanupService } from './storage/taskCleanupService';

export const taskStorageService = {
  // Basic CRUD operations
  getTasks: () => baseTaskStorage.getTasks(),
  createTask: (task: Omit<Task, 'id' | 'created_at' | 'updated_at'>) => baseTaskStorage.createTask(task),
  updateTask: (taskId: string, updates: Partial<Task>) => baseTaskStorage.updateTask(taskId, updates),
  deleteTask: (taskId: string) => taskCleanupService.deleteTask(taskId),

  // Bulk operations
  deleteAllTasks: () => taskCleanupService.deleteAllTasks(),

  // Assignment operations
  assignTask: (taskId: string, cleanerName: string, cleanerId?: string) => 
    taskAssignmentService.assignTask(taskId, cleanerName, cleanerId),
  unassignTask: (taskId: string) => taskAssignmentService.unassignTask(taskId),
  updateTaskSchedule: (taskId: string, updates: Partial<Task>, originalTask?: Task) => 
    taskAssignmentService.updateTaskSchedule(taskId, updates, originalTask),
  cancelTask: (taskId: string) => taskAssignmentService.cancelTask(taskId),
};
