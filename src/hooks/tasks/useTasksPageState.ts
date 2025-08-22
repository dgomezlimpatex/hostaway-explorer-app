
import { useState, useMemo, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useTasks } from '@/hooks/useTasks';
import { useOptimizedPagination } from '@/hooks/useOptimizedPagination';
import { useCleaners } from '@/hooks/useCleaners';
import { useCacheInvalidation } from '@/hooks/useCacheInvalidation';
import { Task } from '@/types/calendar';
import { filterTasks, sortTasks } from '@/components/tasks/utils/taskFilters';

interface LocalTaskFilters {
  status: string;
  cleaner: string;
  dateRange: string;
  cliente: string;
  propiedad: string;
}

export const useTasksPageState = () => {
  const { userRole, user, profile } = useAuth();
  const { cleaners } = useCleaners();
  const queryClient = useQueryClient();
  const { invalidateTasks } = useCacheInvalidation();
  const [searchTerm, setSearchTerm] = useState('');
  const [showPastTasks, setShowPastTasks] = useState(false);
  const [filters, setFilters] = useState<LocalTaskFilters>({
    status: 'all',
    cleaner: 'all',
    dateRange: 'all',
    cliente: 'all',
    propiedad: 'all',
  });

  // Use ref to track last refetch to prevent excessive calls
  const lastRefetchRef = useRef<number>(0);

  // Use current date and week view for task fetching (fixing ViewType)
  const currentDate = new Date();
  const { tasks, isLoading, error } = useTasks(currentDate, 'week');

  // Get current user's cleaner ID
  const currentUserCleanerId = useMemo(() => {
    if (userRole !== 'cleaner' || !user?.id) return null;
    const currentCleaner = cleaners.find(cleaner => cleaner.user_id === user.id);
    return currentCleaner?.id || null;
  }, [cleaners, user?.id, userRole]);

  // Create a proper refetch function using React Query with debouncing
  const refetch = useCallback(() => {
    const now = Date.now();
    // Prevent excessive refetch calls (debounce by 1 second)
    if (now - lastRefetchRef.current < 1000) {
      console.log('useTasksPageState - refetch debounced');
      return;
    }
    
    lastRefetchRef.current = now;
    // Invalidar todas las queries de tareas con sistema centralizado
    invalidateTasks();
    console.log('useTasksPageState - invalidated task queries with centralized system');
  }, [invalidateTasks]);

  // Filter and sort tasks
  const filteredTasks = useMemo(() => {
    return filterTasks(tasks, { 
      searchTerm, 
      showPastTasks, 
      userRole,
      currentUserName: profile?.full_name || profile?.email,
      currentUserId: currentUserCleanerId,
      ...filters 
    });
  }, [tasks, searchTerm, showPastTasks, userRole, filters, profile, currentUserCleanerId]);

  const sortedTasks = useMemo(() => {
    return sortTasks(filteredTasks, showPastTasks, userRole);
  }, [filteredTasks, showPastTasks, userRole]);

  // Pagination
  const {
    currentPage,
    totalPages,
    paginatedData: paginatedTasks,
    goToPage: handlePageChange,
  } = useOptimizedPagination({
    data: sortedTasks,
    pageSize: 20,
  });

  const handleTogglePastTasks = useCallback(() => {
    setShowPastTasks(!showPastTasks);
  }, [showPastTasks]);

  return {
    searchTerm,
    filters,
    showPastTasks,
    currentPage,
    tasks,
    isLoading,
    error,
    sortedTasks,
    paginatedTasks,
    totalPages,
    setSearchTerm,
    setFilters,
    handleTogglePastTasks,
    handlePageChange,
    refetch,
  };
};
