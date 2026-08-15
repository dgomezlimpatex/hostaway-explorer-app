import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Task, ViewType } from '@/types/calendar';
import { taskStorageService } from '@/services/taskStorage';
import { useAuth } from '@/hooks/useAuth';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import { useCleaners } from '@/hooks/useCleaners';
import { useSede } from '@/contexts/SedeContext';
import { formatMadridDate } from '@/utils/date';
import {
  filterTasksByDateRange,
  filterTasksByQueryRange,
  getTaskDateRange,
  getTaskWindowRange,
} from '@/utils/taskQueryRange';
import { isTaskAssignedToCleaner } from '@/utils/taskAssignments';

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
  const { userRole, user } = useAuth();
  const { isCleaner } = useRolePermissions();
  const cleanerView = isCleaner();
  const { cleaners } = useCleaners();
  const { activeSede, isInitialized, loading } = useSede();
  const activeSedeId = activeSede?.id || null;
  const canQueryTasks = Boolean(enabled && isInitialized && !loading && activeSedeId);

  // Get current user's cleaner ID if they are a cleaner
  const currentCleanerId = useMemo(() => {
    if (!cleanerView || !user?.id || !cleaners) return null;
    const currentCleaner = cleaners.find(cleaner => cleaner.user_id === user.id);
    return currentCleaner?.id || null;
  }, [cleanerView, user?.id, cleaners]);

  // Cleaner calendars render the selected date plus tomorrow. Manager views
  // use their own exact day/three-day/week range.
  const dateRange = useMemo(
    () => cleanerView
      ? getTaskWindowRange(currentDate, 2)
      : getTaskDateRange(currentDate, currentView),
    [currentDate, currentView, cleanerView],
  );

  // Every visible window gets its own cache entry, including cleaner navigation.
  const queryKey = useMemo(() => {
    if (cleanerView && currentCleanerId) {
      return [
        'tasks',
        'cleaner',
        currentCleanerId,
        dateRange.dateFrom,
        dateRange.dateTo,
        activeSedeId || 'pending-sede',
      ];
    }
    return [
      'tasks',
      formatMadridDate(currentDate),
      currentView,
      activeSedeId || 'pending-sede'
    ];
  }, [currentDate, currentView, activeSedeId, cleanerView, currentCleanerId, dateRange]);

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      console.log('📋 useOptimizedTasks - queryFn executing:', {
        userRole,
        currentCleanerId,
        activeSede: activeSedeId,
        dateRange,
        queryKey
      });
      
      // OPTIMIZED: For cleaners, use server-side filtering
      if (cleanerView && currentCleanerId) {
        const result = await taskStorageService.getTasks({
          cleanerId: currentCleanerId,
          userRole: 'cleaner',
          sedeId: activeSedeId,
          dateFrom: dateRange.dateFrom,
          dateTo: dateRange.dateTo,
        });
        console.log('📋 useOptimizedTasks - cleaner tasks loaded:', result.length);
        const canonicalTasks = result.filter((task) =>
          isTaskAssignedToCleaner(task, currentCleanerId)
        );
        return filterTasksByDateRange(canonicalTasks, dateRange);
      }
      
      // For non-cleaners, fetch tasks based on the current view date range
      console.log('📋 useOptimizedTasks - fetching tasks with params:', {
        sedeId: activeSedeId,
        dateFrom: dateRange.dateFrom,
        dateTo: dateRange.dateTo
      });
      
      const allTasks = await taskStorageService.getTasks({
        sedeId: activeSedeId,
        dateFrom: dateRange.dateFrom,
        dateTo: dateRange.dateTo
      });
      
      console.log('📋 useOptimizedTasks - tasks fetched:', allTasks.length);
      
      const filtered = filterTasksByView(allTasks, currentDate, currentView);
      console.log('📋 useOptimizedTasks - filtered tasks:', filtered.length);
      
      return filtered;
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    enabled: canQueryTasks && (!cleanerView || currentCleanerId !== null),
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
    if (cleanerView) {
      return validTasks;
    }
    
    return filterTasksByView(validTasks, currentDate, currentView);
  }, [tasks, currentDate, currentView, cleanerView]);


  return {
    tasks: filteredTasks,
    isLoading,
    isInitialLoading: isLoading && query.fetchStatus !== 'idle',
    error,
    queryKey,
    debugInfo: {
      rawTasksCount: tasks?.length || 0,
      filteredTasksCount: filteredTasks?.length || 0,
      currentDateStr: formatMadridDate(currentDate),
      userRole,
      activeSede: activeSedeId
    }
  };
};

// Keep post-query filtering aligned with the exact Madrid civil-date range used
// by the Supabase request. This avoids a second, timezone-dependent calculation.
function filterTasksByView(tasks: Task[], currentDate: Date, currentView: ViewType): Task[] {
  return filterTasksByQueryRange(tasks, currentDate, currentView);
}
