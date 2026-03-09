
import { useMemo } from 'react';
import { useCleaners } from './useCleaners';
import { useTasks } from './useTasks';
import { useCalendarNavigation } from './useCalendarNavigation';
import { useRecurringTaskInstances } from './useRecurringTaskInstances';
import { useAuth } from './useAuth';
import { formatMadridDate } from '@/utils/date';

export const useCalendarData = () => {
  const {
    currentDate,
    currentView,
    setCurrentDate,
    setCurrentView,
    navigateDate,
    goToToday
  } = useCalendarNavigation();

  const { userRole, user } = useAuth();
  const { cleaners: allCleaners, isInitialLoading: isInitialLoadingCleaners } = useCleaners();
  
  // Filter out inactive cleaners for calendar display
  const cleaners = allCleaners.filter(c => c.isActive !== false);

  // Get current user's cleaner ID if they are a cleaner
  const currentCleanerId = useMemo(() => {
    if (userRole !== 'cleaner' || !user?.id || !allCleaners) return null;
    const currentCleaner = allCleaners.find(cleaner => cleaner.user_id === user.id);
    return currentCleaner?.id || null;
  }, [userRole, user?.id, allCleaners]);
  
  const {
    tasks: realTasks,
    isLoading: isLoadingTasks,
    isInitialLoading: isInitialLoadingTasks,
    updateTask,
    createTask,
    deleteTask,
    deleteAllTasks,
    assignTask: assignTaskMutation,
    unassignTask: unassignTaskMutation,
    isUpdatingTask,
    isCreatingTask,
    isDeletingTask,
    isDeletingAllTasks,
    isAssigningTask,
    isUnassigningTask
  } = useTasks(currentDate, currentView);

  // Calculate date range for recurring task instances
  const dateRange = useMemo(() => {
    const viewDate = new Date(currentDate);
    let dateFrom: Date;
    let dateTo: Date;
    
    switch (currentView) {
      case 'day':
      case 'three-day':
        dateFrom = new Date(viewDate);
        dateFrom.setDate(dateFrom.getDate() - 14);
        dateTo = new Date(viewDate);
        dateTo.setDate(dateTo.getDate() + 14);
        break;
      case 'week':
        dateFrom = new Date(viewDate);
        dateFrom.setDate(dateFrom.getDate() - 21);
        dateTo = new Date(viewDate);
        dateTo.setDate(dateTo.getDate() + 21);
        break;
      default:
        dateFrom = new Date(viewDate);
        dateFrom.setDate(dateFrom.getDate() - 14);
        dateTo = new Date(viewDate);
        dateTo.setDate(dateTo.getDate() + 14);
    }
    
    return {
      dateFrom: formatMadridDate(dateFrom),
      dateTo: formatMadridDate(dateTo)
    };
  }, [currentDate, currentView]);

  // Fetch virtual recurring task instances
  const { virtualTasks } = useRecurringTaskInstances({
    dateFrom: dateRange.dateFrom,
    dateTo: dateRange.dateTo,
    cleanerId: userRole === 'cleaner' ? currentCleanerId : undefined,
  });

  // Merge real tasks with virtual recurring instances (avoiding duplicates)
  const tasks = useMemo(() => {
    if (virtualTasks.length === 0) return realTasks;
    
    // Build a set of existing task dates+property combos to detect already-generated tasks
    const existingTaskKeys = new Set(
      realTasks.map(t => `${t.date}_${t.propertyId}_${t.startTime}`)
    );
    
    // Filter out virtual tasks that already have a real task
    const newVirtualTasks = virtualTasks.filter(vt => {
      const key = `${vt.date}_${vt.propertyId}_${vt.startTime}`;
      return !existingTaskKeys.has(key);
    });
    
    return [...realTasks, ...newVirtualTasks];
  }, [realTasks, virtualTasks]);

  // Wrapper for assign task to include cleaners data
  const assignTask = ({ taskId, cleanerId, cleaners: cleanersArray }: { taskId: string; cleanerId: string; cleaners: any[] }) => {
    assignTaskMutation({ taskId, cleanerId, cleaners: cleanersArray });
  };

  return {
    // Data
    tasks,
    cleaners,
    currentDate,
    currentView,
    
    // Loading states - only show full loading for initial load, not refetching
    isLoading: isInitialLoadingTasks || isInitialLoadingCleaners,
    
    // Actions
    setCurrentDate,
    setCurrentView,
    navigateDate,
    goToToday,
    updateTask,
    assignTask,
    unassignTask: unassignTaskMutation,
    createTask,
    deleteTask,
    deleteAllTasks,
    
    // Mutation states
    isUpdatingTask,
    isAssigningTask,
    isUnassigningTask,
    isCreatingTask,
    isDeletingTask,
    isDeletingAllTasks,
  };
};

// Re-export types for backward compatibility
export type { Task, Cleaner } from '@/types/calendar';
