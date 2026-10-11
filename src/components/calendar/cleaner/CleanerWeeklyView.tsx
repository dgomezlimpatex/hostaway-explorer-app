import React, { memo, useMemo } from 'react';
import { Task } from '@/types/calendar';
import { cn } from '@/lib/utils';
import { formatMadridDate } from '@/utils/date';
import { getMadridToday, getMadridWeekDays } from '@/utils/madridCalendar';

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
  // Monday-to-Sunday week of the selected date, in Europe/Madrid. Dates are
  // noon UTC, like the rest of the cleaner calendar.
  const weekDays = useMemo(
    () => getMadridWeekDays(currentDate).map((day) => new Date(`${day}T12:00:00Z`)),
    [currentDate]
  );
  const todayStr = getMadridToday();
  const selectedStr = formatMadridDate(currentDate);

  // Get tasks for a specific date
  const getTasksForDate = (date: Date) => {
    const dateStr = formatMadridDate(date);
    return tasks.filter(task => task.date === dateStr);
  };

  const isToday = (date: Date) => formatMadridDate(date) === todayStr;
  const isSelected = (date: Date) => formatMadridDate(date) === selectedStr;

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
              type="button"
              autoCapitalize="off"
              spellCheck={false}
              onClick={() => onSelectDate(day)}
              className={cn(
                "flex flex-col items-center py-2 px-1 rounded-md transition-all duration-200",
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
                {day.getUTCDate()}
              </span>
              
              {/* Task indicators */}
              <div className="flex gap-0.5 min-h-[8px]">
                {pending > 0 && (
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    selected ? "bg-warning ring-1 ring-primary-foreground" : "bg-warning"
                  )} />
                )}
                {completed > 0 && (
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    selected ? "bg-success ring-1 ring-primary-foreground" : "bg-success"
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
