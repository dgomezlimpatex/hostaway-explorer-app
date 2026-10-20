
import { useState, useCallback, useMemo, useRef } from 'react';
import { Task, Cleaner } from '@/types/calendar';

export interface DragState {
  draggedTask: Task | null;
  isDragging: boolean;
  dragOffset: { x: number; y: number };
  draggedFromPosition?: { cleanerId: string; timeSlot: string };
}

/**
 * `originCleanerId` is the cleaner row the block was dragged from. A shared
 * task is drawn in every assigned row, so the drop needs it to replace only
 * that person.
 */
export type TaskAssignHandler = (
  taskId: string,
  cleanerId: string,
  cleaners: Cleaner[],
  timeSlot?: string,
  originCleanerId?: string,
) => void;

export const useDragAndDrop = (onTaskAssign: TaskAssignHandler) => {
  // Keep the active task synchronously, even before React commits a render.
  const activeTaskRef = useRef<Task | null>(null);
  const originCleanerRef = useRef<string | undefined>(undefined);
  const [dragState, setDragState] = useState<DragState>({
    draggedTask: null,
    isDragging: false,
    dragOffset: { x: 0, y: 0 }
  });

  const handleDragStart = useCallback((e: React.DragEvent, task: Task, originCleanerId?: string) => {
    activeTaskRef.current = task;
    originCleanerRef.current = originCleanerId;
    e.dataTransfer.effectAllowed = 'move';
    
    // Set multiple data formats for better compatibility
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.setData('application/json', JSON.stringify({ taskId: task.id, taskData: task }));
    
    // Calculate offset for smooth positioning
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const offset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };

    // Store original position for assigned tasks
    const draggedFromPosition = (originCleanerId || task.cleaner) ? {
      cleanerId: originCleanerId || task.cleanerId || '',
      timeSlot: task.startTime
    } : undefined;

    setDragState({
      draggedTask: task,
      isDragging: true,
      dragOffset: offset,
      draggedFromPosition
    });

  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    activeTaskRef.current = null;
    originCleanerRef.current = undefined;
    setDragState({
      draggedTask: null,
      isDragging: false,
      dragOffset: { x: 0, y: 0 }
    });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, cleanerId: string, cleaners: Cleaner[], timeSlot?: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    
    // Try to get task ID from different data formats
    let taskId = e.dataTransfer.getData('text/plain');
    
    if (!taskId) {
      try {
        const jsonData = e.dataTransfer.getData('application/json');
        if (jsonData) {
          const parsed = JSON.parse(jsonData);
          taskId = parsed.taskId;
        }
      } catch (error) {
        console.error('Error parsing JSON data:', error);
      }
    }
    
    
    const activeTask = activeTaskRef.current;
    // Some browsers return an empty payload on drop. Only fall back to an
    // active drag from this calendar, never to an unrelated external payload.
    taskId = taskId || activeTask?.id;
    const isActiveTask = !!activeTask?.id && taskId === activeTask.id;
    const originCleanerId = originCleanerRef.current;
    activeTaskRef.current = null;
    originCleanerRef.current = undefined;

    if (isActiveTask) {
      // Always call onTaskAssign - let the backend handle if it's the same position
      if (originCleanerId) onTaskAssign(taskId, cleanerId, cleaners, timeSlot, originCleanerId);
      else onTaskAssign(taskId, cleanerId, cleaners, timeSlot);
    } else {
      console.error('❌ useDragAndDrop - No task ID or dragged task found:', { taskId, draggedTask: dragState.draggedTask });
    }

    // Reset drag state
    setDragState({
      draggedTask: null,
      isDragging: false,
      dragOffset: { x: 0, y: 0 }
    });
  }, [onTaskAssign, dragState.draggedTask]);

  // Memoize the return object to prevent unnecessary re-renders
  const returnValue = useMemo(() => ({
    dragState,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop
  }), [dragState, handleDragStart, handleDragEnd, handleDragOver, handleDrop]);

  return returnValue;
};
