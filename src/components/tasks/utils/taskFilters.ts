
import { Task } from "@/types/calendar";

interface TaskFilters {
  status: string;
  cleaner: string;
  dateRange: string;
  cliente: string;
  propiedad: string;
  searchTerm?: string;
  showPastTasks?: boolean;
  userRole?: string;
  currentUserName?: string; // Añadir nombre del usuario actual
}

export const filterTasks = (tasks: Task[], filters: TaskFilters): Task[] => {
  return tasks.filter(task => {
    // Search term filter
    if (filters.searchTerm && filters.searchTerm.trim() !== '') {
      const searchLower = filters.searchTerm.toLowerCase();
      const searchableText = [
        task.propertyCode,
        task.address,
        task.cleaner,
        task.client,
        task.property
      ].filter(Boolean).join(' ').toLowerCase();
      
      if (!searchableText.includes(searchLower)) {
        return false;
      }
    }

    // Past tasks filter
    if (!filters.showPastTasks) {
      const today = new Date();
      const taskDate = new Date(task.date);
      if (taskDate < today) {
        return false;
      }
    }

    // Role-based filtering
    if (filters.userRole === 'cleaner') {
      // Cleaners only see their own tasks
      // Compare with the cleaner name from the current user
      console.log('filterTasks - cleaner role debug:', {
        taskCleaner: task.cleaner,
        currentUserName: filters.currentUserName,
        taskId: task.id,
        match: task.cleaner === filters.currentUserName
      });
      if (!task.cleaner || task.cleaner !== filters.currentUserName) {
        return false;
      }
    }

    // Filtro por estado
    if (filters.status !== 'all' && task.status !== filters.status) {
      return false;
    }

    // Filtro por limpiador
    if (filters.cleaner !== 'all') {
      if (filters.cleaner === 'unassigned' && task.cleaner) {
        return false;
      }
      if (filters.cleaner !== 'unassigned' && task.cleaner !== filters.cleaner) {
        return false;
      }
    }

    // Filtro por cliente
    if (filters.cliente !== 'all' && task.clienteId !== filters.cliente) {
      return false;
    }

    // Filtro por propiedad
    if (filters.propiedad !== 'all' && task.propertyId !== filters.propiedad) {
      return false;
    }

    // Filtro por fecha
    if (filters.dateRange !== 'all') {
      const taskDate = new Date(task.date);
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      switch (filters.dateRange) {
        case 'today':
          if (taskDate.toDateString() !== today.toDateString()) return false;
          break;
        case 'tomorrow':
          if (taskDate.toDateString() !== tomorrow.toDateString()) return false;
          break;
        case 'this-week':
          const weekStart = new Date(today);
          weekStart.setDate(today.getDate() - today.getDay());
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          if (taskDate < weekStart || taskDate > weekEnd) return false;
          break;
        case 'next-week':
          const nextWeekStart = new Date(today);
          nextWeekStart.setDate(today.getDate() + (7 - today.getDay()));
          const nextWeekEnd = new Date(nextWeekStart);
          nextWeekEnd.setDate(nextWeekStart.getDate() + 6);
          if (taskDate < nextWeekStart || taskDate > nextWeekEnd) return false;
          break;
      }
    }

    return true;
  });
};

export const sortTasks = (tasks: Task[], showPastTasks: boolean): Task[] => {
  return [...tasks].sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    
    if (showPastTasks) {
      // For past tasks, show most recent first
      return dateB.getTime() - dateA.getTime();
    } else {
      // For current/future tasks, show earliest first
      return dateA.getTime() - dateB.getTime();
    }
  });
};
