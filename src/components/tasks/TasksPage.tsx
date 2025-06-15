
import React, { useState } from 'react';
import { TasksPageHeader } from './components/TasksPageHeader';
import { TasksPageContent } from './components/TasksPageContent';
import { TaskHistoryModal } from './components/TaskHistoryModal';
import { CreateTaskModal } from '@/components/modals/CreateTaskModal';
import { BatchCreateTaskModal } from '@/components/modals/BatchCreateTaskModal';
import { useTasksPageState } from '@/hooks/tasks/useTasksPageState';
import { useTasksPageActions } from '@/hooks/tasks/useTasksPageActions';
import { Task } from '@/types/calendar';
import { useToast } from '@/hooks/use-toast';

export default function TasksPage() {
  const { toast } = useToast();
  const [selectedTaskForReport, setSelectedTaskForReport] = useState<Task | null>(null);

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

  const handleCreateReport = (task: Task) => {
    console.log('Creating report for task:', task.id);
    // Por ahora solo mostrar un toast, luego implementaremos el modal del reporte
    toast({
      title: "Función en desarrollo",
      description: `Creando reporte para la tarea: ${task.property}`,
    });
    setSelectedTaskForReport(task);
  };

  console.log('TasksPage - rendering with tasks:', tasks.length, 'filtered:', sortedTasks.length, 'paginated:', paginatedTasks.length, 'isLoading:', isLoading);

  return (
    <div className="min-h-screen bg-gray-50">
      <TasksPageHeader
        showPastTasks={showPastTasks}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onTogglePastTasks={handleTogglePastTasks}
        onOpenCreateModal={handleOpenCreateModal}
        onOpenBatchModal={handleOpenBatchModal}
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
    </div>
  );
}
