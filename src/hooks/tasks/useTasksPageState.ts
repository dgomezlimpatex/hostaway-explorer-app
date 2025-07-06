
import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useTasks } from '@/hooks/useTasks';
import { useOptimizedPagination } from '@/hooks/useOptimizedPagination';
import { useCleaners } from '@/hooks/useCleaners';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [showPastTasks, setShowPastTasks] = useState(false);
  const [filters, setFilters] = useState<LocalTaskFilters>({
    status: 'all',
    cleaner: 'all',
    dateRange: 'all',
    cliente: 'all',
    propiedad: 'all',
  });

  // Use current date and week view for task fetching (fixing ViewType)
  const currentDate = new Date();
  const { tasks, isLoading, error } = useTasks(currentDate, 'week');

  // Get current user's cleaner ID
  const currentUserCleanerId = useMemo(() => {
    if (userRole !== 'cleaner' || !user?.id) return null;
    const currentCleaner = cleaners.find(cleaner => cleaner.user_id === user.id);
    return currentCleaner?.id || null;
  }, [cleaners, user?.id, userRole]);

  // Create a proper refetch function using React Query
  const refetch = () => {
    // Invalidate all task-related queries to force refetch
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    console.log('useTasksPageState - invalidated task queries');
  };

  // Filter and sort tasks
  const filteredTasks = useMemo(() => {
    console.log('useTasksPageState - filtering tasks:', {
      totalTasks: tasks.length,
      showPastTasks,
      userRole,
      currentUserName: profile?.full_name,
      currentUserCleanerId,
      searchTerm,
      filters
    });

    let filtered = filterTasks(tasks, { 
      searchTerm, 
      showPastTasks, 
      userRole,
      currentUserName: profile?.full_name || profile?.email, // Usar el nombre completo o email como fallback
      currentUserId: currentUserCleanerId,
      ...filters 
    });

    console.log('useTasksPageState - after filtering:', filtered.length);
    return filtered;
  }, [tasks, searchTerm, showPastTasks, userRole, filters, profile, currentUserCleanerId]);

  const sortedTasks = useMemo(() => {
    const sorted = sortTasks(filteredTasks, showPastTasks, userRole);
    console.log('useTasksPageState - after sorting:', sorted.length);
    return sorted;
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

  const handleTogglePastTasks = () => {
    console.log('useTasksPageState - toggling past tasks:', !showPastTasks);
    setShowPastTasks(!showPastTasks);
  };

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
