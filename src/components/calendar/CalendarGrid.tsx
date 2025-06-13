
import { forwardRef, memo, useMemo } from "react";
import { cn } from "@/lib/utils";
import { TimeSlot } from "./TimeSlot";
import { EnhancedTaskCard } from "./EnhancedTaskCard";
import { Task, Cleaner } from "@/types/calendar";
import { CleanerAvailability } from "@/hooks/useCleanerAvailability";
import { getCleanerAvailabilityForDay, timeToMinutes } from "@/utils/availabilityUtils";

interface CalendarGridProps {
  cleaners: Cleaner[];
  timeSlots: string[];
  assignedTasks: Task[];
  availability: CleanerAvailability[];
  currentDate: Date;
  dragState: any;
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, cleanerId: string, cleaners: any[], timeSlot?: string) => void;
  onDragStart: (e: React.DragEvent, task: Task) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onTaskClick: (task: Task) => void;
  getTaskPosition: (startTime: string, endTime: string) => { left: string; width: string };
  isTimeSlotOccupied: (cleanerId: string, hour: number, minute: number) => boolean;
}

// Memoized cleaner row component for better performance
const CleanerRow = memo(({ 
  cleaner, 
  index, 
  timeSlots, 
  cleanerTasks, 
  availability,
  currentDate,
  dragState,
  onDragOver,
  onDrop,
  onDragStart,
  onDragEnd,
  onTaskClick,
  getTaskPosition,
  isTimeSlotOccupied,
  cleaners
}: {
  cleaner: Cleaner;
  index: number;
  timeSlots: string[];
  cleanerTasks: Task[];
  availability: CleanerAvailability[];
  currentDate: Date;
  dragState: any;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, cleanerId: string, cleaners: any[], timeSlot?: string) => void;
  onDragStart: (e: React.DragEvent, task: Task) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onTaskClick: (task: Task) => void;
  getTaskPosition: (startTime: string, endTime: string) => { left: string; width: string };
  isTimeSlotOccupied: (cleanerId: string, hour: number, minute: number) => boolean;
  cleaners: Cleaner[];
}) => {
  // Get availability for this cleaner for the current date
  const cleanerAvailability = useMemo(() => {
    return getCleanerAvailabilityForDay(cleaner.id, currentDate, availability);
  }, [cleaner.id, currentDate, availability]);

  // Function to check if a time slot is within available hours
  const isTimeSlotAvailable = useMemo(() => {
    return (hour: number, minute: number) => {
      if (!cleanerAvailability) return true; // If no availability set, assume available
      if (!cleanerAvailability.is_available) return false; // Marked as not available

      const slotTime = hour * 60 + minute;
      const startTime = cleanerAvailability.start_time ? timeToMinutes(cleanerAvailability.start_time) : 0;
      const endTime = cleanerAvailability.end_time ? timeToMinutes(cleanerAvailability.end_time) : 24 * 60;

      return slotTime >= startTime && slotTime < endTime;
    };
  }, [cleanerAvailability]);

  // Memoize time slots for this cleaner
  const timeSlotElements = useMemo(() => {
    return timeSlots.map((time) => {
      const [hour, minute] = time.split(':').map(Number);
      const isOccupied = isTimeSlotOccupied(cleaner.id, hour, minute);
      const isAvailable = isTimeSlotAvailable(hour, minute);
      
      return (
        <TimeSlot
          key={`${cleaner.id}-${time}`}
          hour={hour}
          minute={minute}
          cleanerId={cleaner.id}
          isOccupied={isOccupied}
          isAvailable={isAvailable}
          draggedTaskId={dragState.draggedTask?.id}
          onDragOver={onDragOver}
          onDrop={(e, cleanerId, timeSlot) => onDrop(e, cleanerId, cleaners, timeSlot)}
        />
      );
    });
  }, [timeSlots, cleaner.id, isTimeSlotOccupied, isTimeSlotAvailable, dragState.draggedTask?.id, onDragOver, onDrop, cleaners]);

  // Memoize task elements for this cleaner
  const taskElements = useMemo(() => {
    return cleanerTasks.map((task) => {
      const position = getTaskPosition(task.startTime, task.endTime);
      const isBeingDragged = dragState.draggedTask?.id === task.id;
      
      return (
        <div
          key={task.id}
          className={cn(
            "absolute top-1 bottom-1 z-10",
            isBeingDragged && "opacity-30"
          )}
          style={{
            left: position.left,
            width: position.width
          }}
        >
          <EnhancedTaskCard
            task={task}
            onClick={() => onTaskClick(task)}
            isDragging={isBeingDragged}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            style={{ height: '100%' }}
          />
        </div>
      );
    });
  }, [cleanerTasks, getTaskPosition, dragState.draggedTask?.id, onTaskClick, onDragStart, onDragEnd]);

  return (
    <div 
      className={cn(
        "h-20 relative hover:bg-accent/50 dark:hover:bg-accent/30 transition-colors flex",
        index % 2 === 0 ? "bg-background" : "bg-muted/30"
      )}
    >
      {timeSlotElements}
      {taskElements}
    </div>
  );
});

CleanerRow.displayName = "CleanerRow";

export const CalendarGrid = memo(forwardRef<HTMLDivElement, CalendarGridProps>(
  ({ 
    cleaners, 
    timeSlots, 
    assignedTasks, 
    availability,
    currentDate,
    dragState,
    onScroll,
    onDragOver,
    onDrop,
    onDragStart,
    onDragEnd,
    onTaskClick,
    getTaskPosition,
    isTimeSlotOccupied
  }, ref) => {
    // Memoize fixed divider lines
    const dividerLines = useMemo(() => {
      return cleaners.map((_, index) => (
        <div 
          key={`fixed-divider-${index}`}
          className="absolute left-0 right-0 border-b-2 border-border dark:border-border"
          style={{ 
            top: `${(index + 1) * 80}px`,
            height: '2px'
          }}
        />
      ));
    }, [cleaners.length]);

    // Memoize cleaner rows with tasks
    const cleanerRows = useMemo(() => {
      return cleaners.map((cleaner, index) => {
        const cleanerTasks = assignedTasks.filter(task => task.cleaner === cleaner.name);
        
        return (
          <CleanerRow
            key={cleaner.id}
            cleaner={cleaner}
            index={index}
            timeSlots={timeSlots}
            cleanerTasks={cleanerTasks}
            availability={availability}
            currentDate={currentDate}
            dragState={dragState}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onTaskClick={onTaskClick}
            getTaskPosition={getTaskPosition}
            isTimeSlotOccupied={isTimeSlotOccupied}
            cleaners={cleaners}
          />
        );
      });
    }, [cleaners, timeSlots, assignedTasks, availability, currentDate, dragState, onDragOver, onDrop, onDragStart, onDragEnd, onTaskClick, getTaskPosition, isTimeSlotOccupied]);

    return (
      <div className="flex-1 overflow-hidden relative">
        {/* Fixed horizontal divider lines */}
        <div className="absolute left-0 right-0 top-0 bottom-0 pointer-events-none z-20">
          {dividerLines}
        </div>

        {/* Scrollable content */}
        <div 
          ref={ref}
          className="flex-1 overflow-x-auto overflow-y-auto relative z-10"
          onScroll={onScroll}
        >
          <div style={{ minWidth: '1200px' }}>
            {cleanerRows}
          </div>
        </div>
      </div>
    );
  }
));

CalendarGrid.displayName = "CalendarGrid";
