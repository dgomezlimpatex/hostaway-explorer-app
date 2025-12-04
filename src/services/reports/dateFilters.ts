
import { ReportFilters } from '@/types/filters';

export const filterTasksByDateRange = (tasks: any[], filters: ReportFilters) => {
  return tasks.filter(task => {
    const taskDate = new Date(task.date);
    
    switch (filters.dateRange) {
      case 'today':
        const today = new Date();
        return taskDate.toDateString() === today.toDateString();
      case 'week':
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return taskDate >= weekStart && taskDate <= weekEnd;
      case 'month':
        const now = new Date();
        return taskDate.getMonth() === now.getMonth() && taskDate.getFullYear() === now.getFullYear();
      case 'custom':
        if (filters.startDate && filters.endDate) {
          return taskDate >= filters.startDate && taskDate <= filters.endDate;
        }
        return true;
      default:
        return true;
    }
  });
};

export const applyAdditionalFilters = (tasks: any[], filters: ReportFilters, properties: any[]) => {
  return tasks.filter(task => {
    if (filters.cleanerId && task.cleaner_id !== filters.cleanerId) return false;
    if (filters.clientId) {
      // Buscar propiedad por ID (propiedad_id) o por nombre como fallback
      const property = properties.find(p => 
        p.id === task.propiedad_id || p.nombre === task.property
      );
      // Verificar clienteId de la propiedad (camelCase por mapper) o cliente_id directo de la tarea (snake_case de DB)
      const taskClientId = property?.clienteId || task.cliente_id;
      if (taskClientId !== filters.clientId) return false;
    }
    return true;
  });
};
