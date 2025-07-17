
import { useState, useCallback } from 'react';
import { Task } from '@/types/calendar';
import { useTasks } from '@/hooks/useTasks';

export const useTasksPageActions = (currentDate: Date = new Date()) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isBatchCreateModalOpen, setIsBatchCreateModalOpen] = useState(false);
  const [selectedTaskForHistory, setSelectedTaskForHistory] = useState<Task | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Usar el hook useTasks para tener la invalidación del cache con la fecha correcta
  const { createTask } = useTasks(currentDate, 'day');

  // Memoize handlers to prevent unnecessary re-renders
  const handleCreateTask = useCallback(async (taskData: any) => {
    console.log('🔵 useTasksPageActions - handleCreateTask called with:', taskData);
    createTask(taskData);
  }, [createTask]);

  const handleBatchCreateTasks = useCallback((tasksData: any[]) => {
    console.log('🔵 useTasksPageActions - handleBatchCreateTasks called with:', tasksData.length, 'tasks');
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
