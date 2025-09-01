
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

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      console.log('🔥🔥🔥 FORCE QUERY EXECUTION - useOptimizedTasks queryFn called:', {
        currentDate: currentDate.toISOString().split('T')[0],
        currentView,
        userRole,
        currentCleanerId,
        activeSede: activeSede?.id
      });

      // For cleaners, get ALL their tasks (not limited by current date for navigation)
      if (userRole === 'cleaner' && currentCleanerId) {
        console.log('🔍 Using optimized cleaner query - fetching ALL cleaner tasks for navigation');
        const optimizedTasks = await taskStorageService.getTasks({
          cleanerId: currentCleanerId,
          includePastTasks: false,
          userRole: userRole,
          sedeId: activeSede?.id // Pasar sede del contexto
        });
        
        console.log('📅 Cleaner tasks fetched:', optimizedTasks.length, 'tasks available');
        console.log('📅 Date range of cleaner tasks:', optimizedTasks.length > 0 ? 
          `${optimizedTasks[0]?.date} to ${optimizedTasks[optimizedTasks.length-1]?.date}` : 'No tasks');
        
        // For cleaners, ALWAYS return ALL their tasks so they can see upcoming tasks
        // Let the UI components (calendar, tasks page) handle filtering by current date if needed
        return await filterTasksByUserRole(optimizedTasks, userRole, currentCleanerId, cleaners);
      }
      
      // For non-cleaners, ALWAYS fetch fresh data after forced invalidation
      console.log('📋 Skipping cache to ensure fresh data after task operations');

      // Si no hay cache, obtener todas las tareas y cachearlas por sede
      console.log('📋 No cache found, fetching all tasks from database');
      const sedeId = activeSede?.id || 'no-sede';
      const allTasks = await taskStorageService.getTasks({
        sedeId: activeSede?.id // Pasar sede del contexto
      });
      queryClient.setQueryData(['tasks', 'all', sedeId], allTasks);
      
      const filteredByView = filterTasksByView(allTasks, currentDate, currentView);
      return await filterTasksByUserRole(filteredByView, userRole, currentCleanerId, cleaners);
    },
    staleTime: 0, // Force no cache
    gcTime: 0, // Force immediate garbage collection
    enabled: enabled && (userRole !== 'cleaner' || currentCleanerId !== null) && !!activeSede,
    refetchOnWindowFocus: true,
    refetchOnMount: true, // Force refetch on mount
  });
  
  const { data: tasks = [], isLoading, error } = query;

  // Función optimizada para filtrar tareas
  const filteredTasks = useMemo(() => {
    console.log('🔥 CRITICAL DEBUG: filteredTasks calculation', {
      tasksLength: tasks?.length || 0,
      currentDateStr: currentDate.toISOString().split('T')[0],
      firstFewTasks: tasks?.slice(0, 3).map(t => ({ date: t.date, property: t.property })) || []
    });
    
    if (!tasks) {
      console.log('🔥 CRITICAL: No tasks available');
      return [];
    }
    
    // Aplicar filtros adicionales si es necesario
    const filtered = tasks.filter(task => task && task.date);
    
    return filtered;
  }, [tasks, currentDate]);

  // Prefetch para las próximas fechas (solo para no-cleaners)
  const prefetchNextDates = useMemo(() => {
    if (!enabled || !activeSede?.id || userRole === 'cleaner') return;

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
  }, [currentDate, currentView, queryClient, enabled, activeSede?.id, userRole, currentCleanerId, cleaners]);

  return {
    tasks: filteredTasks,
    isLoading,
    isInitialLoading: isLoading && query.fetchStatus !== 'idle',
    error,
    queryKey,
    
    // DEBUG INFO
    debugInfo: {
      rawTasksCount: tasks?.length || 0,
      filteredTasksCount: filteredTasks?.length || 0,
      currentDateStr: currentDate.toISOString().split('T')[0],
      userRole,
      activeSede: activeSede?.id
    }
  };
};

// Function to filter tasks by user role
async function filterTasksByUserRole(tasks: Task[], userRole: string | null, currentCleanerId: string | null, cleaners?: any[]): Promise<Task[]> {
  // If user is a cleaner, only show their assigned tasks
  if (userRole === 'cleaner' && currentCleanerId) {
    const tasksForCleaner: Task[] = [];
    
    for (const task of tasks) {
      
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
  
  // DEBUG: Log all tasks with their dates to identify the duplicate source
  const problematicTasks = tasks.filter(t => t.property === 'Main Street Deluxe Penthouse A' && t.cleaner === 'Lilia Cañal');
  if (problematicTasks.length > 0) {
    console.log('🚨 DEBUGGING Main Street Deluxe Penthouse A tasks:', {
      taskCount: problematicTasks.length,
      tasks: problematicTasks.map(t => ({
        id: t.id,
        date: t.date,
        status: t.status
      }))
    });
  }
  
  
  switch (currentView) {
    case 'day':
      const dayTasks = tasks.filter(task => task.date === currentDateStr);
  
  // DEBUG: Log what tasks are actually being returned for rendering
  if (currentDateStr === '2025-09-01') {
    console.log('🎯 TASKS BEING RETURNED FOR SEPT 1:', dayTasks.map(t => ({
      id: t.id,
      property: t.property,
      cleaner: t.cleaner,
      date: t.date,
      status: t.status
    })));
  }
  
  return dayTasks;
    
    case 'three-day':
      const threeDayDates = Array.from({ length: 3 }, (_, i) => {
        const date = new Date(currentDate);
        date.setDate(date.getDate() + i);
        return date.toISOString().split('T')[0];
      });
      const threeDayTasks = tasks.filter(task => threeDayDates.includes(task.date));
      console.log('📅 Three-day view filter result:', threeDayTasks.length, 'tasks for dates:', threeDayDates);
      return threeDayTasks;
    
    case 'week':
      // Calculate the full week containing the current date (Monday to Sunday)
      const startOfWeek = new Date(currentDate);
      const dayOfWeek = startOfWeek.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // If Sunday, go back 6 days; otherwise, go to Monday
      startOfWeek.setDate(startOfWeek.getDate() + mondayOffset);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6); // Sunday is 6 days after Monday
      
      const startDateStr = startOfWeek.toISOString().split('T')[0];
      const endDateStr = endOfWeek.toISOString().split('T')[0];
      
      console.log(`📅 Week view filter: ${startDateStr} to ${endDateStr} (current date: ${currentDate.toISOString().split('T')[0]})`);
      
      const weekTasks = tasks.filter(task => task.date >= startDateStr && task.date <= endDateStr);
      console.log('📅 Week view filter result:', weekTasks.length, 'tasks');
      return weekTasks;
    
    default:
      console.log('📅 Unknown view, returning all tasks:', tasks.length);
      return tasks;
  }
}
