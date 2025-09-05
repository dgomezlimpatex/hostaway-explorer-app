import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { timeLogsStorage } from '@/services/storage/timeLogsStorage';
import { TaskTimeBreakdown } from '@/types/calendar';
import { useTimeLogs } from './useTimeLogs';
import { useTasks } from './useTasks';
import { toast } from '@/hooks/use-toast';
import { format, startOfMonth, endOfMonth } from 'date-fns';

export const useTaskTimeSync = (cleanerId: string, month?: Date) => {
  const currentMonth = month || new Date();
  const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

  // Get time logs for the cleaner in the month
  const { data: timeLogs = [] } = useTimeLogs(cleanerId, monthStart, monthEnd);
  
  // Get tasks for the cleaner in the month
  const { tasks } = useTasks(currentMonth, 'week');
  
  const cleanerTasks = useMemo(() => {
    return tasks.filter(task => task.cleanerId === cleanerId);
  }, [tasks, cleanerId]);

  // Calculate task time breakdown
  const taskTimeBreakdown: TaskTimeBreakdown[] = useMemo(() => {
    const breakdown: TaskTimeBreakdown[] = [];
    
    cleanerTasks.forEach(task => {
      // Find time logs associated with this task
      const taskTimeLogs = timeLogs.filter(log => log.taskId === task.id);
      
      // Calculate total time spent on this task
      const timeSpent = taskTimeLogs.reduce((sum, log) => sum + log.totalHours, 0);
      
      // Calculate scheduled time (from start/end time)
      let scheduledTime = 2; // Default 2 hours
      if (task.startTime && task.endTime) {
        const start = new Date(`${task.date}T${task.startTime}`);
        const end = new Date(`${task.date}T${task.endTime}`);
        scheduledTime = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      }

      // Calculate efficiency
      const efficiency = scheduledTime > 0 ? (scheduledTime / Math.max(timeSpent, 0.1)) * 100 : 100;

      breakdown.push({
        taskId: task.id,
        taskName: task.property,
        taskType: task.type,
        taskStatus: task.status || 'pending',
        timeSpent,
        scheduledTime,
        efficiency,
        date: task.date
      });
    });

    return breakdown.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [cleanerTasks, timeLogs]);

  // Statistics
  const stats = useMemo(() => {
    const totalTimeSpent = taskTimeBreakdown.reduce((sum, item) => sum + item.timeSpent, 0);
    const totalScheduledTime = taskTimeBreakdown.reduce((sum, item) => sum + item.scheduledTime, 0);
    const averageEfficiency = taskTimeBreakdown.length > 0 
      ? taskTimeBreakdown.reduce((sum, item) => sum + item.efficiency, 0) / taskTimeBreakdown.length 
      : 0;
    
    const tasksWithTimeLogs = taskTimeBreakdown.filter(item => item.timeSpent > 0);
    const tasksWithoutTimeLogs = taskTimeBreakdown.filter(item => item.timeSpent === 0);

    return {
      totalTimeSpent,
      totalScheduledTime,
      averageEfficiency,
      tasksCompleted: cleanerTasks.filter(task => task.status === 'completed').length,
      tasksWithTimeLogs: tasksWithTimeLogs.length,
      tasksWithoutTimeLogs: tasksWithoutTimeLogs.length,
      totalTasks: cleanerTasks.length
    };
  }, [taskTimeBreakdown, cleanerTasks]);

  return {
    taskTimeBreakdown,
    stats,
    timeLogs,
    cleanerTasks
  };
};

// Hook to sync completed tasks with time logs
export const useSyncTasksWithTimeLogs = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ cleanerId, startDate, endDate }: { 
      cleanerId: string; 
      startDate: string; 
      endDate: string; 
    }) => {
      await timeLogsStorage.syncWithCompletedTasks(cleanerId, startDate, endDate);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-logs'] });
      toast({
        title: "Sincronización completada",
        description: "Los registros de tiempo han sido sincronizados con las tareas completadas.",
      });
    },
    onError: (error) => {
      console.error('Sync tasks with time logs error:', error);
      toast({
        title: "Error en sincronización",
        description: "Ha ocurrido un error al sincronizar las tareas con los registros de tiempo.",
        variant: "destructive",
      });
    },
  });
};

// Hook to create time log from task
export const useCreateTimeLogFromTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      taskId, 
      cleanerId, 
      actualHours, 
      notes 
    }: { 
      taskId: string; 
      cleanerId: string; 
      actualHours: number; 
      notes?: string; 
    }) => {
      return await timeLogsStorage.createFromTask(taskId, cleanerId, actualHours, notes);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-logs'] });
      toast({
        title: "Registro de tiempo creado",
        description: "El registro de tiempo ha sido creado desde la tarea.",
      });
    },
    onError: (error) => {
      console.error('Create time log from task error:', error);
      toast({
        title: "Error",
        description: "Ha ocurrido un error al crear el registro de tiempo desde la tarea.",
        variant: "destructive",
      });
    },
  });
};

// Hook to get time logs by task
export const useTimeLogsByTask = (taskId: string) => {
  return useQuery({
    queryKey: ['time-logs', 'task', taskId],
    queryFn: () => timeLogsStorage.getByTaskId(taskId),
    enabled: !!taskId,
  });
};