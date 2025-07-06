
import React, { useState, useMemo } from 'react';
import { TasksPageHeader } from './components/TasksPageHeader';
import { TasksPageContent } from './components/TasksPageContent';
import { TaskHistoryModal } from './components/TaskHistoryModal';
import { TaskReportModal } from '@/components/modals/TaskReportModal';
import { CreateTaskModal } from '@/components/modals/CreateTaskModal';
import { BatchCreateTaskModal } from '@/components/modals/BatchCreateTaskModal';
import { useTasksPageState } from '@/hooks/tasks/useTasksPageState';
import { useTasksPageActions } from '@/hooks/tasks/useTasksPageActions';
import { Task } from '@/types/calendar';

export default function TasksPage() {
  const [selectedTaskForReport, setSelectedTaskForReport] = useState<Task | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

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

  const handleCreateReport = (task: Task) => {
    console.log('Opening report modal for task:', task.id);
    setSelectedTaskForReport(task);
    setIsReportModalOpen(true);
  };

  const handleAssignmentComplete = () => {
    console.log('Assignment completed, refreshing tasks...');
    refetch();
  };

  console.log('TasksPage - rendering with tasks:', tasks.length, 'filtered:', sortedTasks.length, 'paginated:', paginatedTasks.length, 'isLoading:', isLoading, 'unassigned:', unassignedTasks.length);

  return (
    <div className="min-h-screen bg-gray-50">
      <TasksPageHeader
        showPastTasks={showPastTasks}
        searchTerm={searchTerm}
        unassignedTasks={unassignedTasks}
        onSearchChange={setSearchTerm}
        onTogglePastTasks={handleTogglePastTasks}
        onOpenCreateModal={handleOpenCreateModal}
        onOpenBatchModal={handleOpenBatchModal}
        onAssignmentComplete={handleAssignmentComplete}
      />

      <TasksPageContent
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
    </div>
  );
}
