
import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { TimeSlot } from "./TimeSlot";
import { TaskCard } from "./TaskCard";
import { Task, Cleaner } from "@/types/calendar";

interface CalendarGridProps {
  cleaners: Cleaner[];
  timeSlots: string[];
  assignedTasks: Task[];
  dragState: any;
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, cleanerId: string, startTime: string) => void;
  onDragStart: (e: React.DragEvent, task: Task) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onTaskClick: (task: Task) => void;
  getTaskPosition: (startTime: string, endTime: string) => { left: string; width: string };
  isTimeSlotOccupied: (cleanerId: string, hour: number, minute: number) => boolean;
}

export const CalendarGrid = forwardRef<HTMLDivElement, CalendarGridProps>(
  ({ 
    cleaners, 
    timeSlots, 
    assignedTasks, 
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
    return (
      <div className="flex-1 overflow-hidden relative">
        {/* Fixed horizontal divider lines - positioned absolutely to stay fixed */}
        <div className="absolute left-0 right-0 top-0 bottom-0 pointer-events-none z-20">
          {cleaners.map((_, index) => (
            <div 
              key={`fixed-divider-${index}`}
              className="absolute left-0 right-0 border-b-2 border-gray-400"
              style={{ 
                top: `${(index + 1) * 80}px`,
                height: '2px'
              }}
            />
          ))}
        </div>

        {/* Scrollable content */}
        <div 
          ref={ref}
          className="flex-1 overflow-x-auto overflow-y-auto relative z-10"
          onScroll={onScroll}
        >
          <div style={{ minWidth: '1200px' }}>
            {cleaners.map((cleaner, index) => {
              const cleanerTasks = assignedTasks.filter(task => task.cleaner === cleaner.name);
              
              return (
                <div 
                  key={cleaner.id} 
                  className={cn(
                    "h-20 relative hover:bg-gray-50 transition-colors flex",
                    index % 2 === 0 ? "bg-white" : "bg-gray-50"
                  )}
                >
                  {/* Time slots for this cleaner */}
                  {timeSlots.map((time) => {
                    const [hour, minute] = time.split(':').map(Number);
                    const isOccupied = isTimeSlotOccupied(cleaner.id, hour, minute);
                    
                    return (
                      <TimeSlot
                        key={`${cleaner.id}-${time}`}
                        hour={hour}
                        minute={minute}
                        cleanerId={cleaner.id}
                        isOccupied={isOccupied}
                        draggedTaskId={dragState.draggedTask?.id}
                        onDragOver={onDragOver}
                        onDrop={onDrop}
                      />
                    );
                  })}

                  {/* Tasks for this cleaner */}
                  {cleanerTasks.map((task) => {
                    const position = getTaskPosition(task.startTime, task.endTime);
                    const isBeingDragged = dragState.draggedTask?.id === task.id;
                    
                    return (
                      <div
                        key={task.id}
                        className={cn(
                          "absolute top-1 bottom-1 z-10",
                          isBeingDragged && "pointer-events-none"
                        )}
                        style={{
                          left: position.left,
                          width: position.width
                        }}
                        onDragOver={onDragOver}
                        onDrop={(e) => onDrop(e, cleaner.id, task.startTime)}
                      >
                        <TaskCard
                          task={task}
                          onClick={() => onTaskClick(task)}
                          isDragging={isBeingDragged}
                          onDragStart={onDragStart}
                          onDragEnd={onDragEnd}
                          style={{ height: '100%' }}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }
);

CalendarGrid.displayName = "CalendarGrid";
