import React from 'react';
import { useDeviceType } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/useAuth';
import { Task, Cleaner } from '@/types/calendar';
import { CalendarModalsWithSuspense } from './LazyCalendarComponents';
import { CleanerDateHeader } from './cleaner/CleanerDateHeader';
import { CleanerTaskSummary } from './cleaner/CleanerTaskSummary';
import { CleanerTaskCard } from './cleaner/CleanerTaskCard';
import { useCleanerTaskSummary } from '@/hooks/useCleanerTaskSummary';

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
}

export const CleanerMobileCalendar: React.FC<CleanerMobileCalendarProps> = (props) => {
  console.log('CleanerMobileCalendar rendering with props:', props);
  
  const { user, userRole } = useAuth();
  
  // Get current user's cleaner ID
  const currentCleanerId = React.useMemo(() => {
    if (userRole !== 'cleaner' || !user?.id || !props.cleaners) return null;
    const currentCleaner = props.cleaners.find(cleaner => cleaner.user_id === user.id);
    return currentCleaner?.id || null;
  }, [userRole, user?.id, props.cleaners]);
  
  // Use the task summary hook for better organization
  const { todayTasks, tomorrowTasks } = useCleanerTaskSummary({
    tasks: props.tasks,
    currentDate: props.currentDate,
    currentCleanerId
  });

  console.log('Current cleaner ID:', currentCleanerId);
  console.log('Today tasks:', todayTasks?.length || 0, 'Tomorrow tasks:', tomorrowTasks?.length || 0);

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Date Header with Navigation */}
      <CleanerDateHeader 
        currentDate={props.currentDate}
        onNavigateDate={props.onNavigateDate}
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
              onClick={props.handleTaskClick}
            />
          ))
        )}
      </div>

      {/* Modals */}
      <CalendarModalsWithSuspense
        isCreateModalOpen={false}
        setIsCreateModalOpen={() => {}}
        selectedTask={props.selectedTask}
        isTaskModalOpen={props.isTaskModalOpen}
        setIsTaskModalOpen={props.setIsTaskModalOpen}
        currentDate={props.currentDate}
        onCreateTask={async () => {}}
        onUpdateTask={props.handleUpdateTask}
        onDeleteTask={props.handleDeleteTask}
        onUnassignTask={props.handleUnassignTask}
      />
    </div>
  );