import { useState, useCallback } from 'react';
import { Task } from '@/types/calendar';
import { useTasks } from '@/hooks/useTasks';
import { useToast } from '@/hooks/use-toast';
import { useRolePermissions } from '@/hooks/useRolePermissions';

export const useTasksPageActions = (currentDate: Date = new Date()) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isBatchCreateModalOpen, setIsBatchCreateModalOpen] = useState(false);
  const [selectedTaskForHistory, setSelectedTaskForHistory] = useState<Task | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isBatchCreating, setIsBatchCreating] = useState(false);

  const { toast } = useToast();
  const { hasPermission } = useRolePermissions();
  const canCreateTasks = hasPermission('tasks', 'canCreate');

  const { createTask, batchCreateTasks } = useTasks(currentDate, 'day');

  const handleCreateTask = useCallback(async (taskData: any) => {
    if (!canCreateTasks) {
      console.warn('🚫 useTasksPageActions - handleCreateTask blocked: user lacks canCreate permission');
      toast({
        title: 'Acción no permitida',
        description: 'No tienes permisos para crear tareas.',
        variant: 'destructive',
      });
      return;
    }
    console.log('🔵 useTasksPageActions - handleCreateTask called with:', taskData);
    createTask(taskData);
  }, [createTask, canCreateTasks, toast]);

  const handleBatchCreateTasks = useCallback(async (tasksData: any[]) => {
    if (!canCreateTasks) {
      console.warn('🚫 useTasksPageActions - handleBatchCreateTasks blocked: user lacks canCreate permission');
      toast({
        title: 'Acción no permitida',
        description: 'No tienes permisos para crear tareas.',
        variant: 'destructive',
      });
      return;
    }
    console.log('🔵 useTasksPageActions - handleBatchCreateTasks called with:', tasksData.length, 'tasks');
    setIsBatchCreating(true);
    try {
      const result = await batchCreateTasks({ tasks: tasksData, sendEmails: true });
      toast({
        title: "Tareas creadas",
        description: `Se han creado ${result.created} tareas${result.emailsSent > 0 ? ` y enviado ${result.emailsSent} emails` : ''}.`,
      });
      return result;
    } catch (error: any) {
      console.error('❌ Batch create failed:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudieron crear las tareas.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsBatchCreating(false);
    }
  }, [batchCreateTasks, toast, canCreateTasks]);

  const handleShowHistory = useCallback((task: Task) => {
    setSelectedTaskForHistory(task);
    setIsHistoryModalOpen(true);
  }, []);

  const handleOpenCreateModal = useCallback(() => {
    if (!canCreateTasks) return;
    setIsCreateModalOpen(true);
  }, [canCreateTasks]);

  const handleOpenBatchModal = useCallback(() => {
    if (!canCreateTasks) return;
    setIsBatchCreateModalOpen(true);
  }, [canCreateTasks]);

  return {
    isCreateModalOpen,
    setIsCreateModalOpen,
    isBatchCreateModalOpen,
    setIsBatchCreateModalOpen,
    selectedTaskForHistory,
    isHistoryModalOpen,
    setIsHistoryModalOpen,
    isBatchCreating,
    handleCreateTask,
    handleBatchCreateTasks,
    handleShowHistory,
    handleOpenCreateModal,
    handleOpenBatchModal,
  };
};
