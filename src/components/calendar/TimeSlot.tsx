
import { memo, useCallback } from "react";
import { cn } from "@/lib/utils";

interface TimeSlotProps {
  hour: number;
  minute: number;
  cleanerId: string;
  isOccupied: boolean;
  draggedTaskId?: string | null;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, cleanerId: string, timeSlot?: string) => void;
  children?: React.ReactNode;
}

export const TimeSlot = memo(({ 
  hour, 
  minute, 
  cleanerId, 
  isOccupied, 
  draggedTaskId,
  onDragOver, 
  onDrop,
  children 
}: TimeSlotProps) => {
  const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    onDragOver(e);
    (e.currentTarget as HTMLElement).classList.add('drag-over');
  }, [onDragOver]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only remove drag-over if we're actually leaving this element
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      (e.currentTarget as HTMLElement).classList.remove('drag-over');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('💧 TimeSlot - handleDrop called for:', { cleanerId, timeString, draggedTaskId });
    (e.currentTarget as HTMLElement).classList.remove('drag-over');
    
    // Always allow drop when there's a dragged task - no conditions
    if (draggedTaskId) {
      console.log('✅ TimeSlot - Processing drop for task:', draggedTaskId);
      onDrop(e, cleanerId, timeString);
    } else {
      console.log('⚠️ TimeSlot - No dragged task, ignoring drop');
    }
  }, [onDrop, cleanerId, timeString, draggedTaskId]);

  // Permitir drop siempre que haya una tarea siendo arrastrada
  const allowDrop = draggedTaskId !== null;
  // Mostrar como ocupado solo si realmente está ocupado Y no hay tarea siendo arrastrada
  const showAsOccupied = isOccupied && !draggedTaskId;

  return (
    <div
      className={cn(
        "relative min-w-[60px] w-[60px] h-20 border-r border-gray-200 transition-colors flex-shrink-0",
        allowDrop && "hover:bg-blue-50 cursor-pointer",
        showAsOccupied && "bg-gray-100"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-time={timeString}
      data-cleaner-id={cleanerId}
    >
      {children}
      
      {/* Drop indicator - mostrar cuando se está arrastrando sobre este slot */}
      {allowDrop && (
        <div className="absolute inset-0 border-2 border-dashed border-blue-400 bg-blue-50 opacity-0 transition-opacity duration-200 pointer-events-none drop-indicator" />
      )}
      
      {/* Time slot indicator when hovering during drag */}
      <div className="absolute bottom-0 left-0 right-0 text-xs text-center text-gray-500 opacity-0 transition-opacity duration-200 pointer-events-none time-indicator bg-white/80 py-1">
        {timeString}
      </div>
    </div>
  );
});

TimeSlot.displayName = "TimeSlot";
