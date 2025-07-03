import React from 'react';
import { useDeviceType } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/useAuth';
import { Task, Cleaner } from '@/types/calendar';
import { CalendarModalsWithSuspense } from './LazyCalendarComponents';

interface CleanerMobileCalendarProps {
  tasks: Task[];
  cleaners: Cleaner[];
  currentDate: Date;
  selectedTask: Task | null;
  isTaskModalOpen: boolean;
  setIsTaskModalOpen: (open: boolean) => void;
  handleTaskClick: (task: Task) => void;
  handleUpdateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  handleDeleteTask: (taskId: string) => Promise<void>;
  handleUnassignTask: (taskId: string) => Promise<void>;
}

export const CleanerMobileCalendar: React.FC<CleanerMobileCalendarProps> = ({
  tasks,
  cleaners,
  currentDate,
  selectedTask,
  isTaskModalOpen,
  setIsTaskModalOpen,
  handleTaskClick,
  handleUpdateTask,
  handleDeleteTask,
  handleUnassignTask
}) => {
  const { isMobile } = useDeviceType();
  const { userRole } = useAuth();

  // Only render for mobile cleaners
  if (!isMobile || userRole !== 'cleaner') {
    return null;
  }

  // Filter tasks for today
  const todayTasks = tasks.filter(task => 
    task.date === currentDate.toISOString().split('T')[0]
  );

  // Calculate tomorrow's tasks
  const tomorrow = new Date(currentDate);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowTasks = tasks.filter(task => 
    task.date === tomorrow.toISOString().split('T')[0]
  );

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Date Header - Placeholder for now */}
      <div className="p-4 border-b border-border">
        <h1 className="text-2xl font-bold">
          {currentDate.toLocaleDateString('es-ES', { 
            day: '2-digit',
            month: '2-digit',
            weekday: 'short' 
          })}
        </h1>
      </div>

      {/* Task Summary - Placeholder for now */}
      <div className="p-4 space-y-2">
        <div className="text-sm text-muted-foreground">
          Tareas hoy: {todayTasks.length}
        </div>
        <div className="text-sm text-muted-foreground">
          Tareas mañana: {tomorrowTasks.length}
        </div>
      </div>

      {/* Task Cards - Placeholder for now */}
      <div className="flex-1 p-4 space-y-3 overflow-y-auto">
        {todayTasks.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No tienes tareas asignadas para hoy
          </div>
        ) : (
          todayTasks.map((task) => (
            <div 
              key={task.id}
              onClick={() => handleTaskClick(task)}
              className="bg-card p-4 rounded-lg border border-border shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="font-medium text-foreground">
                {task.property}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {task.startTime} - {task.endTime}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modals */}
      <CalendarModalsWithSuspense
        isCreateModalOpen={false}
        setIsCreateModalOpen={() => {}}
        selectedTask={selectedTask}
        isTaskModalOpen={isTaskModalOpen}
        setIsTaskModalOpen={setIsTaskModalOpen}
        currentDate={currentDate}
        onCreateTask={async () => {}}
        onUpdateTask={handleUpdateTask}
        onDeleteTask={handleDeleteTask}
        onUnassignTask={handleUnassignTask}
      />
    </div>
  );
};