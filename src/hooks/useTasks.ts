
import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Task, ViewType } from '@/types/calendar';
import { taskStorageService } from '@/services/taskStorage';

export const useTasks = (currentDate: Date, currentView: ViewType) => {
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', currentDate, currentView],
    queryFn: async () => {
      const currentDateStr = currentDate.toISOString().split('T')[0];
      const allTasks = taskStorageService.getTasks();
      
      // Memoize date calculations for better performance
      const filteredTasks = React.useMemo(() => {
        return allTasks.filter(task => {
          if (currentView === 'day') {
            return task.date === currentDateStr;
          } else if (currentView === 'three-day') {
            const date1 = new Date(currentDate);
            const date2 = new Date(currentDate);
            const date3 = new Date(currentDate);
            date2.setDate(date2.getDate() + 1);
            date3.setDate(date3.getDate() + 2);
            
            return [
              date1.toISOString().split('T')[0],
              date2.toISOString().split('T')[0],
              date3.toISOString().split('T')[0]
            ].includes(task.date);
          } else { // week view
            const startOfWeek = new Date(currentDate);
            const day = startOfWeek.getDay();
            const diff = startOfWeek.getDate() - day;
            startOfWeek.setDate(diff);
            
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            
            const taskDate = new Date(task.date);
            return taskDate >= startOfWeek && taskDate <= endOfWeek;
          }
        });
      }, [allTasks, currentDate, currentView, currentDateStr]);
      
      return filteredTasks;
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: React.useCallback(async ({ taskId, updates }: { taskId: string; updates: Partial<Task> }) => {
      return taskStorageService.updateTask(taskId, updates);
    }, []),
    onSuccess: React.useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }, [queryClient]),
  });

  const createTaskMutation = useMutation({
    mutationFn: React.useCallback(async (taskData: Omit<Task, 'id'>) => {
      return taskStorageService.createTask(taskData);
    }, []),
    onSuccess: React.useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }, [queryClient]),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: React.useCallback(async (taskId: string) => {
      return taskStorageService.deleteTask(taskId);
    }, []),
    onSuccess: React.useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }, [queryClient]),
  });

  const assignTaskMutation = useMutation({
    mutationFn: React.useCallback(async ({ taskId, cleanerId, cleaners }: { taskId: string; cleanerId: string; cleaners: any[] }) => {
      const cleaner = cleaners.find(c => c.id === cleanerId);
      if (!cleaner) {
        throw new Error('Cleaner not found');
      }
      return taskStorageService.assignTask(taskId, cleaner.name);
    }, []),
    onSuccess: React.useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }, [queryClient]),
  });

  return {
    tasks,
    isLoading,
    updateTask: updateTaskMutation.mutate,
    createTask: createTaskMutation.mutate,
    deleteTask: deleteTaskMutation.mutate,
    assignTask: assignTaskMutation.mutate,
    isUpdatingTask: updateTaskMutation.isPending,
    isCreatingTask: createTaskMutation.isPending,
    isDeletingTask: deleteTaskMutation.isPending,
    isAssigningTask: assignTaskMutation.isPending,
  };
};
