
import { useCleaners } from './useCleaners';
import { useTasks } from './useTasks';
import { useCalendarNavigation } from './useCalendarNavigation';

export const useCalendarData = () => {
  const {
    currentDate,
    currentView,
    setCurrentDate,
    setCurrentView,
    navigateDate,
    goToToday
  } = useCalendarNavigation();

  const { cleaners, isLoading: isLoadingCleaners } = useCleaners();
  
  const {
    tasks,
    isLoading: isLoadingTasks,
    updateTask,
    createTask,
    deleteTask,
    assignTask: assignTaskMutation,
    isUpdatingTask,
    isCreatingTask,
    isDeletingTask,
    isAssigningTask
  } = useTasks(currentDate, currentView);

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
    
    // Loading states
    isLoading: isLoadingTasks || isLoadingCleaners,
    
    // Actions
    setCurrentDate,
    setCurrentView,
    navigateDate,
    goToToday,
    updateTask,
    assignTask,
    createTask,
    deleteTask,
    
    // Mutation states
    isUpdatingTask,
    isAssigningTask,
    isCreatingTask,
    isDeletingTask,
  };
};

// Re-export types for backward compatibility
export type { Task, Cleaner } from '@/types/calendar';
