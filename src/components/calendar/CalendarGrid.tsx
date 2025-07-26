import { forwardRef, memo, useMemo } from "react";
import { cn } from "@/lib/utils";
import { TimeSlot } from "./TimeSlot";
import { EnhancedTaskCard } from "./EnhancedTaskCard";
import { Task, Cleaner } from "@/types/calendar";
import { CleanerAvailability } from "@/hooks/useCleanerAvailability";
import { getCleanerAvailabilityForDay, timeToMinutes, isCleanerAvailableAtTime } from "@/utils/availabilityUtils";

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
  console.log('🔍 CleanerRow - checking availability for:', cleaner.name, 'on date:', currentDate);
  console.log('📊 CleanerRow - available data:', availability);

  // Function to check if a time slot is within available hours
  const isTimeSlotAvailable = useMemo(() => {
    return (hour: number, minute: number) => {
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      
      // Check if cleaner is available at this specific time using the utility function
      const availabilityCheck = isCleanerAvailableAtTime(
        cleaner.id,
        currentDate,
        timeString,
        timeString, // For slot check, start and end are the same
        availability
      );
      
      console.log(`⏰ TimeSlot check for ${cleaner.name} at ${timeString}:`, availabilityCheck);
      
      return availabilityCheck.available;
    };
  }, [cleaner.id, currentDate, availability]);

  // Memoize time slots for this cleaner
  const timeSlotElements = useMemo(() => {
    return timeSlots.map((time) => {
      const [hour, minute] = time.split(':').map(Number);
      const isOccupied = isTimeSlotOccupied(cleaner.id, hour, minute);
      const isAvailable = isTimeSlotAvailable(hour, minute);
      
      console.log(`🎯 TimeSlot ${time} for ${cleaner.name}: occupied=${isOccupied}, available=${isAvailable}`);
      
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
  }, [timeSlots, cleaner.id, cleaner.name, isTimeSlotOccupied, isTimeSlotAvailable, dragState.draggedTask?.id, onDragOver, onDrop, cleaners]);

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
         "h-20 relative hover:bg-accent/50 dark:hover:bg-accent/30 transition-colors flex border-b-2 border-border",
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

    // Memoize cleaner rows with tasks
    const cleanerRows = useMemo(() => {
      return cleaners.map((cleaner, index) => {
        // Filter tasks by cleaner_id (preferred) or cleaner name (fallback)
        const cleanerTasks = assignedTasks.filter(task => 
          task.cleanerId === cleaner.id || task.cleaner === cleaner.name
        );
        
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
       <div 
         className="flex-1 overflow-x-auto overflow-y-auto relative"
         onScroll={onScroll}
       >
         {/* Content con scroll */}
         <div 
           ref={ref}
           className="relative z-10"
           style={{ minWidth: '1200px' }}
         >
           {cleanerRows}
         </div>
       </div>
     );
  }
));

CalendarGrid.displayName = "CalendarGrid";
