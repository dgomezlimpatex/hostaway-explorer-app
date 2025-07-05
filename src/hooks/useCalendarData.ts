
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
