
import React, { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTasks } from '@/hooks/useTasks';
import { useTaskReports } from '@/hooks/useTaskReports';
import { useCleaners } from '@/hooks/useCleaners';
import { DashboardStatsCards } from './components/DashboardStatsCards';
import { DashboardMetricsCards } from './components/DashboardMetricsCards';
import { TodayTasksSection } from './components/TodayTasksSection';
import { CreateTaskModal } from '@/components/modals/CreateTaskModal';
import { BatchCreateTaskModal } from '@/components/modals/BatchCreateTaskModal';
import { MobileDashboardSidebar } from './MobileDashboardSidebar';
import { MobileDashboardHeader } from './MobileDashboardHeader';
import { DashboardSidebar } from './DashboardSidebar';
import { RoleBasedNavigation } from '@/components/navigation/RoleBasedNavigation';
import { startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';

export const MainDashboard = () => {
  const { profile } = useAuth();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const currentDate = new Date();
  const { tasks } = useTasks(currentDate, 'week');
  const { reports } = useTaskReports();
  const { cleaners } = useCleaners();

  // Calculate monthly metrics properly
  const monthlyMetrics = useMemo(() => {
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthStart = startOfMonth(lastMonthDate);
    const lastMonthEnd = endOfMonth(lastMonthDate);

    // Filter completed tasks for current month
    const currentMonthTasks = tasks.filter(task => {
      if (task.status !== 'completed') return false;
      const taskDate = new Date(task.date);
      return taskDate >= currentMonthStart && taskDate <= currentMonthEnd;
    });

    // Filter completed tasks for last month
    const lastMonthTasks = tasks.filter(task => {
      if (task.status !== 'completed') return false;
      const taskDate = new Date(task.date);
      return taskDate >= lastMonthStart && taskDate <= lastMonthEnd;
    });

    const currentMonth = currentMonthTasks.length;
    const lastMonthCount = lastMonthTasks.length;
    
    const percentageChange = lastMonthCount > 0 
      ? ((currentMonth - lastMonthCount) / lastMonthCount) * 100 
      : currentMonth > 0 ? 100 : 0;

    return {
      currentMonth,
      lastMonth: lastMonthCount,
      percentageChange: Math.round(percentageChange),
      isPositive: percentageChange >= 0,
    };
  }, [tasks]);

  // Calculate today's tasks and other metrics
  const todayTasks = useMemo(() => {
    const today = new Date();
    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);
    
    return tasks.filter(task => {
      const taskDate = new Date(task.date);
      return taskDate >= todayStart && taskDate <= todayEnd;
    });
  }, [tasks]);

  // Calculate pending incidents from reports
  const pendingIncidents = useMemo(() => {
    if (!reports) return 0;
    return reports.filter(report => 
      report.issues_found && 
      report.issues_found.length > 0 && 
      report.overall_status !== 'completed'
    ).length;
  }, [reports]);

  // Calculate unassigned tasks
  const unassignedTasksCount = useMemo(() => {
    return tasks.filter(task => !task.cleaner || task.cleaner === 'Sin asignar').length;
  }, [tasks]);

  return (
    <div className="flex h-screen bg-gray-50">
      <DashboardSidebar />
      
      <MobileDashboardSidebar
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <MobileDashboardHeader
          onMenuClick={() => setIsMobileSidebarOpen(true)}
          userName={profile?.full_name || 'Usuario'}
        />

        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Panel de Control
                </h1>
                <p className="text-gray-600 mt-1">
                  Bienvenido, {profile?.full_name || 'Usuario'}
                </p>
              </div>
              <RoleBasedNavigation />
            </div>

            <DashboardStatsCards
              monthlyMetrics={monthlyMetrics}
              onOpenCreateModal={() => setIsCreateModalOpen(true)}
              onOpenBatchModal={() => setIsBatchModalOpen(true)}
            />

            <DashboardMetricsCards
              pendingIncidents={pendingIncidents}
              unassignedTasksCount={unassignedTasksCount}
              todayTasks={todayTasks}
            />

            <TodayTasksSection tasks={todayTasks} />
          </div>
        </main>
      </div>

      <CreateTaskModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
      />

      <BatchCreateTaskModal
        open={isBatchModalOpen}
        onOpenChange={setIsBatchModalOpen}
      />
    </div>
  );
};
