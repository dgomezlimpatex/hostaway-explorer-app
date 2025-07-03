import React from 'react';
import { Task, Cleaner } from '@/types/calendar';
import { CleanerDateHeader } from './cleaner/CleanerDateHeader';
import { CleanerTaskSummary } from './cleaner/CleanerTaskSummary';
import { CleanerTaskCard } from './cleaner/CleanerTaskCard';

interface CleanerMobileCalendarProps {
  currentDate: Date;
  onNavigateDate: (direction: 'prev' | 'next') => void;
  handleTaskClick: (task: Task) => void;
  todayTasks: Task[];
  tomorrowTasks: Task[];
}

export const CleanerMobileCalendar: React.FC<CleanerMobileCalendarProps> = ({
  currentDate,
  onNavigateDate,
  handleTaskClick,
  todayTasks,
  tomorrowTasks
}) => {
  console.log('CleanerMobileCalendar rendering - Today tasks:', todayTasks?.length || 0);

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Date Header with Navigation */}
      <CleanerDateHeader 
        currentDate={currentDate}
        onNavigateDate={onNavigateDate}
      />

      {/* Task Summary */}
      <CleanerTaskSummary 
        todayTasks={todayTasks}
        tomorrowTasks={tomorrowTasks}
      />

      {/* Task Cards List */}
      <div className="flex-1 p-4 space-y-3 overflow-y-auto">
        {todayTasks.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            <div className="text-4xl mb-3">📅</div>
            <p className="text-lg font-medium mb-2">No tienes tareas para hoy</p>
            <p className="text-sm">Disfruta de tu día libre</p>
          </div>
        ) : (
          todayTasks.map((task) => (
            <CleanerTaskCard
              key={task.id}
              task={task}
              onClick={handleTaskClick}
            />
          ))
        )}
      </div>

    </div>
  );
};