import React from 'react';
import { Task } from '@/types/calendar';
import { CleanerDateHeader } from './cleaner/CleanerDateHeader';
import { CleanerTaskSummary } from './cleaner/CleanerTaskSummary';
import { CleanerTaskCard } from './cleaner/CleanerTaskCard';

interface CleanerDesktopCalendarProps {
  currentDate: Date;
  onNavigateDate: (direction: 'prev' | 'next') => void;
  onDateChange?: (date: Date) => void;
  handleTaskClick: (task: Task) => void;
  todayTasks: Task[];
  tomorrowTasks: Task[];
}

export const CleanerDesktopCalendar: React.FC<CleanerDesktopCalendarProps> = ({
  currentDate,
  onNavigateDate,
  onDateChange,
  handleTaskClick,
  todayTasks,
  tomorrowTasks
}) => {
  console.log('CleanerDesktopCalendar rendering - Today tasks:', todayTasks?.length || 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Date Header with Navigation */}
      <CleanerDateHeader 
        currentDate={currentDate}
        onNavigateDate={onNavigateDate}
        onDateChange={onDateChange}
      />

      {/* Main Content Area */}
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        {/* Task Summary */}
        <div className="mb-8">
          <CleanerTaskSummary 
            todayTasks={todayTasks}
            tomorrowTasks={tomorrowTasks}
          />
        </div>

        {/* Tasks Grid */}
        <div className="space-y-8">
          {/* Today's Tasks Section */}
          <section>
            <div className="flex items-center gap-4 mb-6">
              <h2 className="text-3xl font-bold text-foreground">Tareas de Hoy</h2>
              <div className="flex-1 h-px bg-gradient-to-r from-border via-border/50 to-transparent"></div>
              <span className="text-lg font-semibold text-muted-foreground bg-primary/10 px-4 py-2 rounded-full">
                {currentDate.toLocaleDateString('es-ES', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </span>
            </div>
            
            {todayTasks.length === 0 ? (
              <div className="text-center py-16 bg-gradient-to-br from-muted/20 to-muted/40 rounded-3xl border border-border/50">
                <div className="text-6xl mb-4">📅</div>
                <p className="text-2xl font-medium mb-3 text-foreground">No tienes tareas para hoy</p>
                <p className="text-lg text-muted-foreground">Disfruta de tu día libre</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {todayTasks.map((task) => (
                  <CleanerTaskCard
                    key={task.id}
                    task={task}
                    onClick={() => handleTaskClick(task)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Tomorrow's Tasks Section */}
          {tomorrowTasks.length > 0 && (
            <section>
              <div className="flex items-center gap-4 mb-6">
                <h2 className="text-2xl font-bold text-foreground">Tareas de Mañana</h2>
                <div className="flex-1 h-px bg-gradient-to-r from-border via-border/50 to-transparent"></div>
                <span className="text-base font-medium text-muted-foreground bg-secondary/10 px-3 py-1 rounded-full">
                  {(() => {
                    const tomorrow = new Date(currentDate);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    return tomorrow.toLocaleDateString('es-ES', { 
                      weekday: 'long', 
                      month: 'long', 
                      day: 'numeric' 
                    });
                  })()}
                </span>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {tomorrowTasks.map((task) => (
                  <CleanerTaskCard
                    key={task.id}
                    task={task}
                    onClick={() => handleTaskClick(task)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};