
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
    // Invalidar todas las queries de tareas
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    
    // También invalidar el cache específico de la sede actual
    try {
      const activeSede = JSON.parse(localStorage.getItem('activeSede') || '{}');
      if (activeSede.id) {
        queryClient.invalidateQueries({ queryKey: ['tasks', 'all', activeSede.id] });
      }
    } catch (error) {
      console.warn('Error getting active sede for cache invalidation:', error);
    }
    
    // Forzar refetch inmediato
    queryClient.refetchQueries({ queryKey: ['tasks'] });
    console.log('useTasksPageState - invalidated task queries');
  };

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

  const handleTogglePastTasks = () => {
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
