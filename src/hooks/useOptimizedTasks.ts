
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Task, ViewType } from '@/types/calendar';
import { taskStorageService } from '@/services/taskStorage';
import { useAuth } from '@/hooks/useAuth';
import { useCleaners } from '@/hooks/useCleaners';
import { useSede } from '@/contexts/SedeContext';
import { multipleTaskAssignmentService } from '@/services/storage/multipleTaskAssignmentService';

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
  const { userRole, user } = useAuth();
  const { cleaners } = useCleaners();
  const { activeSede } = useSede();

  // Get current user's cleaner ID if they are a cleaner
  const currentCleanerId = useMemo(() => {
    if (userRole !== 'cleaner' || !user?.id || !cleaners) return null;
    const currentCleaner = cleaners.find(cleaner => cleaner.user_id === user.id);
    return currentCleaner?.id || null;
  }, [userRole, user?.id, cleaners]);

  // Cache key optimizado con dependencias mínimas incluyendo sede
  const queryKey = useMemo(() => [
    'tasks',
    currentDate.toISOString().split('T')[0],
    currentView,
    activeSede?.id || 'no-sede'
  ], [currentDate, currentView, activeSede?.id]);

  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      // Cache específico por sede
      const sedeId = activeSede?.id || 'no-sede';
      const cachedAllTasks = queryClient.getQueryData(['tasks', 'all', sedeId]);
      if (cachedAllTasks) {
        const filteredByView = filterTasksByView(cachedAllTasks as Task[], currentDate, currentView);
        return await filterTasksByUserRole(filteredByView, userRole, currentCleanerId, cleaners);
      }

      // Si no hay cache, obtener todas las tareas y cachearlas por sede
      const allTasks = await taskStorageService.getTasks();
      queryClient.setQueryData(['tasks', 'all', sedeId], allTasks);
      
      const filteredByView = filterTasksByView(allTasks, currentDate, currentView);
      return await filterTasksByUserRole(filteredByView, userRole, currentCleanerId, cleaners);
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 30 * 60 * 1000, // 30 minutos (previously cacheTime)
    enabled: enabled && (userRole !== 'cleaner' || currentCleanerId !== null),
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
      const sedeId = activeSede?.id || 'no-sede';
      queryClient.prefetchQuery({
        queryKey: ['tasks', date.toISOString().split('T')[0], currentView, sedeId],
        queryFn: async () => {
          const allTasks = queryClient.getQueryData(['tasks', 'all', sedeId]) as Task[] || 
                          await taskStorageService.getTasks();
          const filteredByView = filterTasksByView(allTasks, date, currentView);
          return await filterTasksByUserRole(filteredByView, userRole, currentCleanerId, cleaners);
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

// Function to filter tasks by user role
async function filterTasksByUserRole(tasks: Task[], userRole: string | null, currentCleanerId: string | null, cleaners?: any[]): Promise<Task[]> {
  // If user is a cleaner, only show their assigned tasks
  if (userRole === 'cleaner' && currentCleanerId) {
    console.log('🔍 Filtering tasks for cleaner:', currentCleanerId);
    const tasksForCleaner: Task[] = [];
    
    for (const task of tasks) {
      console.log('📝 Checking task:', task.id, 'direct cleanerId:', task.cleanerId);
      
      // Check if task is directly assigned to this cleaner
      if (task.cleanerId === currentCleanerId) {
        console.log('✅ Task directly assigned to cleaner');
        tasksForCleaner.push(task);
        continue;
      }
      
      // Check if cleaner appears in the combined cleaner field (for multiple assignments)
      // We need to get the cleaner name from the cleaners array to compare
      const currentCleanerName = cleaners?.find(c => c.id === currentCleanerId)?.name;
      if (task.cleaner && currentCleanerName && task.cleaner.includes(currentCleanerName)) {
        console.log('✅ Task assigned via multiple assignments (name check)');
        tasksForCleaner.push(task);
        continue;
      }
      
      // Check if task has multiple assignments including this cleaner (fallback)
      try {
        const assignments = await multipleTaskAssignmentService.getTaskAssignments(task.id);
        console.log('📋 Multiple assignments for task', task.id, ':', assignments);
        const isAssigned = assignments.some(assignment => assignment.cleaner_id === currentCleanerId);
        console.log('🎯 Is assigned in multiple assignments:', isAssigned);
        if (isAssigned) {
          console.log('✅ Task assigned via multiple assignments');
          tasksForCleaner.push(task);
        }
      } catch (error) {
        console.error('❌ Error checking task assignments for task', task.id, ':', error);
        // If there's an error, fall back to direct assignment check
        if (task.cleanerId === currentCleanerId) {
          tasksForCleaner.push(task);
        }
      }
    }
    
    console.log('🎯 Final filtered tasks for cleaner:', tasksForCleaner.length);
    return tasksForCleaner;
  }
  
  // Admins, managers, supervisors can see all tasks
  return tasks;
}

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
