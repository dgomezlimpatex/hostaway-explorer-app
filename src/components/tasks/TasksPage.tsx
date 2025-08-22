
import React, { useState, useMemo, useCallback, memo } from 'react';
import { MemoizedTasksPageHeader, MemoizedTasksPageContent } from './components/MemoizedTaskComponents';
import { TaskHistoryModal } from './components/TaskHistoryModal';
import { TaskReportModal } from '@/components/modals/TaskReportModal';
import { GroupedTaskReportModal } from '@/components/modals/GroupedTaskReportModal';
import { CreateTaskModal } from '@/components/modals/CreateTaskModal';
import { BatchCreateTaskModal } from '@/components/modals/BatchCreateTaskModal';
import { AssignMultipleCleanersModal } from '@/components/modals/AssignMultipleCleanersModal';
import { useTasksPageState } from '@/hooks/tasks/useTasksPageState';
import { useTasksPageActions } from '@/hooks/tasks/useTasksPageActions';
import { Task } from '@/types/calendar';

const TasksPage = memo(() => {
  const [selectedTaskForReport, setSelectedTaskForReport] = useState<Task | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedTaskForGroupedReport, setSelectedTaskForGroupedReport] = useState<Task | null>(null);
  const [isGroupedReportModalOpen, setIsGroupedReportModalOpen] = useState(false);
  const [selectedTaskForMultipleAssignment, setSelectedTaskForMultipleAssignment] = useState<Task | null>(null);
  const [isMultipleAssignmentModalOpen, setIsMultipleAssignmentModalOpen] = useState(false);

  const {
    searchTerm,
    filters,
    showPastTasks,
    currentPage,
    tasks,
    isLoading,
    sortedTasks,
    paginatedTasks,
    totalPages,
    setSearchTerm,
    setFilters,
    handleTogglePastTasks,
    handlePageChange,
    refetch,
  } = useTasksPageState();

  const {
    isCreateModalOpen,
    setIsCreateModalOpen,
    isBatchCreateModalOpen,
    setIsBatchCreateModalOpen,
    selectedTaskForHistory,
    isHistoryModalOpen,
    setIsHistoryModalOpen,
    handleCreateTask,
    handleBatchCreateTasks,
    handleShowHistory,
    handleOpenCreateModal,
    handleOpenBatchModal,
  } = useTasksPageActions();

  // Calculate unassigned tasks for bulk auto-assignment
  const unassignedTasks = useMemo(() => {
    if (showPastTasks) return [];
    return tasks.filter(task => !task.cleanerId && !task.cleaner);
  }, [tasks, showPastTasks]);

  const handleCreateReport = useCallback((task: Task) => {
    console.log('Opening report modal for task:', task.id);
    setSelectedTaskForReport(task);
    setIsReportModalOpen(true);
  }, []);

  const handleOpenGroupedReport = useCallback((task: Task) => {
    console.log('Opening grouped report modal for task:', task.id);
    setSelectedTaskForGroupedReport(task);
    setIsGroupedReportModalOpen(true);
  }, []);

  const handleAssignmentComplete = useCallback(() => {
    console.log('Assignment completed, refreshing tasks...');
    refetch();
  }, [refetch]);

  const handleAssignMultipleCleaners = useCallback((task: Task) => {
    console.log('Opening multiple assignment modal for task:', task.id);
    setSelectedTaskForMultipleAssignment(task);
    setIsMultipleAssignmentModalOpen(true);
  }, []);

  const handleMultipleAssignmentComplete = useCallback(() => {
    console.log('Multiple assignment completed, refreshing tasks...');
    setIsMultipleAssignmentModalOpen(false);
    setSelectedTaskForMultipleAssignment(null);
    refetch();
  }, [refetch]);

  // Only log on actual data changes, not on every render
  const debugLog = useMemo(() => {
    console.log('TasksPage - rendering with tasks:', tasks.length, 'filtered:', sortedTasks.length, 'paginated:', paginatedTasks.length, 'isLoading:', isLoading, 'unassigned:', unassignedTasks.length);
  }, [tasks.length, sortedTasks.length, paginatedTasks.length, isLoading, unassignedTasks.length]);

  return (
    <div className="min-h-screen bg-gray-50">
      <MemoizedTasksPageHeader
        showPastTasks={showPastTasks}
        searchTerm={searchTerm}
        unassignedTasks={unassignedTasks}
        onSearchChange={setSearchTerm}
        onTogglePastTasks={handleTogglePastTasks}
        onOpenCreateModal={handleOpenCreateModal}
        onOpenBatchModal={handleOpenBatchModal}
        onAssignmentComplete={handleAssignmentComplete}
      />

      <MemoizedTasksPageContent
        showPastTasks={showPastTasks}
        tasks={tasks}
        sortedTasks={sortedTasks}
        paginatedTasks={paginatedTasks}
        filters={filters}
        isLoading={isLoading}
        currentPage={currentPage}
        totalPages={totalPages}
        onFiltersChange={setFilters}
        onShowHistory={handleShowHistory}
        onCreateReport={handleCreateReport}
        onOpenGroupedReport={handleOpenGroupedReport}
        onAssignMultipleCleaners={handleAssignMultipleCleaners}
        onPageChange={handlePageChange}
        onRefetch={refetch}
      />

      {!showPastTasks && (
        <>
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
        </>
      )}

      <TaskHistoryModal 
        task={selectedTaskForHistory} 
        open={isHistoryModalOpen} 
        onOpenChange={setIsHistoryModalOpen} 
      />

      <TaskReportModal
        task={selectedTaskForReport}
        open={isReportModalOpen}
        onOpenChange={setIsReportModalOpen}
      />

      <GroupedTaskReportModal
        task={selectedTaskForGroupedReport}
        open={isGroupedReportModalOpen}
        onOpenChange={setIsGroupedReportModalOpen}
      />

      <AssignMultipleCleanersModal
        task={selectedTaskForMultipleAssignment}
        open={isMultipleAssignmentModalOpen}
        onOpenChange={setIsMultipleAssignmentModalOpen}
        onAssignComplete={handleMultipleAssignmentComplete}
      />
    </div>
  );
});

TasksPage.displayName = 'TasksPage';

export default TasksPage;
