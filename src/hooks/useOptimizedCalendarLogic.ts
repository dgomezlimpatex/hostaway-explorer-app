import { useCallback, useMemo, useRef } from 'react';
import { useCalendarLogic } from './useCalendarLogic';
import { useOptimizedNavigation } from './useOptimizedNavigation';
import { getTaskPosition } from '@/utils/taskPositioning';
import { Task, Cleaner } from '@/types/calendar';

export const useOptimizedCalendarLogic = () => {
  const originalLogic = useCalendarLogic();
  
  // Optimized navigation with debouncing
  const { navigateDate: optimizedNavigateDate } = useOptimizedNavigation(originalLogic.navigateDate);
  
  // Caché de asignaciones para evitar recálculos
  const assignmentCacheRef = useRef<Map<string, boolean>>(new Map());
  
  // Optimized task assignment con caché temporal
  const optimizedHandleDrop = useCallback(
    (e: React.DragEvent, cleanerId: string, cleaners: Cleaner[], timeSlot?: string) => {
      const taskId = e.dataTransfer.getData('text/plain');
      if (!taskId || !cleanerId) return;

      // Usar caché para evitar asignaciones duplicadas
      const cacheKey = `${taskId}-${cleanerId}`;
      if (assignmentCacheRef.current.get(cacheKey)) {
        console.log('⚡ Skipping duplicate assignment from cache');
        return;
      }

      // Marcar en caché temporalmente
      assignmentCacheRef.current.set(cacheKey, true);
      
      // Limpiar caché después de 2 segundos
      setTimeout(() => {
        assignmentCacheRef.current.delete(cacheKey);
      }, 2000);

      originalLogic.handleDrop(e, cleanerId, cleaners, timeSlot);
    },
    [originalLogic.handleDrop]
  );

  // Memoized task filtering para evitar recálculos constantes
  const memoizedAssignedTasks = useMemo(() => {
    return originalLogic.tasks.filter(task => task.cleanerId && task.cleaner);
  }, [originalLogic.tasks]);

  const memoizedUnassignedTasks = useMemo(() => {
    return originalLogic.tasks.filter(task => !task.cleanerId && !task.cleaner);
  }, [originalLogic.tasks]);

  // Optimized task position calculation con caché
  const taskPositionCache = useRef<Map<string, { left: string; width: string }>>(new Map());
  
  const optimizedGetTaskPosition = useCallback(
    (startTime: string, endTime: string) => {
      const cacheKey = `${startTime}-${endTime}`;
      
      if (taskPositionCache.current.has(cacheKey)) {
        return taskPositionCache.current.get(cacheKey)!;
      }

      const result = getTaskPosition(startTime, endTime);
      taskPositionCache.current.set(cacheKey, result);
      
      // Limpiar caché cada 100 entradas para evitar memory leaks
      if (taskPositionCache.current.size > 100) {
        const firstKey = taskPositionCache.current.keys().next().value;
        taskPositionCache.current.delete(firstKey);
      }

      return result;
    },
    []
  );

  return {
    ...originalLogic,
    
    // Sobrescribir métodos con versiones optimizadas
    navigateDate: optimizedNavigateDate,
    handleDrop: optimizedHandleDrop,
    getTaskPosition: optimizedGetTaskPosition,
    
    // Tareas pre-filtradas
    assignedTasks: memoizedAssignedTasks,
    unassignedTasks: memoizedUnassignedTasks,
  };
};