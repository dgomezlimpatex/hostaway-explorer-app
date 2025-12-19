
import { memo, useCallback } from "react";
import { cn } from "@/lib/utils";

interface HourlyAbsence {
  type: string;
  startTime: string;
  endTime: string;
  color: string;
}

interface TimeSlotProps {
  hour: number;
  minute: number;
  cleanerId: string;
  isOccupied: boolean;
  isAvailable?: boolean;
  draggedTaskId?: string | null;
  hourlyAbsence?: HourlyAbsence | null;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, cleanerId: string, timeSlot?: string) => void;
  children?: React.ReactNode;
}

export const TimeSlot = memo(({ 
  hour, 
  minute, 
  cleanerId, 
  isOccupied, 
  isAvailable = true,
  draggedTaskId,
  hourlyAbsence,
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
    
    // Only add drag-over style if the slot is available
    if (isAvailable) {
      (e.currentTarget as HTMLElement).classList.add('drag-over');
    }
  }, [onDragOver, isAvailable]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only remove drag-over if we're actually leaving this element
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      (e.currentTarget as HTMLElement).classList.remove('drag-over');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('💧 TimeSlot - handleDrop called for:', { cleanerId, timeString, draggedTaskId, isAvailable });
    (e.currentTarget as HTMLElement).classList.remove('drag-over');
    
    // Only allow drop if the slot is available and there's a dragged task
    if (draggedTaskId && isAvailable) {
      console.log('✅ TimeSlot - Processing drop for task:', draggedTaskId);
      onDrop(e, cleanerId, timeString);
    } else {
      console.log('⚠️ TimeSlot - Drop not allowed:', { draggedTaskId, isAvailable });
    }
  }, [onDrop, cleanerId, timeString, draggedTaskId, isAvailable]);

  // Allow drop only if there's a dragged task AND the slot is available
  const allowDrop = draggedTaskId !== null && isAvailable;
  // Show as occupied if really occupied AND no task being dragged
  const showAsOccupied = isOccupied && !draggedTaskId;

  return (
    <div
      className={cn(
        "relative min-w-[60px] w-[60px] h-20 border-r border-gray-200 transition-colors flex-shrink-0",
        // Available slots
        isAvailable && !hourlyAbsence && allowDrop && "hover:bg-blue-50 cursor-pointer",
        // Unavailable slots - show with different styling
        !isAvailable && !hourlyAbsence && "bg-red-50 border-red-200",
        // Occupied slots
        showAsOccupied && !hourlyAbsence && "bg-gray-100"
      )}
      style={hourlyAbsence ? {
        backgroundColor: `${hourlyAbsence.color}20`,
        borderColor: `${hourlyAbsence.color}40`
      } : undefined}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-time={timeString}
      data-cleaner-id={cleanerId}
      title={hourlyAbsence 
        ? `Ausencia: ${hourlyAbsence.startTime} - ${hourlyAbsence.endTime}` 
        : !isAvailable 
          ? "Trabajador no disponible en este horario" 
          : undefined}
    >
      {children}
      
      {/* Hourly absence indicator */}
      {hourlyAbsence && (
        <div 
          className="absolute inset-0 flex items-center justify-center opacity-40"
          style={{ backgroundColor: hourlyAbsence.color }}
        >
          <div className="w-full h-[2px] bg-white/60 transform -rotate-12"></div>
        </div>
      )}
      
      {/* Drop indicator - show when dragging over available slot */}
      {allowDrop && !hourlyAbsence && (
        <div className="absolute inset-0 border-2 border-dashed border-blue-400 bg-blue-50 opacity-0 transition-opacity duration-200 pointer-events-none drop-indicator" />
      )}
      
      {/* Unavailable indicator */}
      {!isAvailable && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-full h-0.5 bg-red-300 transform rotate-45"></div>
          <div className="w-full h-0.5 bg-red-300 transform -rotate-45 absolute"></div>
        </div>
      )}
      
      {/* Time slot indicator when hovering during drag */}
      <div className="absolute bottom-0 left-0 right-0 text-xs text-center text-gray-500 opacity-0 transition-opacity duration-200 pointer-events-none time-indicator bg-white/80 py-1">
        {timeString}
      </div>
    </div>
  );
});

TimeSlot.displayName = "TimeSlot";
