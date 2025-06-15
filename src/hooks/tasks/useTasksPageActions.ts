
import { useState, useCallback } from 'react';
import { Task } from '@/types/calendar';
import { taskStorageService } from '@/services/taskStorage';

export const useTasksPageActions = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isBatchCreateModalOpen, setIsBatchCreateModalOpen] = useState(false);
  const [selectedTaskForHistory, setSelectedTaskForHistory] = useState<Task | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Create task mutation
  const createTask = useCallback(async (taskData: Omit<Task, 'id'>) => {
    await taskStorageService.createTask(taskData);
  }, []);

  // Memoize handlers to prevent unnecessary re-renders
  const handleCreateTask = useCallback((taskData: any) => {
    createTask(taskData);
  }, [createTask]);

  const handleBatchCreateTasks = useCallback((tasksData: any[]) => {
    tasksData.forEach(taskData => {
      createTask(taskData);
    });
  }, [createTask]);

  const handleShowHistory = useCallback((task: Task) => {
    setSelectedTaskForHistory(task);
    setIsHistoryModalOpen(true);
  }, []);

  const handleOpenCreateModal = useCallback(() => {
    setIsCreateModalOpen(true);
  }, []);

  const handleOpenBatchModal = useCallback(() => {
    setIsBatchCreateModalOpen(true);
  }, []);

  return {
    // Modal states
    isCreateModalOpen,
    setIsCreateModalOpen,
    isBatchCreateModalOpen,
    setIsBatchCreateModalOpen,
    selectedTaskForHistory,
    isHistoryModalOpen,
    setIsHistoryModalOpen,
    
    // Actions
    handleCreateTask,
    handleBatchCreateTasks,
    handleShowHistory,
    handleOpenCreateModal,
    handleOpenBatchModal,
  };
};
