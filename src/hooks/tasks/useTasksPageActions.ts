import { useState, useCallback } from 'react';
import { Task } from '@/types/calendar';
import { useTasks } from '@/hooks/useTasks';
import { useToast } from '@/hooks/use-toast';

export const useTasksPageActions = (currentDate: Date = new Date()) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isBatchCreateModalOpen, setIsBatchCreateModalOpen] = useState(false);
  const [selectedTaskForHistory, setSelectedTaskForHistory] = useState<Task | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isBatchCreating, setIsBatchCreating] = useState(false);

  const { toast } = useToast();
  
  // Usar el hook useTasks para tener la invalidación del cache con la fecha correcta
  const { createTask, batchCreateTasks } = useTasks(currentDate, 'day');

  // Memoize handlers to prevent unnecessary re-renders
  const handleCreateTask = useCallback(async (taskData: any) => {
    console.log('🔵 useTasksPageActions - handleCreateTask called with:', taskData);
    createTask(taskData);
  }, [createTask]);

  // Optimized batch create using Edge Function
  const handleBatchCreateTasks = useCallback(async (tasksData: any[]) => {
    console.log('🔵 useTasksPageActions - handleBatchCreateTasks called with:', tasksData.length, 'tasks');
    
    setIsBatchCreating(true);
    
    try {
      const result = await batchCreateTasks({ 
        tasks: tasksData, 
        sendEmails: true 
      });
      
      console.log('✅ Batch create result:', result);
      
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
  }, [batchCreateTasks, toast]);

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
    
    // Loading states
    isBatchCreating,
    
    // Actions
    handleCreateTask,
    handleBatchCreateTasks,
    handleShowHistory,
    handleOpenCreateModal,
    handleOpenBatchModal,
  };
};
