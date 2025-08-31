
import { Task } from '@/types/calendar';
import { taskStorageService as baseTaskStorage } from './storage/taskStorage';
import { taskAssignmentService } from './storage/taskAssignmentService';
import { taskCleanupService } from './storage/taskCleanupService';

// Add caching and request deduplication
let lastFetchPromise: Promise<Task[]> | null = null;
let lastFetchTime: number = 0;
const CACHE_DURATION = 1000; // 1 second cache to prevent rapid repeated calls

export const taskStorageService = {
  // Basic CRUD operations with optimization
  getTasks: async (options?: {
    cleanerId?: string;
    includePastTasks?: boolean;
    userRole?: string;
    sedeId?: string;
  }): Promise<Task[]> => {
    console.log('🚀 FORCING FRESH QUERY - bypassing cache');
    
    // Force fresh query without cache for debugging
    const result = await baseTaskStorage.getTasks(options);
    console.log(`📋 taskStorage - FRESH QUERY loaded ${result.length} tasks with options:`, options);
    return result;
  },
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
