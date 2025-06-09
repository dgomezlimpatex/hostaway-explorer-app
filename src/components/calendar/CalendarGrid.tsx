
import { forwardRef } from "react";
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
      <div 
        ref={ref}
        className="flex-1 overflow-x-auto overflow-y-auto"
        onScroll={onScroll}
      >
        <div style={{ minWidth: '1200px' }}>
          {cleaners.map((cleaner) => {
            const cleanerTasks = assignedTasks.filter(task => task.cleaner === cleaner.name);
            
            return (
              <div key={cleaner.id} className="h-20 border-b border-gray-100 relative hover:bg-gray-25 transition-colors flex">
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
                      onDragOver={onDragOver}
                      onDrop={onDrop}
                    />
                  );
                })}

                {/* Tasks for this cleaner */}
                {cleanerTasks.map((task) => {
                  const position = getTaskPosition(task.startTime, task.endTime);
                  return (
                    <div
                      key={task.id}
                      className="absolute top-1 bottom-1 z-10"
                      style={{
                        left: position.left,
                        width: position.width
                      }}
                    >
                      <TaskCard
                        task={task}
                        onClick={() => onTaskClick(task)}
                        isDragging={dragState.draggedTask?.id === task.id}
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
    );
  }
);

CalendarGrid.displayName = "CalendarGrid";
