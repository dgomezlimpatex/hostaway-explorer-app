
import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { taskStorageService } from '@/services/taskStorage';
import { Task } from '@/types/calendar';

export const useTasksPageState = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    status: 'all',
    cleaner: 'all',
    dateRange: 'all',
    cliente: 'all',
    propiedad: 'all'
  });
  const [showPastTasks, setShowPastTasks] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const tasksPerPage = 20;

  // Fetch all tasks without date filtering
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['all-tasks'],
    queryFn: async () => {
      console.log('TasksPage - fetching all tasks');
      const allTasks = await taskStorageService.getTasks();
      console.log('TasksPage - allTasks fetched:', allTasks);
      return allTasks;
    },
  });

  // Filter tasks by date (past vs future/today)
  const dateFilteredTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return tasks.filter(task => {
      const taskDate = new Date(task.date);
      taskDate.setHours(0, 0, 0, 0);
      
      if (showPastTasks) {
        return taskDate < today;
      } else {
        return taskDate >= today;
      }
    });
  }, [tasks, showPastTasks]);

  // Apply search filter
  const searchFilteredTasks = useMemo(() => {
    console.log('TasksPage - filtering tasks, total:', dateFilteredTasks.length);
    const filtered = dateFilteredTasks.filter(task => 
      task.property.toLowerCase().includes(searchTerm.toLowerCase()) || 
      task.address.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (task.cleaner && task.cleaner.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    console.log('TasksPage - search filtered tasks:', filtered.length);
    return filtered;
  }, [dateFilteredTasks, searchTerm]);

  // Sort tasks chronologically
  const sortedTasks = useMemo(() => {
    return [...searchFilteredTasks].sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.startTime}`);
      const dateB = new Date(`${b.date}T${b.startTime}`);
      
      if (showPastTasks) {
        // For past tasks, show most recent first
        return dateB.getTime() - dateA.getTime();
      } else {
        // For future tasks, show earliest first
        return dateA.getTime() - dateB.getTime();
      }
    });
  }, [searchFilteredTasks, showPastTasks]);

  // Calculate pagination
  const totalPages = Math.ceil(sortedTasks.length / tasksPerPage);
  const startIndex = (currentPage - 1) * tasksPerPage;
  const endIndex = startIndex + tasksPerPage;
  const paginatedTasks = sortedTasks.slice(startIndex, endIndex);

  const handleTogglePastTasks = useCallback(() => {
    setShowPastTasks(!showPastTasks);
    setCurrentPage(1);
  }, [showPastTasks]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handleFiltersChange = useCallback((newFilters: typeof filters) => {
    setFilters(newFilters);
    setCurrentPage(1);
  }, []);

  const handleSearchChange = useCallback((term: string) => {
    setSearchTerm(term);
    setCurrentPage(1);
  }, []);

  return {
    // State
    searchTerm,
    filters,
    showPastTasks,
    currentPage,
    tasksPerPage,
    
    // Data
    tasks,
    isLoading,
    sortedTasks,
    paginatedTasks,
    totalPages,
    
    // Handlers
    setSearchTerm: handleSearchChange,
    setFilters: handleFiltersChange,
    handleTogglePastTasks,
    handlePageChange,
  };
};
