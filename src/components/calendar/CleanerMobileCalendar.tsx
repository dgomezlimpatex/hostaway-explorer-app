import React, { memo, useCallback, useMemo, useState } from 'react';
import { Task, Cleaner } from '@/types/calendar';
import { CleanerDateHeader } from './cleaner/CleanerDateHeader';
import { CleanerTaskSummary } from './cleaner/CleanerTaskSummary';
import { CleanerTaskCard } from './cleaner/CleanerTaskCard';
import { CleanerWeeklyView } from './cleaner/CleanerWeeklyView';
import { CleanerViewToggle, CalendarViewMode } from './cleaner/CleanerViewToggle';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { CalendarCheck } from 'lucide-react';

interface CleanerMobileCalendarProps {
  currentDate: Date;
  onNavigateDate: (direction: 'prev' | 'next') => void;
  onDateChange?: (date: Date) => void;
  handleTaskClick: (task: Task) => void;
  todayTasks: Task[];
  tomorrowTasks: Task[];
  allTasks?: Task[]; // All tasks for weekly view
  isLoading?: boolean;
}

// Skeleton loader for tasks
const TaskSkeletonLoader = memo(() => (
  <div className="space-y-3">
    {[1, 2, 3].map((i) => (
      <div key={i} className="p-6 rounded-3xl bg-muted/50">
        <Skeleton className="h-8 w-3/4 mb-4" />
        <Skeleton className="h-4 w-1/2 mb-3" />
        <div className="flex justify-between">
          <Skeleton className="h-10 w-16" />
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-10 w-16" />
        </div>
      </div>
    ))}
  </div>
));
TaskSkeletonLoader.displayName = 'TaskSkeletonLoader';

const CleanerMobileCalendarComponent: React.FC<CleanerMobileCalendarProps> = ({
  currentDate,
  onNavigateDate,
  onDateChange,
  handleTaskClick,
  todayTasks,
  tomorrowTasks,
  allTasks = [],
  isLoading = false
}) => {
  const [viewMode, setViewMode] = useState<CalendarViewMode>('daily');
  
  // Check if current date is today
  const isCurrentDateToday = useMemo(() => {
    const today = new Date();
    return currentDate.toDateString() === today.toDateString();
  }, [currentDate]);

  // Memoize task click handler
  const handleTaskClickMemo = useCallback((task: Task) => {
    handleTaskClick(task);
  }, [handleTaskClick]);

  // Sort tasks by start time
  const sortedTasks = useMemo(() => {
    return [...todayTasks].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [todayTasks]);

  // Handle go to today
  const handleGoToToday = useCallback(() => {
    if (onDateChange) {
      onDateChange(new Date());
    }
  }, [onDateChange]);

  // Handle date selection from weekly view
  const handleSelectDate = useCallback((date: Date) => {
    if (onDateChange) {
      onDateChange(date);
    }
  }, [onDateChange]);

  // Swipe gesture handlers
  const swipeHandlers = useSwipeGesture({
    onSwipeLeft: () => onNavigateDate('next'),
    onSwipeRight: () => onNavigateDate('prev'),
    threshold: 50
  });

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Date Header with Navigation */}
      <CleanerDateHeader 
        currentDate={currentDate}
        onNavigateDate={onNavigateDate}
        onDateChange={onDateChange}
      />

      {/* View Mode Toggle */}
      <CleanerViewToggle 
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* Weekly View (if enabled) */}
      {viewMode === 'weekly' && (
        <CleanerWeeklyView
          currentDate={currentDate}
          tasks={allTasks.length > 0 ? allTasks : [...todayTasks, ...tomorrowTasks]}
          onSelectDate={handleSelectDate}
        />
      )}

      {/* Task Summary */}
      <CleanerTaskSummary 
        todayTasks={todayTasks}
        tomorrowTasks={tomorrowTasks}
      />

      {/* Go to Today button (only show if not on today) */}
      {!isCurrentDateToday && (
        <div className="px-4 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGoToToday}
            className="w-full bg-primary/5 border-primary/20 text-primary hover:bg-primary/10"
          >
            <CalendarCheck className="h-4 w-4 mr-2" />
            Ir a hoy
          </Button>
        </div>
      )}

      {/* Task Cards List with swipe support */}
      <div 
        className="flex-1 p-4 space-y-3 overflow-y-auto"
        {...swipeHandlers}
      >
        {isLoading ? (
          <TaskSkeletonLoader />
        ) : sortedTasks.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            <div className="text-4xl mb-3">📅</div>
            <p className="text-lg font-medium mb-2">No tienes tareas para este día</p>
            <p className="text-sm">
              {isCurrentDateToday ? 'Disfruta de tu día libre' : 'Sin tareas programadas'}
            </p>
          </div>
        ) : (
          sortedTasks.map((task) => (
            <CleanerTaskCard
              key={task.id}
              task={task}
              onClick={() => handleTaskClickMemo(task)}
            />
          ))
        )}
      </div>
    </div>
  );
};

// Memoize the main component
export const CleanerMobileCalendar = memo(CleanerMobileCalendarComponent);
