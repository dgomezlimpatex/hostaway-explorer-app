
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Task, ViewType } from '@/types/calendar';
import { taskStorageService } from '@/services/taskStorage';

interface UseOptimizedTasksProps {
  currentDate: Date;
  currentView: ViewType;
  enabled?: boolean;
}

export const useOptimizedTasks = ({ 
  currentDate, 
  currentView, 
  enabled = true 
}: UseOptimizedTasksProps) => {
  const queryClient = useQueryClient();

  // Cache key optimizado con dependencias mínimas
  const queryKey = useMemo(() => [
    'tasks',
    currentDate.toISOString().split('T')[0],
    currentView
  ], [currentDate, currentView]);

  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      console.log('useOptimizedTasks - fetching with optimized query');
      
      // Usar cache de todas las tareas si está disponible
      const cachedAllTasks = queryClient.getQueryData(['tasks', 'all']);
      if (cachedAllTasks) {
        console.log('useOptimizedTasks - using cached data');
        return filterTasksByView(cachedAllTasks as Task[], currentDate, currentView);
      }

      // Si no hay cache, obtener todas las tareas y cachearlas
      const allTasks = await taskStorageService.getTasks();
      queryClient.setQueryData(['tasks', 'all'], allTasks);
      
      return filterTasksByView(allTasks, currentDate, currentView);
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    cacheTime: 30 * 60 * 1000, // 30 minutos
    enabled,
  });

  // Función optimizada para filtrar tareas
  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    
    // Aplicar filtros adicionales si es necesario
    return tasks.filter(task => task && task.date);
  }, [tasks]);

  // Prefetch para las próximas fechas
  const prefetchNextDates = useMemo(() => {
    if (!enabled) return;

    const tomorrow = new Date(currentDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const nextWeek = new Date(currentDate);
    nextWeek.setDate(nextWeek.getDate() + 7);

    [tomorrow, nextWeek].forEach(date => {
      queryClient.prefetchQuery({
        queryKey: ['tasks', date.toISOString().split('T')[0], currentView],
        queryFn: async () => {
          const allTasks = queryClient.getQueryData(['tasks', 'all']) as Task[] || 
                          await taskStorageService.getTasks();
          return filterTasksByView(allTasks, date, currentView);
        },
        staleTime: 5 * 60 * 1000,
      });
    });
  }, [currentDate, currentView, queryClient, enabled]);

  return {
    tasks: filteredTasks,
    isLoading,
    error,
    queryKey
  };
};

// Función helper optimizada para filtrar tareas
function filterTasksByView(tasks: Task[], currentDate: Date, currentView: ViewType): Task[] {
  const currentDateStr = currentDate.toISOString().split('T')[0];
  
  switch (currentView) {
    case 'day':
      return tasks.filter(task => task.date === currentDateStr);
    
    case 'three-day':
      const threeDayDates = Array.from({ length: 3 }, (_, i) => {
        const date = new Date(currentDate);
        date.setDate(date.getDate() + i);
        return date.toISOString().split('T')[0];
      });
      return tasks.filter(task => threeDayDates.includes(task.date));
    
    case 'week':
      const startOfWeek = new Date(currentDate);
      const endOfWeek = new Date(currentDate);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      
      const startDateStr = startOfWeek.toISOString().split('T')[0];
      const endDateStr = endOfWeek.toISOString().split('T')[0];
      
      return tasks.filter(task => task.date >= startDateStr && task.date <= endDateStr);
    
    default:
      return tasks;
  }
}
