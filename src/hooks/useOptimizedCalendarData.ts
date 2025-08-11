import { useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCleaners } from './useCleaners';
import { useOptimizedTasks } from './useOptimizedTasks';
import { useCalendarNavigation } from './useCalendarNavigation';
import { Task, Cleaner, ViewType } from '@/types/calendar';

interface UseOptimizedCalendarDataProps {
  currentDate: Date;
  currentView: ViewType;
  enabled?: boolean;
}

export const useOptimizedCalendarData = ({ 
  currentDate, 
  currentView, 
  enabled = true 
}: UseOptimizedCalendarDataProps) => {
  const {
    setCurrentDate,
    setCurrentView,
    navigateDate,
    goToToday
  } = useCalendarNavigation();

  // Optimized cleaners fetching with caching
  const { 
    cleaners, 
    isLoading: isLoadingCleaners 
  } = useCleaners();
  
  // Optimized tasks fetching
  const {
    tasks,
    isLoading: isLoadingTasks,
    error: tasksError
  } = useOptimizedTasks({
    currentDate,
    currentView,
    enabled
  });

  // Memoize processed data to avoid unnecessary recalculations
  const processedData = useMemo(() => {
    if (!tasks || !cleaners) {
      return {
        assignedTasks: [],
        unassignedTasks: [],
        cleanersWithTasks: []
      };
    }

    const assignedTasks = tasks.filter(task => task.cleanerId);
    const unassignedTasks = tasks.filter(task => !task.cleanerId);
    
    // Create a map of cleaners with their task counts for better performance
    const cleanersWithTasks = cleaners.map(cleaner => ({
      ...cleaner,
      taskCount: assignedTasks.filter(task => task.cleanerId === cleaner.id).length
    }));

    return {
      assignedTasks,
      unassignedTasks,
      cleanersWithTasks
    };
  }, [tasks, cleaners]);

  // Memoize task operations to prevent recreation
  const taskOperations = useMemo(() => ({
    getTasksByCleanerId: (cleanerId: string) => 
      processedData.assignedTasks.filter(task => task.cleanerId === cleanerId),
    
    getTasksByDate: (date: string) => 
      tasks?.filter(task => task.date === date) || [],
    
    getTaskById: (taskId: string) => 
      tasks?.find(task => task.id === taskId),
    
    getCleanerById: (cleanerId: string) => 
      cleaners.find(cleaner => cleaner.id === cleanerId)
  }), [processedData.assignedTasks, tasks, cleaners]);

  // Prefetch adjacent dates for smoother navigation
  const prefetchAdjacentDates = useCallback(() => {
    const nextDate = new Date(currentDate);
    nextDate.setDate(currentDate.getDate() + 1);
    
    const prevDate = new Date(currentDate);
    prevDate.setDate(currentDate.getDate() - 1);
    
    // This could trigger prefetch queries if needed
    // Currently handled by useOptimizedTasks
  }, [currentDate]);

  return {
    // Raw data
    tasks: tasks || [],
    cleaners,
    
    // Processed data
    assignedTasks: processedData.assignedTasks,
    unassignedTasks: processedData.unassignedTasks,
    cleanersWithTasks: processedData.cleanersWithTasks,
    
    // Navigation
    currentDate,
    currentView,
    setCurrentDate,
    setCurrentView,
    navigateDate,
    goToToday,
    
    // Task operations
    ...taskOperations,
    
    // Loading states
    isLoading: isLoadingTasks || isLoadingCleaners,
    error: tasksError,
    
    // Utilities
    prefetchAdjacentDates
  };
};

// Re-export types for backward compatibility
export type { Task, Cleaner } from '@/types/calendar';