import React, { memo, useMemo, useCallback } from 'react';
import { useOptimizedCalendarData } from '@/hooks/useOptimizedCalendarData';
import { CalendarLayout } from '@/components/calendar/CalendarLayout';
import { CalendarGrid } from '@/components/calendar/CalendarGrid';
import { OptimizedCalendarGrid } from '@/components/calendar/OptimizedCalendarGrid';
import { ResponsiveCalendarHeader } from '@/components/calendar/ResponsiveCalendarHeader';
import { UnassignedTasks } from '@/components/calendar/UnassignedTasks';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useDeviceType } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/useAuth';
import { useDragAndDrop } from '@/hooks/useDragAndDrop';
import { useAllCleanersAvailability } from '@/hooks/useAllCleanersAvailability';
import { detectTaskOverlaps } from '@/utils/taskPositioning';

interface OptimizedCalendarProps {
  currentDate: Date;
  currentView: 'day' | 'three-day' | 'week';
  onDateChange: (date: Date) => void;
  onViewChange: (view: 'day' | 'three-day' | 'week') => void;
}

export const OptimizedCalendar = memo<OptimizedCalendarProps>(({
  currentDate,
  currentView,
  onDateChange,
  onViewChange
}) => {
  const { isMobile } = useDeviceType();
  const { userRole } = useAuth();

  // Optimized data loading
  const {
    tasks,
    cleaners,
    assignedTasks,
    unassignedTasks,
    cleanersWithTasks,
    isLoading,
    navigateDate,
    goToToday,
    getTasksByCleanerId,
    getTaskPosition: baseGetTaskPosition,
    prefetchAdjacentDates
  } = useOptimizedCalendarData({
    currentDate,
    currentView,
    enabled: true
  });

  const { data: availability = [], isLoading: isLoadingAvailability } = useAllCleanersAvailability();

  // Memoized time slots generation
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = 6; hour <= 22; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      if (hour < 22) {
        slots.push(`${hour.toString().padStart(2, '0')}:30`);
      }
    }
    return slots;
  }, []);

  // Optimized task positioning with memoization
  const getTaskPosition = useCallback((startTime: string, endTime: string) => {
    const timeToPosition = (time: string) => {
      const [hours, minutes] = time.split(':').map(Number);
      const totalMinutes = (hours - 6) * 60 + minutes; // Start from 6 AM
      return (totalMinutes / 30) * 60; // 60px per 30-minute slot
    };
    
    const left = timeToPosition(startTime);
    const right = timeToPosition(endTime);
    const width = Math.max(right - left, 60); // Minimum 60px width
    
    return {
      left: `${left}px`,
      width: `${width}px`
    };
  }, []);

  // Optimized slot occupation check
  const isTimeSlotOccupied = useCallback((cleanerId: string, hour: number, minute: number) => {
    const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    const cleanerTasks = getTasksByCleanerId(cleanerId);
    
    return cleanerTasks.some(task => {
      const taskStart = task.startTime;
      const taskEnd = task.endTime;
      return timeString >= taskStart && timeString < taskEnd;
    });
  }, [getTasksByCleanerId]);

  // Enhanced drag and drop with optimized performance
  const handleTaskAssign = useCallback(async (taskId: string, cleanerId: string, cleaners: any[], timeSlot?: string) => {
    // Implementation would go here - simplified for performance demo
    console.log('Optimized task assignment:', { taskId, cleanerId, timeSlot });
  }, []);

  const {
    dragState,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop
  } = useDragAndDrop(handleTaskAssign);

  // Memoized handlers
  const handleTaskClick = useCallback((task: any) => {
    console.log('Task clicked:', task);
  }, []);

  const handleNewTask = useCallback(() => {
    console.log('New task requested');
  }, []);

  const handleNewExtraordinaryService = useCallback(() => {
    console.log('New extraordinary service requested');
  }, []);

  // Prefetch adjacent dates on mount
  React.useEffect(() => {
    prefetchAdjacentDates();
  }, [prefetchAdjacentDates]);

  if (isLoading || isLoadingAvailability) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <LoadingSpinner size="lg" text="Cargando calendario optimizado..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <div className="space-y-4 px-2 py-4 max-w-full">
        {/* Enhanced Responsive Header */}
        <ResponsiveCalendarHeader
          currentDate={currentDate}
          currentView={currentView}
          onNavigateDate={navigateDate}
          onGoToToday={goToToday}
          onViewChange={onViewChange}
          onNewTask={handleNewTask}
          onNewExtraordinaryService={handleNewExtraordinaryService}
        />

        {/* Main Calendar Layout */}
        <div className="flex gap-4">
          {/* Unassigned Tasks Column */}
          <div className="w-80 flex-shrink-0">
            <UnassignedTasks
              tasks={unassignedTasks}
              onTaskClick={handleTaskClick}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            />
          </div>

          {/* Calendar Grid Area */}
          <div className="flex-1 min-w-0">
            {/* Use optimized grid for better performance */}
            <CalendarLayout
              cleaners={cleanersWithTasks}
              timeSlots={timeSlots}
              assignedTasks={assignedTasks}
              availability={availability}
              currentDate={currentDate}
              dragState={dragState}
              headerScrollRef={React.useRef(null)}
              bodyScrollRef={React.useRef(null)}
              onHeaderScroll={() => {}}
              onBodyScroll={() => {}}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onTaskClick={handleTaskClick}
              getTaskPosition={getTaskPosition}
              isTimeSlotOccupied={isTimeSlotOccupied}
            />
          </div>
        </div>
      </div>
    </div>
  );
});

OptimizedCalendar.displayName = 'OptimizedCalendar';