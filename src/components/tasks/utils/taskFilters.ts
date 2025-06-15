
import { Task } from "@/types/calendar";

interface TaskFilters {
  status: string;
  cleaner: string;
  dateRange: string;
  cliente: string;
  propiedad: string;
}

export const filterTasks = (tasks: Task[], filters: TaskFilters): Task[] => {
  return tasks.filter(task => {
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
