import React, { memo, useCallback, useMemo } from 'react';
import { Task, Cleaner } from '@/types/calendar';
import { CleanerDateHeader } from './cleaner/CleanerDateHeader';
import { CleanerTaskSummary } from './cleaner/CleanerTaskSummary';
import { CleanerTaskCard } from './cleaner/CleanerTaskCard';
import { Skeleton } from '@/components/ui/skeleton';

interface CleanerMobileCalendarProps {
  currentDate: Date;
  onNavigateDate: (direction: 'prev' | 'next') => void;
  onDateChange?: (date: Date) => void;
  handleTaskClick: (task: Task) => void;
  todayTasks: Task[];
  tomorrowTasks: Task[];
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
  isLoading = false
}) => {
  // Memoize task click handler
  const handleTaskClickMemo = useCallback((task: Task) => {
    handleTaskClick(task);
  }, [handleTaskClick]);

  // Sort tasks by start time
  const sortedTasks = useMemo(() => {
    return [...todayTasks].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [todayTasks]);

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Date Header with Navigation */}
      <CleanerDateHeader 
        currentDate={currentDate}
        onNavigateDate={onNavigateDate}
        onDateChange={onDateChange}
      />

      {/* Task Summary */}
      <CleanerTaskSummary 
        todayTasks={todayTasks}
        tomorrowTasks={tomorrowTasks}
      />

      {/* Task Cards List */}
      <div className="flex-1 p-4 space-y-3 overflow-y-auto">
        {isLoading ? (
          <TaskSkeletonLoader />
        ) : sortedTasks.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            <div className="text-4xl mb-3">📅</div>
            <p className="text-lg font-medium mb-2">No tienes tareas para hoy</p>
            <p className="text-sm">Disfruta de tu día libre</p>
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