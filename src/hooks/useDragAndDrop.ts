
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

    setDragState({
      draggedTask: task,
      isDragging: true,
      dragOffset: offset
    });

    console.log('✅ Drag state set:', { taskId: task.id, isDragging: true });
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

  const handleDrop = useCallback((e: React.DragEvent, cleanerId: string, cleaners: any[]) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('🎯 useDragAndDrop - handleDrop called with cleanerId:', cleanerId);
    
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
    
    if (taskId) {
      console.log('🔄 useDragAndDrop - calling onTaskAssign with:', { taskId, cleanerId, cleanersCount: cleaners.length });
      onTaskAssign(taskId, cleanerId, cleaners);
    } else {
      console.error('❌ useDragAndDrop - No task ID found in drag data');
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
