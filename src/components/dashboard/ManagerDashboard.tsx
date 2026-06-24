import React, { useState, useMemo, useCallback, Suspense, lazy } from 'react';
import { format, startOfMonth, endOfMonth, isAfter, isBefore, subMonths } from 'date-fns';

import { useOptimizedTasks } from '@/hooks/useOptimizedTasks';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import { useTasksPageActions } from '@/hooks/tasks/useTasksPageActions';
import { useDeviceType } from '@/hooks/use-mobile';
import { useIncidentStats } from '@/hooks/useIncidents';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { CreateTaskModal } from '@/components/modals/CreateTaskModal';
import { BatchCreateTaskModal } from '@/components/modals/BatchCreateTaskModal';
import { TaskDetailsModal } from '@/components/modals/TaskDetailsModal';
import { CreateExtraordinaryServiceModal } from '@/components/modals/CreateExtraordinaryServiceModal';
import { buildExtraordinaryTask, type ExtraordinaryTaskFormData } from '@/services/extraordinaryTaskBuilder';
import DesktopManagerDashboard from './DesktopManagerDashboard';
import { MobileManagerDashboard } from './MobileManagerDashboard';

const LinenControlWidget = lazy(() => import('./components/LinenControlWidget').then((module) => ({ default: module.LinenControlWidget })));
const WorkloadWidget = lazy(() => import('@/components/workload/WorkloadWidget'));

const ComponentLoader = () => (
  <div className="flex items-center justify-center p-8">
    <LoadingSpinner size="sm" />
  </div>
);

export const ManagerDashboard = () => {
  const [selectedDate] = useState(new Date());
  const [selectedTask, setSelectedTask] = useState(null);
  const [isTaskDetailsOpen, setIsTaskDetailsOpen] = useState(false);
  const [isExtraordinaryServiceModalOpen, setIsExtraordinaryServiceModalOpen] = useState(false);
  const { canAccessModule } = useRolePermissions();
  const { isMobile } = useDeviceType();

  const {
    isCreateModalOpen,
    setIsCreateModalOpen,
    isBatchCreateModalOpen,
    setIsBatchCreateModalOpen,
    handleCreateTask,
    handleBatchCreateTasks,
    handleOpenCreateModal,
    handleOpenBatchModal,
  } = useTasksPageActions(selectedDate);

  const { tasks } = useOptimizedTasks({
    currentDate: selectedDate,
    currentView: 'day',
  });

  const { data: incidentStats } = useIncidentStats();

  const monthlyMetrics = useMemo(() => {
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));

    const currentMonthTasks = tasks.filter((task) => {
      const taskDate = new Date(task.date);
      return isAfter(taskDate, currentMonthStart) && isBefore(taskDate, currentMonthEnd);
    });

    const dayOfMonth = now.getDate();
    const lastMonthSameDate = new Date(lastMonthStart.getFullYear(), lastMonthStart.getMonth(), dayOfMonth);
    const lastMonthSameDateTasks = tasks.filter((task) => {
      const taskDate = new Date(task.date);
      return isAfter(taskDate, lastMonthStart) && isBefore(taskDate, lastMonthSameDate);
    });

    const percentageChange = lastMonthSameDateTasks.length > 0
      ? ((currentMonthTasks.length - lastMonthSameDateTasks.length) / lastMonthSameDateTasks.length) * 100
      : 0;

    return {
      currentMonth: currentMonthTasks.length,
      lastMonth: lastMonthSameDateTasks.length,
      percentageChange: Math.round(percentageChange),
      isPositive: percentageChange >= 0,
    };
  }, [tasks]);

  const todayTasks = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return tasks.filter((task) => task.date === today);
  }, [tasks]);

  const unassignedTasks = useMemo(() => {
    return tasks.filter((task) => !task.cleanerId && !task.cleaner);
  }, [tasks]);

  const pendingIncidents = incidentStats?.pending_limpatex ?? 0;

  const handleTaskClick = useCallback((task) => {
    setSelectedTask(task);
    setIsTaskDetailsOpen(true);
  }, []);

  const handleUpdateTask = useCallback(async (taskId, updates) => {
    console.log('Updating task:', taskId, updates);
    setIsTaskDetailsOpen(false);
  }, []);

  const handleDeleteTask = useCallback(async (taskId) => {
    console.log('Deleting task:', taskId);
    setIsTaskDetailsOpen(false);
  }, []);

  const handleCreateExtraordinaryService = useCallback(async (serviceData: ExtraordinaryTaskFormData) => {
    try {
      const taskData = buildExtraordinaryTask(serviceData);
      await handleCreateTask(taskData);
      setIsExtraordinaryServiceModalOpen(false);
    } catch (error) {
      console.error('ManagerDashboard - Error creating extraordinary service:', error);
    }
  }, [handleCreateTask]);

  const handleOpenExtraordinaryServiceModal = useCallback(() => {
    setIsExtraordinaryServiceModalOpen(true);
  }, []);

  if (isMobile) {
    return (
      <>
        <MobileManagerDashboard
          todayTasks={todayTasks}
          unassignedTasks={unassignedTasks}
          monthlyMetrics={monthlyMetrics}
          pendingIncidents={pendingIncidents}
          incidentStats={incidentStats}
          onTaskClick={handleTaskClick}
          onOpenCreateModal={handleOpenCreateModal}
          onOpenBatchModal={handleOpenBatchModal}
          onOpenExtraordinaryServiceModal={handleOpenExtraordinaryServiceModal}
          showWorkloadWidget={canAccessModule('workers')}
          showLinenWidget={canAccessModule('reports')}
          workloadWidget={
            <Suspense fallback={<ComponentLoader />}>
              <WorkloadWidget />
            </Suspense>
          }
          linenWidget={
            <Suspense fallback={<ComponentLoader />}>
              <LinenControlWidget />
            </Suspense>
          }
        />

        <CreateTaskModal
          open={isCreateModalOpen}
          onOpenChange={setIsCreateModalOpen}
          onCreateTask={handleCreateTask}
        />

        <BatchCreateTaskModal
          open={isBatchCreateModalOpen}
          onOpenChange={setIsBatchCreateModalOpen}
          onCreateTasks={handleBatchCreateTasks}
        />

        {selectedTask && (
          <TaskDetailsModal
            task={selectedTask}
            open={isTaskDetailsOpen}
            onOpenChange={setIsTaskDetailsOpen}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={handleDeleteTask}
          />
        )}

        <CreateExtraordinaryServiceModal
          open={isExtraordinaryServiceModalOpen}
          onOpenChange={setIsExtraordinaryServiceModalOpen}
          onCreateService={handleCreateExtraordinaryService}
          currentDate={selectedDate}
        />
      </>
    );
  }

  return (
    <>
      <DesktopManagerDashboard
        todayTasks={todayTasks}
        unassignedTasks={unassignedTasks}
        monthlyMetrics={monthlyMetrics}
        pendingIncidents={pendingIncidents}
        incidentStats={incidentStats}
        onTaskClick={handleTaskClick}
        onOpenCreateModal={handleOpenCreateModal}
        onOpenBatchModal={handleOpenBatchModal}
        onOpenExtraordinaryServiceModal={handleOpenExtraordinaryServiceModal}
        showWorkloadWidget={canAccessModule('workers')}
        showLinenWidget={canAccessModule('reports')}
        workloadWidget={<WorkloadWidget />}
        linenWidget={<LinenControlWidget />}
      />

      <CreateTaskModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onCreateTask={handleCreateTask}
      />

      <BatchCreateTaskModal
        open={isBatchCreateModalOpen}
        onOpenChange={setIsBatchCreateModalOpen}
        onCreateTasks={handleBatchCreateTasks}
      />

      {selectedTask && (
        <TaskDetailsModal
          task={selectedTask}
          open={isTaskDetailsOpen}
          onOpenChange={setIsTaskDetailsOpen}
          onUpdateTask={handleUpdateTask}
          onDeleteTask={handleDeleteTask}
        />
      )}

      <CreateExtraordinaryServiceModal
        open={isExtraordinaryServiceModalOpen}
        onOpenChange={setIsExtraordinaryServiceModalOpen}
        onCreateService={handleCreateExtraordinaryService}
        currentDate={selectedDate}
      />
    </>
  );
};
