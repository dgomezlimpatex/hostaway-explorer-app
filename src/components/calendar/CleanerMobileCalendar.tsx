import React from 'react';
import { Task, Cleaner } from '@/types/calendar';
import { CalendarModalsWithSuspense } from './LazyCalendarComponents';
import { CleanerDateHeader } from './cleaner/CleanerDateHeader';
import { CleanerTaskSummary } from './cleaner/CleanerTaskSummary';
import { CleanerTaskCard } from './cleaner/CleanerTaskCard';

interface CleanerMobileCalendarProps {
  tasks: Task[];
  cleaners: Cleaner[];
  currentDate: Date;
  onNavigateDate: (direction: 'prev' | 'next') => void;
  selectedTask: Task | null;
  isTaskModalOpen: boolean;
  setIsTaskModalOpen: (open: boolean) => void;
  handleTaskClick: (task: Task) => void;
  handleUpdateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  handleDeleteTask: (taskId: string) => Promise<void>;
  handleUnassignTask: (taskId: string) => Promise<void>;
  todayTasks: Task[];
  tomorrowTasks: Task[];
}

export const CleanerMobileCalendar: React.FC<CleanerMobileCalendarProps> = ({
  currentDate,
  onNavigateDate,
  selectedTask,
  isTaskModalOpen,
  setIsTaskModalOpen,
  handleTaskClick,
  handleUpdateTask,
  handleDeleteTask,
  handleUnassignTask,
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