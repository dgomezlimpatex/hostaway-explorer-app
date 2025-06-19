
import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTasks } from '@/hooks/useTasks';
import { useOptimizedPagination } from '@/hooks/useOptimizedPagination';
import { Task } from '@/types/calendar';
import { TaskFilters } from '@/types/filters';
import { filterTasks, sortTasks } from '@/components/tasks/utils/taskFilters';

export const useTasksPageState = () => {
  const { userRole } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [showPastTasks, setShowPastTasks] = useState(false);
  const [filters, setFilters] = useState<TaskFilters>({
    status: 'all',
    cleaner: 'all',
    dateRange: 'all',
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
    paginatedItems: paginatedTasks,
    handlePageChange,
  } = useOptimizedPagination({
    items: sortedTasks,
    itemsPerPage: 20,
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
