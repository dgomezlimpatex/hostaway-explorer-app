import React, { memo, useMemo } from 'react';
import { Task } from '@/types/calendar';
import { cn } from '@/lib/utils';

interface CleanerWeeklyViewProps {
  currentDate: Date;
  tasks: Task[];
  onSelectDate: (date: Date) => void;
}

const CleanerWeeklyViewComponent: React.FC<CleanerWeeklyViewProps> = ({
  currentDate,
  tasks,
  onSelectDate
}) => {
  // Generate week days centered on current date
  const weekDays = useMemo(() => {
    const days: Date[] = [];
    const startOfWeek = new Date(currentDate);
    const dayOfWeek = startOfWeek.getDay();
    // Start from Monday (1) - adjust for Sunday (0)
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    startOfWeek.setDate(startOfWeek.getDate() + diff);
    
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    return days;
  }, [currentDate]);

  // Get tasks for a specific date
  const getTasksForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return tasks.filter(task => task.date === dateStr);
  };

  // Check if date is today
  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Check if date is selected
  const isSelected = (date: Date) => {
    return date.toDateString() === currentDate.toDateString();
  };

  // Get status colors for dots
  const getStatusDots = (dateTasks: Task[]) => {
    const pending = dateTasks.filter(t => t.status !== 'completed').length;
    const completed = dateTasks.filter(t => t.status === 'completed').length;
    return { pending, completed };
  };

  const dayNames = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  return (
    <div className="bg-background/60 backdrop-blur-sm border-b border-border/50">
      <div className="grid grid-cols-7 gap-1 p-3">
        {weekDays.map((day, index) => {
          const dateTasks = getTasksForDate(day);
          const { pending, completed } = getStatusDots(dateTasks);
          const selected = isSelected(day);
          const today = isToday(day);
          
          return (
            <button
              key={index}
              onClick={() => onSelectDate(day)}
              className={cn(
                "flex flex-col items-center py-2 px-1 rounded-xl transition-all duration-200",
                selected && "bg-primary text-primary-foreground shadow-lg scale-105",
                !selected && today && "bg-primary/20 ring-2 ring-primary/50",
                !selected && !today && "hover:bg-muted/50"
              )}
            >
              {/* Day name */}
              <span className={cn(
                "text-[10px] font-medium mb-1",
                selected ? "text-primary-foreground/80" : "text-muted-foreground"
              )}>
                {dayNames[index]}
              </span>
              
              {/* Day number */}
              <span className={cn(
                "text-lg font-bold mb-1",
                selected ? "text-primary-foreground" : "text-foreground"
              )}>
                {day.getDate()}
              </span>
              
              {/* Task indicators */}
              <div className="flex gap-0.5 min-h-[8px]">
                {pending > 0 && (
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    selected ? "bg-amber-200" : "bg-amber-500"
                  )} />
                )}
                {completed > 0 && (
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    selected ? "bg-green-200" : "bg-green-500"
                  )} />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const CleanerWeeklyView = memo(CleanerWeeklyViewComponent);
