
import { useState, useCallback } from 'react';
import { Task } from '@/types/calendar';

interface DragState {
  draggedTask: Task | null;
  isDragging: boolean;
  dragOffset: { x: number; y: number };
}

export const useDragAndDrop = (onTaskAssign: (taskId: string, cleanerId: string, cleaners: any[]) => void) => {
  const [dragState, setDragState] = useState<DragState>({
    draggedTask: null,
    isDragging: false,
    dragOffset: { x: 0, y: 0 }
  });

  const handleDragStart = useCallback((e: React.DragEvent, task: Task) => {
    console.log('useDragAndDrop - handleDragStart called with task:', task.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);
    
    // Calculate offset for smooth positioning
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const offset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };

    setDragState({
      draggedTask: task,
      isDragging: true,
      dragOffset: offset
    });

    // Add visual feedback
    (e.target as HTMLElement).style.opacity = '0.5';
    
    // Store task data for access during drop
    e.dataTransfer.setData('application/json', JSON.stringify(task));
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    console.log('useDragAndDrop - handleDragEnd called');
    setDragState({
      draggedTask: null,
      isDragging: false,
      dragOffset: { x: 0, y: 0 }
    });

    // Reset visual feedback
    (e.target as HTMLElement).style.opacity = '1';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, cleanerId: string, cleaners: any[]) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('useDragAndDrop - handleDrop called with cleanerId:', cleanerId);
    
    // Get task ID from drag data
    const taskId = e.dataTransfer.getData('text/plain');
    console.log('useDragAndDrop - taskId from drag data:', taskId);
    
    if (taskId) {
      console.log('useDragAndDrop - calling onTaskAssign with:', { taskId, cleanerId, cleaners: cleaners.length });
      onTaskAssign(taskId, cleanerId, cleaners);
    } else {
      console.error('useDragAndDrop - No task ID found in drag data');
    }

    // Reset drag state
    setDragState({
      draggedTask: null,
      isDragging: false,
      dragOffset: { x: 0, y: 0 }
    });
  }, [onTaskAssign]);

  return {
    dragState,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop
  };
};
