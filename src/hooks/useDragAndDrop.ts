
import { useState, useCallback, useMemo } from 'react';
import { Task } from '@/types/calendar';

interface DragState {
  draggedTask: Task | null;
  isDragging: boolean;
  dragOffset: { x: number; y: number };
  draggedFromPosition?: { cleanerId: string; timeSlot: string };
}

export const useDragAndDrop = (onTaskAssign: (taskId: string, cleanerId: string, cleaners: any[], timeSlot?: string) => void) => {
  const [dragState, setDragState] = useState<DragState>({
    draggedTask: null,
    isDragging: false,
    dragOffset: { x: 0, y: 0 }
  });

  const handleDragStart = useCallback((e: React.DragEvent, task: Task) => {
    console.log('🚀 useDragAndDrop - handleDragStart called with task:', task.id, task.property);
    e.dataTransfer.effectAllowed = 'move';
    
    // Set multiple data formats for better compatibility
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.setData('application/json', JSON.stringify({ taskId: task.id, taskData: task }));
    
    // Calculate offset for smooth positioning
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const offset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };

    // Store original position for assigned tasks
    const draggedFromPosition = task.cleaner ? {
      cleanerId: task.cleanerId || '',
      timeSlot: task.startTime
    } : undefined;

    setDragState({
      draggedTask: task,
      isDragging: true,
      dragOffset: offset,
      draggedFromPosition
    });

    console.log('✅ Drag state set:', { taskId: task.id, isDragging: true, draggedFromPosition });
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    console.log('🏁 useDragAndDrop - handleDragEnd called');
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

  const handleDrop = useCallback((e: React.DragEvent, cleanerId: string, cleaners: any[], timeSlot?: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('🎯 useDragAndDrop - handleDrop called with:', { cleanerId, timeSlot });
    
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
    
    console.log('📋 useDragAndDrop - taskId from drag data:', taskId);
    
    if (taskId && dragState.draggedTask) {
      // Check if we're dropping in the same position
      const currentTask = dragState.draggedTask;
      const isSamePosition = currentTask.cleanerId === cleanerId && 
                           currentTask.startTime === timeSlot;
      
      if (!isSamePosition) {
        console.log('🔄 useDragAndDrop - calling onTaskAssign with:', { taskId, cleanerId, cleanersCount: cleaners.length, timeSlot });
        onTaskAssign(taskId, cleanerId, cleaners, timeSlot);
      } else {
        console.log('📍 useDragAndDrop - task dropped in same position, no action needed');
      }
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
