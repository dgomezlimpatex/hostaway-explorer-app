import { useCallback, useRef } from 'react';
import { taskStorageService } from '@/services/taskStorage';

// Cache for getTasks to prevent redundant calls
let tasksCache: { data: any[], timestamp: number } | null = null;
const CACHE_DURATION = 2000; // 2 seconds cache

export const useOptimizedTaskStorage = () => {
  const fetchingRef = useRef<Promise<any> | null>(null);

  const optimizedGetTasks = useCallback(async () => {
    // Check if already fetching
    if (fetchingRef.current) {
      return fetchingRef.current;
    }

    // Check cache first
    if (tasksCache && Date.now() - tasksCache.timestamp < CACHE_DURATION) {
      return tasksCache.data;
    }

    // Create fetch promise
    fetchingRef.current = taskStorageService.getTasks();

    try {
      const data = await fetchingRef.current;
      
      // Update cache
      tasksCache = {
        data,
        timestamp: Date.now()
      };

      return data;
    } finally {
      // Clear the fetching promise
      fetchingRef.current = null;
    }
  }, []);

  const invalidateCache = useCallback(() => {
    tasksCache = null;
    fetchingRef.current = null;
  }, []);

  return {
    getTasks: optimizedGetTasks,
    createTask: taskStorageService.createTask.bind(taskStorageService),
    updateTask: taskStorageService.updateTask.bind(taskStorageService),
    deleteTask: taskStorageService.deleteTask.bind(taskStorageService),
    assignTask: taskStorageService.assignTask.bind(taskStorageService),
    unassignTask: taskStorageService.unassignTask.bind(taskStorageService),
    updateTaskSchedule: taskStorageService.updateTaskSchedule.bind(taskStorageService),
    cancelTask: taskStorageService.cancelTask.bind(taskStorageService),
    deleteAllTasks: taskStorageService.deleteAllTasks.bind(taskStorageService),
    invalidateCache
  };
};