
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Task, ViewType } from '@/types/calendar';
import { taskStorageService } from '@/services/taskStorage';

export const useTasks = (currentDate: Date, currentView: ViewType) => {
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', currentDate, currentView],
    queryFn: async () => {
      console.log('useTasks - queryFn called with:', { 
        currentDate: currentDate.toISOString(),
        currentDateString: currentDate.toISOString().split('T')[0],
        currentView 
      });
      
      // Obtener TODAS las tareas
      const allTasks = await taskStorageService.getTasks();
      console.log('useTasks - allTasks from storage:', allTasks.length, 'tasks');
      
      // Si no hay tareas, devolver array vacío
      if (!allTasks || allTasks.length === 0) {
        console.log('useTasks - no tasks found in storage');
        return [];
      }

      // Calcular fechas basadas en la vista actual usando fecha local
      const currentDateStr = currentDate.toISOString().split('T')[0];
      console.log('useTasks - currentDateStr for filtering:', currentDateStr);
      
      let filteredTasks = [];
      
      if (currentView === 'day') {
        // Vista de día: mostrar solo las tareas del día actual
        filteredTasks = allTasks.filter(task => {
          const match = task.date === currentDateStr;
          console.log(`useTasks - day view: task ${task.id} date ${task.date} matches ${currentDateStr}:`, match);
          return match;
        });
      } else if (currentView === 'three-day') {
        // Vista de 3 días: mostrar las tareas de los próximos 3 días
        const dates = [];
        for (let i = 0; i < 3; i++) {
          const date = new Date(currentDate);
          date.setDate(date.getDate() + i);
          dates.push(date.toISOString().split('T')[0]);
        }
        console.log('useTasks - three-day dates:', dates);
        
        filteredTasks = allTasks.filter(task => {
          const match = dates.includes(task.date);
          if (match) {
            console.log('useTasks - task matches three-day range:', task.property, task.date);
          }
          return match;
        });
      } else { // week view
        // Vista de semana: mostrar las tareas de los próximos 7 días
        const startOfWeek = new Date(currentDate);
        const endOfWeek = new Date(currentDate);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        
        const startDateStr = startOfWeek.toISOString().split('T')[0];
        const endDateStr = endOfWeek.toISOString().split('T')[0];
        
        console.log('useTasks - week range:', { startDateStr, endDateStr });
        
        filteredTasks = allTasks.filter(task => {
          const match = task.date >= startDateStr && task.date <= endDateStr;
          if (match) {
            console.log('useTasks - task matches week range:', task.property, task.date);
          }
          return match;
        });
      }
      
      console.log(`useTasks - filteredTasks for ${currentView} view:`, filteredTasks.length, 'tasks');
      filteredTasks.forEach(task => {
        console.log(`  - ${task.property} on ${task.date} at ${task.startTime}`);
      });
      
      return filteredTasks;
    },
  });

  // Mutación para eliminar TODAS las tareas
  const deleteAllTasksMutation = useMutation({
    mutationFn: async () => {
      console.log('deleteAllTasksMutation - deleting all tasks');
      const allTasks = await taskStorageService.getTasks();
      
      for (const task of allTasks) {
        await taskStorageService.deleteTask(task.id);
        console.log(`deleteAllTasksMutation - deleted task ${task.id}: ${task.property}`);
      }
      
      return true;
    },
    onSuccess: () => {
      console.log('deleteAllTasksMutation - all tasks deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, updates }: { taskId: string; updates: Partial<Task> }) => {
      console.log('updateTaskMutation - updating task:', { taskId, updates });
      return taskStorageService.updateTask(taskId, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (taskData: Omit<Task, 'id'>) => {
      return taskStorageService.createTask(taskData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return taskStorageService.deleteTask(taskId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const assignTaskMutation = useMutation({
    mutationFn: async ({ taskId, cleanerId, cleaners }: { taskId: string; cleanerId: string; cleaners: any[] }) => {
      const cleaner = cleaners.find(c => c.id === cleanerId);
      if (!cleaner) {
        throw new Error('Cleaner not found');
      }
      console.log('assignTaskMutation - assigning task:', { taskId, cleanerId, cleanerName: cleaner.name });
      return taskStorageService.assignTask(taskId, cleaner.name, cleanerId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  return {
    tasks,
    isLoading,
    updateTask: updateTaskMutation.mutate,
    createTask: createTaskMutation.mutate,
    deleteTask: deleteTaskMutation.mutate,
    deleteAllTasks: deleteAllTasksMutation.mutate,
    assignTask: assignTaskMutation.mutate,
    isUpdatingTask: updateTaskMutation.isPending,
    isCreatingTask: createTaskMutation.isPending,
    isDeletingTask: deleteTaskMutation.isPending,
    isDeletingAllTasks: deleteAllTasksMutation.isPending,
    isAssigningTask: assignTaskMutation.isPending,
  };
};
