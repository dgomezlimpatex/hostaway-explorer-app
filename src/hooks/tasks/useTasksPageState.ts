
import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTasks } from '@/hooks/useTasks';
import { useOptimizedPagination } from '@/hooks/useOptimizedPagination';
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
  const { userRole } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [showPastTasks, setShowPastTasks] = useState(false);
  const [filters, setFilters] = useState<LocalTaskFilters>({
    status: 'all',
    cleaner: 'all',
    dateRange: 'all',
    cliente: 'all',
    propiedad: 'all',
  });

  // Use current date and month view for task fetching
  const currentDate = new Date();
  const { tasks, isLoading, error, refetch } = useTasks(currentDate, 'month');

  // Filter and sort tasks
  const filteredTasks = useMemo(() => {
    console.log('useTasksPageState - filtering tasks:', {
      totalTasks: tasks.length,
      showPastTasks,
      userRole,
      searchTerm,
      filters
    });

    let filtered = filterTasks(tasks, { 
      searchTerm, 
      showPastTasks, 
      userRole,
      ...filters 
    });

    console.log('useTasksPageState - after filtering:', filtered.length);
    return filtered;
  }, [tasks, searchTerm, showPastTasks, userRole, filters]);

  const sortedTasks = useMemo(() => {
    const sorted = sortTasks(filteredTasks, showPastTasks);
    console.log('useTasksPageState - after sorting:', sorted.length);
    return sorted;
  }, [filteredTasks, showPastTasks]);

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
