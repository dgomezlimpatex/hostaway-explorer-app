import React, { memo, useMemo, useCallback } from 'react';
import { VirtualizedTable } from '@/components/ui/virtualized-table';
import { EnhancedTaskCard } from './EnhancedTaskCard';
import { Task, Cleaner } from '@/types/calendar';
import { CleanerAvailability } from '@/hooks/useCleanerAvailability';
import { cn } from '@/lib/utils';

interface OptimizedCalendarGridProps {
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
  assignmentsMap?: Record<string, string[]>;
}

// Optimized CleanerRow with better memoization
const OptimizedCleanerRow = memo<{
  cleaner: Cleaner;
  timeSlots: string[];
  tasks: Task[];
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
  assignmentsMap?: Record<string, string[]>;
}>(({ 
  cleaner, 
  timeSlots, 
  tasks, 
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
  cleaners,
  assignmentsMap 
}) => {
  // Memoize availability check function
  const isTimeSlotAvailable = useCallback((hour: number, minute: number) => {
    if (!availability || availability.length === 0) return true;
    
    const cleanerAvailability = availability.find(a => a.cleaner_id === cleaner.id);
    if (!cleanerAvailability) return true;
    
    // Simple availability check based on day of week and time
    const dayOfWeek = currentDate.getDay();
    if (cleanerAvailability.day_of_week !== dayOfWeek) return false;
    if (!cleanerAvailability.is_available) return false;
    
    const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    
    if (cleanerAvailability.start_time && cleanerAvailability.end_time) {
      return timeString >= cleanerAvailability.start_time && timeString <= cleanerAvailability.end_time;
    }
    
    return cleanerAvailability.is_available;
  }, [availability, cleaner.id, currentDate]);

  // Memoize time slot elements - simplified implementation
  const timeSlotElements = useMemo(() => {
    return timeSlots.map((time) => {
      const [hour, minute] = time.split(':').map(Number);
      const isAvailable = isTimeSlotAvailable(hour, minute);
      const isOccupied = isTimeSlotOccupied(cleaner.id, hour, minute);
      
      return (
        <div
          key={`${cleaner.id}-${time}`}
          className={cn(
            "min-w-[60px] h-20 border-r border-gray-100 relative transition-colors",
            time.endsWith(':00') ? 'bg-gray-50' : 'bg-white',
            !isAvailable && 'bg-red-50',
            isOccupied && 'bg-blue-50',
            'hover:bg-gray-100'
          )}
          onDragOver={onDragOver}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const taskId = e.dataTransfer.getData('text/plain');
            if (taskId) {
              onDrop(e, cleaner.id, cleaners, time);
            }
          }}
        />
      );
    });
  }, [timeSlots, cleaner.id, cleaners, isTimeSlotAvailable, isTimeSlotOccupied, dragState, onDragOver, onDrop]);

  // Memoize task elements with better overlap detection
  const taskElements = useMemo(() => {
    const cleanerTasks = tasks.filter(task => {
      // Direct assignment check
      if (task.cleanerId === cleaner.id) return true;
      
      // Multiple assignment check via assignmentsMap
      if (assignmentsMap && assignmentsMap[task.id]) {
        return assignmentsMap[task.id].includes(cleaner.id);
      }
      
      return false;
    });

    return cleanerTasks.map((task) => {
      const position = getTaskPosition(task.startTime, task.endTime);
      
      // Calculate overlap count for this specific task and cleaner
      const overlappingTasks = cleanerTasks.filter(otherTask => 
        otherTask.id !== task.id &&
        otherTask.startTime < task.endTime &&
        otherTask.endTime > task.startTime
      );
      
      const overlapIndex = overlappingTasks.findIndex(t => t.id < task.id);
      const totalOverlaps = overlappingTasks.length + 1;
      
      return (
        <div
          key={task.id}
          className="absolute"
          style={{
            left: position.left,
            width: position.width,
            top: overlapIndex >= 0 ? `${overlapIndex * 8}px` : '0px',
            zIndex: overlapIndex >= 0 ? 10 + overlapIndex : 10,
            transform: totalOverlaps > 1 ? `scale(${1 - (overlapIndex * 0.05)})` : 'none'
          }}
        >
          <EnhancedTaskCard
            task={task}
            onClick={() => onTaskClick(task)}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            isDragging={dragState.isDragging && dragState.draggedTaskId === task.id}
          />
        </div>
      );
    });
  }, [tasks, cleaner.id, assignmentsMap, getTaskPosition, onTaskClick, onDragStart, onDragEnd, dragState]);

  return (
    <div 
      className="relative h-20 border-b-2 border-gray-300 bg-white hover:bg-gray-50 transition-colors"
      style={{ minWidth: '1200px' }}
    >
      {timeSlotElements}
      {taskElements}
    </div>
  );
});

OptimizedCleanerRow.displayName = 'OptimizedCleanerRow';

export const OptimizedCalendarGrid = memo<OptimizedCalendarGridProps>(({
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
  isTimeSlotOccupied,
  assignmentsMap
}) => {
  // Virtualized rendering for large cleaner lists
  const renderCleanerRow = useCallback((item: Cleaner & { index: number }) => {
    return (
      <OptimizedCleanerRow
        cleaner={item}
        timeSlots={timeSlots}
        tasks={assignedTasks}
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
        assignmentsMap={assignmentsMap}
      />
    );
  }, [
    timeSlots,
    assignedTasks,
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
    cleaners,
    assignmentsMap
  ]);

  // Use virtualization only for large cleaner lists
  if (cleaners.length > 20) {
    return (
      <VirtualizedTable
        data={cleaners}
        height={700}
        itemHeight={82} // 80px + 2px border
        renderItem={renderCleanerRow}
        className="bg-white"
        overscan={5}
      />
    );
  }

  // For smaller lists, render normally with memoization
  const cleanerRows = useMemo(() => {
    return cleaners.map((cleaner) => (
      <OptimizedCleanerRow
        key={cleaner.id}
        cleaner={cleaner}
        timeSlots={timeSlots}
        tasks={assignedTasks}
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
        assignmentsMap={assignmentsMap}
      />
    ));
  }, [
    cleaners,
    timeSlots,
    assignedTasks,
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
    assignmentsMap
  ]);

  return (
    <div className="bg-white" onScroll={onScroll}>
      {cleanerRows}
    </div>
  );
});

OptimizedCalendarGrid.displayName = 'OptimizedCalendarGrid';