
import { SummaryReport } from '@/types/reports';

export const generateSummaryReport = (tasks: any[]): SummaryReport => {
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
