import React from 'react';
import { useDeviceType } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/useAuth';
import { Task, Cleaner } from '@/types/calendar';
import { CalendarModalsWithSuspense } from './LazyCalendarComponents';
import { CleanerDateHeader } from './cleaner/CleanerDateHeader';
import { CleanerTaskSummary } from './cleaner/CleanerTaskSummary';
import { CleanerTaskCard } from './cleaner/CleanerTaskCard';
import { useCleanerMobileNavigation } from '@/hooks/useCleanerMobileNavigation';
import { useCleanerTaskSummary } from '@/hooks/useCleanerTaskSummary';

interface CleanerMobileCalendarProps {
  tasks: Task[];
  cleaners: Cleaner[];
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

  // Only render for mobile cleaners - early return before hooks
  if (!isMobile || userRole !== 'cleaner') {
    return null;
  }

  return <CleanerMobileCalendarContent 
    tasks={tasks}
    cleaners={cleaners}
    selectedTask={selectedTask}
    isTaskModalOpen={isTaskModalOpen}
    setIsTaskModalOpen={setIsTaskModalOpen}
    handleTaskClick={handleTaskClick}
    handleUpdateTask={handleUpdateTask}
    handleDeleteTask={handleDeleteTask}
    handleUnassignTask={handleUnassignTask}
  />;
};

// Separate component to avoid hook rule violations
const CleanerMobileCalendarContent: React.FC<CleanerMobileCalendarProps> = ({
  tasks,
  cleaners,
  selectedTask,
  isTaskModalOpen,
  setIsTaskModalOpen,
  handleTaskClick,
  handleUpdateTask,
  handleDeleteTask,
  handleUnassignTask
}) => {
  console.log('CleanerMobileCalendarContent rendering with tasks:', tasks?.length || 0);
  
  const { user, userRole } = useAuth();
  const { currentDate, navigateDate } = useCleanerMobileNavigation();
  
  // Get current user's cleaner ID
  const currentCleanerId = React.useMemo(() => {
    if (userRole !== 'cleaner' || !user?.id || !cleaners) return null;
    const currentCleaner = cleaners.find(cleaner => cleaner.user_id === user.id);
    return currentCleaner?.id || null;
  }, [userRole, user?.id, cleaners]);
  
  // Use the task summary hook for better organization
  const { todayTasks, tomorrowTasks } = useCleanerTaskSummary({
    tasks,
    currentDate,
    currentCleanerId
  });

  console.log('Current cleaner ID:', currentCleanerId);
  console.log('Today tasks:', todayTasks?.length || 0, 'Tomorrow tasks:', tomorrowTasks?.length || 0);

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Date Header with Navigation */}
      <CleanerDateHeader 
        currentDate={currentDate}
        onNavigateDate={navigateDate}
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