
import { useQuery } from '@tanstack/react-query';
import { ReportFilters, TaskReport, BillingReport, SummaryReport } from '@/types/reports';
import { taskStorageService } from '@/services/taskStorage';
import { clientStorage } from '@/services/clientStorage';
import { propertyStorage } from '@/services/propertyStorage';

export const useReports = (filters: ReportFilters) => {
  return useQuery({
    queryKey: ['reports', filters],
    queryFn: async () => {
      const tasks = await taskStorageService.getTasks();
      const clients = await clientStorage.getAll();
      const properties = await propertyStorage.getAll();
      
      // Filter tasks by date range
      const filteredTasks = tasks.filter(task => {
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

      // Apply additional filters
      const finalTasks = filteredTasks.filter(task => {
        if (filters.cleanerId && task.cleaner !== filters.cleanerId) return false;
        if (filters.clientId) {
          const property = properties.find(p => p.nombre === task.property);
          if (!property || property.clienteId !== filters.clientId) return false;
        }
        return true;
      });

      // Generate reports based on type
      switch (filters.reportType) {
        case 'tasks':
          return generateTaskReport(finalTasks, properties, clients);
        case 'billing':
          return generateBillingReport(finalTasks, properties, clients);
        case 'summary':
          return generateSummaryReport(finalTasks);
        default:
          return [];
      }
    },
  });
};

const generateTaskReport = (tasks: any[], properties: any[], clients: any[]): TaskReport[] => {
  return tasks.map(task => {
    const property = properties.find(p => p.nombre === task.property);
    const client = property ? clients.find(c => c.id === property.clienteId) : null;
    
    return {
      id: task.id,
      property: task.property,
      address: task.address,
      date: task.date,
      startTime: task.startTime,
      endTime: task.endTime,
      type: task.type,
      status: task.status,
      cleaner: task.cleaner || 'Sin asignar',
      client: client?.nombre || 'Cliente desconocido'
    };
  });
};

const generateBillingReport = (tasks: any[], properties: any[], clients: any[]): BillingReport[] => {
  return tasks.map(task => {
    const property = properties.find(p => p.nombre === task.property);
    const client = property ? clients.find(c => c.id === property.clienteId) : null;
    
    // Parse time strings properly
    const startTimeParts = task.startTime.split(':');
    const endTimeParts = task.endTime.split(':');
    
    const startMinutes = parseInt(startTimeParts[0]) * 60 + parseInt(startTimeParts[1]);
    const endMinutes = parseInt(endTimeParts[0]) * 60 + parseInt(endTimeParts[1]);
    
    const duration = endMinutes - startMinutes;
    
    return {
      id: task.id,
      property: task.property,
      client: client?.nombre || 'Cliente desconocido',
      date: task.date,
      serviceType: task.type,
      duration: duration > 0 ? duration : 0,
      cost: property?.costeServicio || 0,
      status: task.status
    };
  });
};

const generateSummaryReport = (tasks: any[]): SummaryReport => {
  const completed = tasks.filter(t => t.status === 'completed').length;
  const pending = tasks.filter(t => t.status === 'pending').length;
  
  const cleanerCounts = tasks.reduce((acc, task) => {
    const cleaner = task.cleaner || 'Sin asignar';
    acc[cleaner] = (acc[cleaner] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const topCleaners = Object.entries(cleanerCounts)
    .map(([name, tasks]) => ({ name, tasks: tasks as number }))
    .sort((a, b) => b.tasks - a.tasks)
    .slice(0, 5);

  return {
    totalTasks: tasks.length,
    completedTasks: completed,
    pendingTasks: pending,
    totalRevenue: 0, // Placeholder
    averageTaskDuration: 0, // Placeholder
    topCleaners,
    topClients: [] // Placeholder
  };
};
