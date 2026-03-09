
import { useMemo } from 'react';
import { useCleaners } from './useCleaners';
import { useTasks } from './useTasks';
import { useCalendarNavigation } from './useCalendarNavigation';
import { useRecurringTaskInstances } from './useRecurringTaskInstances';
import { useAuth } from './useAuth';
import { formatMadridDate } from '@/utils/date';
import { Task, ViewType } from '@/types/calendar';

// Filter tasks by view (same logic as useOptimizedTasks)
function filterTasksByView(tasks: Task[], currentDate: Date, currentView: ViewType): Task[] {
  const currentDateStr = formatMadridDate(currentDate);
  
  switch (currentView) {
    case 'day':
      return tasks.filter(task => task.date === currentDateStr);
    
    case 'three-day': {
      const threeDayDates = Array.from({ length: 3 }, (_, i) => {
        const date = new Date(currentDate);
        date.setDate(date.getDate() + i);
        return formatMadridDate(date);
      });
      return tasks.filter(task => threeDayDates.includes(task.date));
    }
    
    case 'week': {
      const startOfWeek = new Date(currentDate);
      const dayOfWeek = startOfWeek.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      startOfWeek.setDate(startOfWeek.getDate() + mondayOffset);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      
      const startDateStr = formatMadridDate(startOfWeek);
      const endDateStr = formatMadridDate(endOfWeek);
      
      return tasks.filter(task => task.date >= startDateStr && task.date <= endDateStr);
    }
    
    default:
      return tasks;
  }
}

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
      : filterTasksByView(allVirtualTasks, currentDate, currentView);
    
    if (filteredVirtual.length === 0) return realTasks;
    
    // Build dedup keys from real tasks using multiple strategies
    const existingKeys = new Set<string>();
    for (const t of realTasks) {
      // Key by propertyId + date + startTime (most reliable)
      if (t.propertyId) {
        existingKeys.add(`${t.date}_${t.propertyId}_${t.startTime}`);
      }
      // Also key by cleanerId + date + startTime for cases where property names vary
      if (t.cleanerId) {
        existingKeys.add(`cleaner_${t.date}_${t.cleanerId}_${t.startTime}`);
      }
    }
    
    // Filter out virtual tasks that already have a corresponding real task
    const newVirtualTasks = filteredVirtual.filter(vt => {
      const propKey = `${vt.date}_${vt.propertyId}_${vt.startTime}`;
      const cleanerKey = `cleaner_${vt.date}_${vt.cleanerId}_${vt.startTime}`;
      return !existingKeys.has(propKey) && !existingKeys.has(cleanerKey);
    });
    
    return [...realTasks, ...newVirtualTasks];
  }, [realTasks, allVirtualTasks, currentDate, currentView, userRole]);

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
