import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdditionalTask, Task } from '@/types/calendar';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Json } from '@/integrations/supabase/types';

export const useAdditionalTasks = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const addSubtaskMutation = useMutation({
    mutationFn: async ({ 
      task, 
      subtask 
    }: { 
      task: Task; 
      subtask: Omit<AdditionalTask, 'id' | 'completed' | 'addedAt' | 'addedBy'> 
    }) => {
      const newSubtask: AdditionalTask = {
        id: crypto.randomUUID(),
        text: subtask.text,
        photoRequired: subtask.photoRequired,
        completed: false,
        addedBy: user?.id || '',
        addedByName: subtask.addedByName || user?.email || 'Admin',
        addedAt: new Date().toISOString(),
      };

      const currentTasks = task.additionalTasks || [];
      const updatedTasks = [...currentTasks, newSubtask];

      const { error } = await supabase
        .from('tasks')
        .update({ additional_tasks: updatedTasks as unknown as Json })
        .eq('id', task.id);

      if (error) throw error;

      // Send email notification if cleaner is assigned
      if (task.cleanerId) {
        try {
          await supabase.functions.invoke('send-subtask-notification-email', {
            body: {
              taskId: task.id,
              cleanerId: task.cleanerId,
              subtask: newSubtask,
              taskData: {
                property: task.property,
                address: task.address,
                date: task.date,
                startTime: task.startTime,
                endTime: task.endTime,
              }
            }
          });
        } catch (emailError) {
          console.error('Error sending subtask notification:', emailError);
          // Don't fail the mutation if email fails
        }
      }

      return { task, newSubtask, updatedTasks };
    },
    onSuccess: (data) => {
      // Invalidate task queries
      queryClient.invalidateQueries({ 
        predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === 'tasks'
      });
      
      toast({
        title: "Subtarea añadida",
        description: data.task.cleanerId 
          ? "Se ha notificado al limpiador por email." 
          : "La subtarea se ha guardado correctamente.",
      });
    },
    onError: (error: any) => {
      console.error('Error adding subtask:', error);
      toast({
        title: "Error",
        description: "No se pudo añadir la subtarea.",
        variant: "destructive",
      });
    }
  });

  const removeSubtaskMutation = useMutation({
    mutationFn: async ({ 
      task, 
      subtaskId 
    }: { 
      task: Task; 
      subtaskId: string 
    }) => {
      const currentTasks = task.additionalTasks || [];
      const updatedTasks = currentTasks.filter(t => t.id !== subtaskId);

      const { error } = await supabase
        .from('tasks')
        .update({ additional_tasks: updatedTasks as unknown as Json })
        .eq('id', task.id);

      if (error) throw error;

      return { task, updatedTasks };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === 'tasks'
      });
      
      toast({
        title: "Subtarea eliminada",
        description: "La subtarea se ha eliminado correctamente.",
      });
    },
    onError: (error: any) => {
      console.error('Error removing subtask:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la subtarea.",
        variant: "destructive",
      });
    }
  });

  const completeSubtaskMutation = useMutation({
    mutationFn: async ({ 
      task, 
      subtaskId,
      completed,
      notes,
      mediaUrls
    }: { 
      task: Task; 
      subtaskId: string;
      completed: boolean;
      notes?: string;
      mediaUrls?: string[];
    }) => {
      const currentTasks = task.additionalTasks || [];
      const updatedTasks = currentTasks.map(t => {
        if (t.id === subtaskId) {
          return {
            ...t,
            completed,
            completedAt: completed ? new Date().toISOString() : undefined,
            completedBy: completed ? user?.id : undefined,
            completedByName: completed ? user?.email : undefined,
            notes: notes || t.notes,
            mediaUrls: mediaUrls || t.mediaUrls,
          };
        }
        return t;
      });

      const { error } = await supabase
        .from('tasks')
        .update({ additional_tasks: updatedTasks as unknown as Json })
        .eq('id', task.id);

      if (error) throw error;

      return { task, updatedTasks };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === 'tasks'
      });
    },
    onError: (error: any) => {
      console.error('Error completing subtask:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar la subtarea.",
        variant: "destructive",
      });
    }
  });

  return {
    addSubtask: addSubtaskMutation.mutate,
    removeSubtask: removeSubtaskMutation.mutate,
    completeSubtask: completeSubtaskMutation.mutate,
    isAddingSubtask: addSubtaskMutation.isPending,
    isRemovingSubtask: removeSubtaskMutation.isPending,
    isCompletingSubtask: completeSubtaskMutation.isPending,
  };
};
