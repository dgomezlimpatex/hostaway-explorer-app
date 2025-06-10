
import { useState, useCallback } from 'react';
import { Task } from './useCalendarData';

interface DragState {
  draggedTask: Task | null;
  isDragging: boolean;
  dragOffset: { x: number; y: number };
}

export const useDragAndDrop = (onTaskAssign: (taskId: string, cleanerId: string, startTime: string) => void) => {
  const [dragState, setDragState] = useState<DragState>({
    draggedTask: null,
    isDragging: false,
    dragOffset: { x: 0, y: 0 }
  });

  const handleDragStart = useCallback((e: React.DragEvent, task: Task) => {
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
    
    // Allow dragging over task cards
    e.dataTransfer.setData('application/json', JSON.stringify(task));
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
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

  const handleDrop = useCallback((e: React.DragEvent, cleanerId: string, startTime: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (dragState.draggedTask) {
      onTaskAssign(dragState.draggedTask.id, cleanerId, startTime);
    }

    setDragState({
      draggedTask: null,
      isDragging: false,
      dragOffset: { x: 0, y: 0 }
    });
  }, [dragState.draggedTask, onTaskAssign]);

  return {
    dragState,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop
  };
};
