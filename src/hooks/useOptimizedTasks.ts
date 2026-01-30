import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { Task, ViewType } from '@/types/calendar';
import { taskStorageService } from '@/services/taskStorage';
import { useAuth } from '@/hooks/useAuth';
import { useCleaners } from '@/hooks/useCleaners';
import { useSede } from '@/contexts/SedeContext';

// IMPORTANT: avoid Date#toISOString() for UI date matching because it uses UTC.
// Business logic here should match the Madrid day, regardless of user's device timezone.
const toMadridDateString = (date: Date): string => {
  const madridDate = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
  return madridDate.toISOString().split('T')[0];
};

interface UseOptimizedTasksProps {
  currentDate: Date;
  currentView: ViewType;
  enabled?: boolean;
}

export const useOptimizedTasks = ({ 
  currentDate, 
  currentView, 
  enabled = true 
}: UseOptimizedTasksProps) => {
  const queryClient = useQueryClient();
  const { userRole, user } = useAuth();
  const { cleaners } = useCleaners();
  const { activeSede, isInitialized, loading } = useSede();

  // Get current user's cleaner ID if they are a cleaner
  const currentCleanerId = useMemo(() => {
    if (userRole !== 'cleaner' || !user?.id || !cleaners) return null;
    const currentCleaner = cleaners.find(cleaner => cleaner.user_id === user.id);
    return currentCleaner?.id || null;
  }, [userRole, user?.id, cleaners]);

  // OPTIMIZED: Simpler query key - for cleaners we don't need date in key since we fetch all their tasks
  const queryKey = useMemo(() => {
    if (userRole === 'cleaner' && currentCleanerId) {
      return ['tasks', 'cleaner', currentCleanerId, activeSede?.id || 'no-sede'];
    }
    return [
      'tasks',
      toMadridDateString(currentDate),
      currentView,
      activeSede?.id || 'no-sede'
    ];
  }, [currentDate, currentView, activeSede?.id, userRole, currentCleanerId]);

  // Robust function to add/subtract months without date overflow issues
  const addMonths = (date: Date, months: number): Date => {
    const result = new Date(date);
    const targetMonth = result.getMonth() + months;
    result.setDate(1); // Set to first day to avoid overflow
    result.setMonth(targetMonth);
    // Set to last day of month if original day was higher than new month's days
    const originalDay = date.getDate();
    const daysInNewMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
    result.setDate(Math.min(originalDay, daysInNewMonth));
    return result;
  };

  // Calculate date range based on current view - this ensures we load the right data
  const dateRange = useMemo(() => {
    const viewDate = new Date(currentDate);
    let dateFrom: Date;
    let dateTo: Date;
    
    switch (currentView) {
      case 'day':
        // For day view, load ±45 days from the viewed date (safer than month calculation)
        dateFrom = new Date(viewDate);
        dateFrom.setDate(dateFrom.getDate() - 45);
        dateTo = new Date(viewDate);
        dateTo.setDate(dateTo.getDate() + 45);
        break;
      case 'three-day':
        // For 3-day view, load ±45 days from the viewed date
        dateFrom = new Date(viewDate);
        dateFrom.setDate(dateFrom.getDate() - 45);
        dateTo = new Date(viewDate);
        dateTo.setDate(dateTo.getDate() + 45);
        break;
      case 'week':
        // For week view, load ±60 days from the viewed date
        dateFrom = new Date(viewDate);
        dateFrom.setDate(dateFrom.getDate() - 60);
        dateTo = new Date(viewDate);
        dateTo.setDate(dateTo.getDate() + 60);
        break;
      default:
        dateFrom = new Date(viewDate);
        dateFrom.setDate(dateFrom.getDate() - 45);
        dateTo = new Date(viewDate);
        dateTo.setDate(dateTo.getDate() + 45);
    }
    
    return {
      dateFrom: toMadridDateString(dateFrom),
      dateTo: toMadridDateString(dateTo)
    };
  }, [currentDate, currentView]);

  // Determine if we can fetch tasks:
  // - We need an activeSede (either restored from localStorage or loaded from server)
  // - For cleaners, we also need their cleanerId
  // - If isInitialized is true, the server has validated the sede
  // - If activeSede exists but isInitialized is false, we can still fetch (sede was restored from localStorage)
  const canFetchTasks = enabled && 
    !!activeSede?.id && 
    (isInitialized || !loading) && // Either fully initialized OR not in loading state
    (userRole !== 'cleaner' || currentCleanerId !== null);

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      // OPTIMIZED: For cleaners, use server-side filtering
      if (userRole === 'cleaner' && currentCleanerId) {
        return taskStorageService.getTasks({
          cleanerId: currentCleanerId,
          userRole: 'cleaner',
          sedeId: activeSede?.id
        });
      }
      
      // For non-cleaners, fetch tasks based on the current view date range
      const allTasks = await taskStorageService.getTasks({
        sedeId: activeSede?.id,
        dateFrom: dateRange.dateFrom,
        dateTo: dateRange.dateTo
      });
      
      const sedeId = activeSede?.id || 'no-sede';
      queryClient.setQueryData(['tasks', 'all', sedeId], allTasks);
      
      return filterTasksByView(allTasks, currentDate, currentView);
    },
    staleTime: userRole === 'cleaner' ? 30000 : 0, // Cleaners can have stale data for 30s
    gcTime: 60000,
    enabled: canFetchTasks,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
  
  const { data: tasks = [], isLoading, error } = query;

  // Filter tasks by view for display (only applies date filtering for non-cleaners in memo)
  const filteredTasks = useMemo(() => {
    if (!tasks || tasks.length === 0) {
      return [];
    }
    
    const validTasks = tasks.filter(task => task && task.date);
    
    // For cleaners, don't apply view-based filtering - let them see all their tasks
    if (userRole === 'cleaner') {
      return validTasks;
    }
    
    return filterTasksByView(validTasks, currentDate, currentView);
  }, [tasks, currentDate, currentView, userRole]);

  // Prefetch for next dates (only for non-cleaners)
  useEffect(() => {
    if (!enabled || !activeSede?.id || userRole === 'cleaner') return;

    const tomorrow = new Date(currentDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const nextWeek = new Date(currentDate);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const sedeId = activeSede?.id || 'no-sede';

    [tomorrow, nextWeek].forEach(date => {
      queryClient.prefetchQuery({
        queryKey: ['tasks', toMadridDateString(date), currentView, sedeId],
        queryFn: async () => {
          const allTasks = (queryClient.getQueryData(['tasks', 'all', sedeId]) as Task[] | undefined) ||
            await taskStorageService.getTasks({ sedeId: activeSede?.id });

          return filterTasksByView(allTasks, date, currentView);
        },
        staleTime: 5 * 60 * 1000,
      });
    });
  }, [currentDate, currentView, queryClient, enabled, activeSede?.id, userRole]);

  return {
    tasks: filteredTasks,
    isLoading,
    isInitialLoading: isLoading && query.fetchStatus !== 'idle',
    error,
    queryKey,
    debugInfo: {
      rawTasksCount: tasks?.length || 0,
      filteredTasksCount: filteredTasks?.length || 0,
      currentDateStr: toMadridDateString(currentDate),
      userRole,
      activeSede: activeSede?.id
    }
  };
};

// Helper function to filter tasks by view
function filterTasksByView(tasks: Task[], currentDate: Date, currentView: ViewType): Task[] {
  const currentDateStr = toMadridDateString(currentDate);
  
  switch (currentView) {
    case 'day':
      return tasks.filter(task => task.date === currentDateStr);
    
    case 'three-day':
      const threeDayDates = Array.from({ length: 3 }, (_, i) => {
        const date = new Date(currentDate);
        date.setDate(date.getDate() + i);
        return toMadridDateString(date);
      });
      return tasks.filter(task => threeDayDates.includes(task.date));
    
    case 'week':
      const startOfWeek = new Date(currentDate);
      const dayOfWeek = startOfWeek.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      startOfWeek.setDate(startOfWeek.getDate() + mondayOffset);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      
      const startDateStr = toMadridDateString(startOfWeek);
      const endDateStr = toMadridDateString(endOfWeek);
      
      return tasks.filter(task => task.date >= startDateStr && task.date <= endDateStr);
    
    default:
      return tasks;
  }
}
