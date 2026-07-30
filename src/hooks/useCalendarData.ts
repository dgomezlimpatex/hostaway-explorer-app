
import { useMemo } from 'react';
import { useCleaners } from './useCleaners';
import { useTasks } from './useTasks';
import { useCalendarNavigation } from './useCalendarNavigation';
import { useRecurringTaskInstances } from './useRecurringTaskInstances';
import { useAuth } from './useAuth';
import { Cleaner, Task } from '@/types/calendar';
import { filterTasksByQueryRange, getTaskDateRange, getTaskWindowRange } from '@/utils/taskQueryRange';

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
    assignTaskWithSchedule: assignTaskWithScheduleMutation,
    unassignTask: unassignTaskMutation,
    isUpdatingTask,
    isCreatingTask,
    isDeletingTask,
    isDeletingAllTasks,
    isAssigningTask,
    isUnassigningTask
  } = useTasks(currentDate, currentView);

  // Cleaner calendars render the selected date plus tomorrow. Other roles
  // render the exact active day/three-day/week range.
  const dateRange = useMemo(
    () => userRole === 'cleaner'
      ? getTaskWindowRange(currentDate, 2)
      : getTaskDateRange(currentDate, currentView),
    [currentDate, currentView, userRole],
  );

  // Fetch virtual recurring task instances
  const { virtualTasks: allVirtualTasks } = useRecurringTaskInstances({
    dateFrom: dateRange.dateFrom,
    dateTo: dateRange.dateTo,
    cleanerId: userRole === 'cleaner' ? currentCleanerId : undefined,
  });

  // Merge real tasks with virtual recurring instances
  const tasks = useMemo(() => {
    if (allVirtualTasks.length === 0) return realTasks;
    
    // Filter virtual tasks by current view (same as real tasks)
    const filteredVirtual = userRole === 'cleaner' 
      ? allVirtualTasks 
      : filterTasksByQueryRange(allVirtualTasks, currentDate, currentView);
    
    if (filteredVirtual.length === 0) return realTasks;
    
    // Build dedup keys: only consider a real task as the materialization of a
    // recurring instance when propertyId + date + startTime + cleanerId all match.
    // The authoritative dedup against the cron is handled via
    // recurring_task_executions inside useRecurringTaskInstances; this is just a
    // safety net for cases where the execution row is missing.
    const existingKeys = new Set<string>();
    for (const t of realTasks) {
      if (t.propertyId && t.cleanerId) {
        existingKeys.add(`${t.date}_${t.propertyId}_${t.startTime}_${t.cleanerId}`);
      }
    }

    // Filter out virtual tasks that already have a corresponding real task
    const newVirtualTasks = filteredVirtual.filter(vt => {
      if (!vt.propertyId || !vt.cleanerId) return true;
      const key = `${vt.date}_${vt.propertyId}_${vt.startTime}_${vt.cleanerId}`;
      return !existingKeys.has(key);
    });
    
    return [...realTasks, ...newVirtualTasks];
  }, [realTasks, allVirtualTasks, currentDate, currentView, userRole]);

  // Wrapper for assign task to include cleaners data
  const assignTask = ({ taskId, cleanerId, cleaners: cleanersArray }: { taskId: string; cleanerId: string; cleaners: Cleaner[] }) => {
    assignTaskMutation({ taskId, cleanerId, cleaners: cleanersArray });
  };

  // Optimized: assign + reschedule in a single round-trip
  const assignTaskWithSchedule = async (params: {
    taskId: string;
    cleanerId: string;
    cleanerName: string;
    startTime?: string;
    endTime?: string;
  }) => {
    return await assignTaskWithScheduleMutation(params);
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
    assignTaskWithSchedule,
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
